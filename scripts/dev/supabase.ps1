function Get-SupabaseStatusValue($Status, [string[]] $Names) {
  foreach ($name in $Names) {
    $property = $Status.PSObject.Properties[$name]
    if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      return [string]$property.Value
    }
  }
  return $null
}

function Get-SupabaseStatus($Command) {
  if ($null -eq $Command) {
    $Command = Get-PnpmCommand
  }

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell can promote native stderr from the pnpm shim to a
    # terminating NativeCommandError while the script-wide preference is Stop.
    # Supabase reports optional stopped services on stderr even when status
    # succeeds, so suppress stderr and use Continue only for this native call.
    $ErrorActionPreference = 'Continue'
    $output = & $Command.File @($Command.Prefix + @('exec', 'supabase', 'status', '--output', 'json')) 2>$null
  } catch {
    return $null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  $text = $output -join "`n"
  $jsonStart = $text.IndexOf('{')
  $jsonEnd = $text.LastIndexOf('}')
  if ($jsonStart -lt 0 -or $jsonEnd -le $jsonStart) {
    return $null
  }

  try {
    $json = $text.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
    $status = $json | ConvertFrom-Json
    $apiUrl = Get-SupabaseStatusValue $status @('API_URL')
    if ([string]::IsNullOrWhiteSpace($apiUrl)) {
      return $null
    }
    return $status
  } catch {
    return $null
  }
}

function Ensure-Supabase {
  $status = Get-SupabaseStatus $null
  if (-not $status) {
    Step 'Starting local Supabase'
    Invoke-Pnpm @('exec', 'supabase', 'start') | Out-Host
    $status = Get-SupabaseStatus $null
  }

  if (-not $status) {
    Fail 'Local Supabase did not become healthy.'
  }

  Invoke-Pnpm @('exec', 'supabase', 'migration', 'up', '--local') | Out-Host
  return $status
}
