function Write-ExpectedEnvironmentValue(
  [string] $Path,
  [string] $Key,
  [string] $Expected
) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "${Key}: environment file missing" -ForegroundColor Yellow
    return $false
  }

  $values = Read-EnvironmentValues $Path
  $actual = $values[$Key]
  if ($actual -eq $Expected) {
    Write-Host "${Key}: CURRENT"
    return $true
  }

  Write-Host "${Key}: STALE / MISMATCH" -ForegroundColor Yellow
  Write-Host "  expected $Expected"
  Write-Host "  found    $(if ($actual) { $actual } else { '<missing>' })"
  return $false
}

function Invoke-Doctor($Lan) {
  Step 'Diagnostics'
  $ok = $true

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js: missing' -ForegroundColor Red
    $ok = $false
  } else {
    $engine = (Get-ProjectPackage).engines.node
    $nodeVersion = (& node --version).Trim()
    Write-Host "Node.js: $nodeVersion (required $engine)"

    if ($engine -match '^>=\s*(\d+)') {
      $major = [int]$Matches[1]
      if ([version]($nodeVersion.TrimStart('v')) -lt [version]"$major.0.0") {
        $ok = $false
      }
    }
  }

  $pnpm = Find-PnpmCommand
  if ($null -eq $pnpm) {
    Write-Host "pnpm: exact repository version $(Get-PinnedPnpmVersion) is unavailable" -ForegroundColor Red
    $ok = $false
  } else {
    Write-Host "pnpm: $(Get-CommandVersion $pnpm.File ($pnpm.Prefix + @('--version')))"
    if (Test-RequiredTools $pnpm) {
      Write-Host 'Workspace tools: ready'
    } else {
      Write-Host 'Workspace tools: one or more required executables are missing' -ForegroundColor Red
      $ok = $false
    }
  }

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host 'Docker CLI: missing' -ForegroundColor Red
    $ok = $false
  } else {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Docker daemon: ready'
    } else {
      Write-Host 'Docker daemon: unavailable' -ForegroundColor Red
      $ok = $false
    }
  }

  $rootEnv = Join-Path $projectRoot '.env'
  $mobileEnv = Join-Path $projectRoot 'apps\mobile\.env'
  Write-Host "Root env: $(if (Test-Path -LiteralPath $rootEnv) { 'present' } else { 'missing' })"
  Write-Host "Mobile env: $(if (Test-Path -LiteralPath $mobileEnv) { 'present' } else { 'missing' })"

  if (-not (Test-Path -LiteralPath $rootEnv) -or -not (Test-Path -LiteralPath $mobileEnv)) {
    $ok = $false
  } else {
    try {
      Assert-EidStackConfig
      $mode = (Read-EnvironmentValues $rootEnv)['EIDSTACK_MODE']
      Write-Host "EIDSTACK_MODE: $mode"
    } catch {
      Write-Host $_.Exception.Message -ForegroundColor Red
      $ok = $false
    }
  }

  $status = $null
  if ($null -ne $pnpm -and (Test-PnpmCommand $pnpm @('exec', 'supabase', '--version'))) {
    $status = Get-SupabaseStatus $pnpm
  }
  Write-Host "Local Supabase: $(if ($status) { 'ready' } else { 'not running' })"

  Write-Host "LAN interface: $(if ($Lan) { $Lan.Name } else { 'none found' })"
  Write-Host "LAN IPv4: $(if ($Lan) { $Lan.Address } else { 'none found' })"
  if (-not $Lan) {
    $ok = $false
  }

  if ($Lan -and (Test-Path -LiteralPath $rootEnv) -and (Test-Path -LiteralPath $mobileEnv)) {
    $hostName = $Lan.Address
    $supabaseClientUrl = if ($status -and $status.API_URL) {
      [string]$status.API_URL -replace '127\.0\.0\.1', $hostName
    } else {
      "http://${hostName}:54321"
    }

    $urlsCurrent = $true
    $urlsCurrent = (Write-ExpectedEnvironmentValue $mobileEnv 'EXPO_PUBLIC_API_URL' "http://${hostName}:3000") -and $urlsCurrent
    $urlsCurrent = (Write-ExpectedEnvironmentValue $mobileEnv 'EXPO_PUBLIC_SUPABASE_URL' $supabaseClientUrl) -and $urlsCurrent
    $urlsCurrent = (Write-ExpectedEnvironmentValue $rootEnv 'CORS_ORIGINS' "http://localhost:8081,http://127.0.0.1:8081,http://${hostName}:8081") -and $urlsCurrent

    if (-not $urlsCurrent) {
      Write-Host 'Generated URLs are stale. Run .\run.cmd to refresh runner-managed values.' -ForegroundColor Yellow
      $ok = $false
    }
  }

  foreach ($port in @(3000, 8081, 54321, 54323)) {
    $owner = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($owner) {
      Write-Host "Port ${port}: occupied (PID $($owner.OwningProcess))"
    } else {
      Write-Host "Port ${port}: available"
    }
  }

  return $ok
}
