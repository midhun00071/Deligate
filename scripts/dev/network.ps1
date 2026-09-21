function Test-UsableIpv4([string] $Address) {
  $parsed = $null
  if (-not [Net.IPAddress]::TryParse($Address, [ref]$parsed)) {
    return $false
  }

  if ($parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    return $false
  }

  $bytes = $parsed.GetAddressBytes()
  if ($bytes[0] -eq 0) { return $false }
  if ($bytes[0] -eq 127) { return $false }
  if ($bytes[0] -eq 169 -and $bytes[1] -eq 254) { return $false }
  if ($bytes[0] -ge 224) { return $false }

  return $true
}

function Get-LanSelection([string] $Override) {
  if ($Override) {
    if (-not (Test-UsableIpv4 $Override)) {
      Fail '--lan-ip must be a usable unicast IPv4 address.'
    }

    $assigned = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -eq $Override } |
      Select-Object -First 1

    if (-not $assigned) {
      Fail '--lan-ip must be an IPv4 address assigned to this computer.'
    }

    $adapter = Get-NetAdapter -ErrorAction SilentlyContinue |
      Where-Object { $_.ifIndex -eq $assigned.InterfaceIndex } |
      Select-Object -First 1
    if (-not $adapter -or $adapter.Status -ne 'Up') {
      Fail '--lan-ip must belong to an active network adapter.'
    }

    return [pscustomobject]@{
      Name = $adapter.Name
      Address = $Override
    }
  }

  $ipInterfaces = @(Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue)
  $candidates = @()

  foreach ($adapter in @(Get-NetAdapter -ErrorAction SilentlyContinue)) {
    if ($adapter.Status -ne 'Up') {
      continue
    }

    $description = "$($adapter.Name) $($adapter.InterfaceDescription)"
    if ($description -match 'Virtual|Loopback|Hyper-V|WSL|Docker|vEthernet|VMware|VirtualBox|TAP|TUN') {
      continue
    }

    if (
      $adapter.PSObject.Properties['HardwareInterface'] -and
      -not $adapter.HardwareInterface
    ) {
      continue
    }

    $interface = $ipInterfaces |
      Where-Object { $_.InterfaceIndex -eq $adapter.ifIndex } |
      Select-Object -First 1

    $metric = if ($interface) { [int]$interface.InterfaceMetric } else { 9999 }
    $rank = if ($description -match 'Wi-?Fi|Wireless|802\.11') { 0 } else { 1 }

    $addresses = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        (Test-UsableIpv4 $_.IPAddress) -and
        $_.PrefixOrigin -ne 'WellKnown'
      }

    foreach ($address in $addresses) {
      $candidates += [pscustomobject]@{
        Name = $adapter.Name
        Address = $address.IPAddress
        Rank = $rank
        Metric = $metric
      }
    }
  }

  return $candidates |
    Sort-Object Rank, Metric, Name, Address |
    Select-Object -First 1
}

function Assert-DevelopmentPorts {
  foreach ($port in @(3000, 8081)) {
    $owner = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($owner) {
      Fail "Port $port is already in use by PID $($owner.OwningProcess). Stop that process or run .\run.cmd --doctor for diagnostics."
    }
  }
}
