function Set-EnvironmentValue(
  [string] $Path,
  [string] $Key,
  [string] $Value,
  [switch] $Managed
) {
  $lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $Path)
  $pattern = "^\s*$([regex]::Escape($Key))=.*$"

  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -notmatch $pattern) {
      continue
    }

    $current = ($lines[$index] -split '=', 2)[1].Trim()
    if ($Managed -or -not $current) {
      $lines[$index] = "$Key=$Value"
      [IO.File]::WriteAllLines($Path, $lines, [Text.UTF8Encoding]::new($false))
    }
    return
  }

  $lines.Add("$Key=$Value")
  [IO.File]::WriteAllLines($Path, $lines, [Text.UTF8Encoding]::new($false))
}

function Ensure-EnvironmentFiles {
  $files = @(
    @{ Target = '.env'; Template = '.env.example' },
    @{ Target = 'apps\mobile\.env'; Template = 'apps\mobile\.env.example' }
  )

  foreach ($file in $files) {
    $target = Join-Path $projectRoot $file.Target
    if (-not (Test-Path -LiteralPath $target)) {
      Copy-Item -LiteralPath (Join-Path $projectRoot $file.Template) -Destination $target
    }
  }
}

function Read-EnvironmentValues([string] $Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') {
      $values[$Matches[1]] = $Matches[2].Trim()
    }
  }
  return $values
}

function Assert-EidStackConfig {
  $values = Read-EnvironmentValues (Join-Path $projectRoot '.env')
  $mode = $values['EIDSTACK_MODE']

  if ($mode -notin @('mock', 'live')) {
    Fail 'EIDSTACK_MODE must be mock or live.'
  }

  if ($mode -ne 'live') {
    return
  }

  $required = @(
    'EIDSTACK_API_KEY',
    'EIDSTACK_DELIVERY_TENANT_ID',
    'EIDSTACK_BUILDING_TENANT_ID',
    'EIDSTACK_DELIVERY_ORGANIZATION_ID',
    'EIDSTACK_RIDER_SCHEMA_ID',
    'EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID',
    'EIDSTACK_ACCESS_SCHEMA_ID',
    'EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID'
  )

  $missing = @($required | Where-Object { -not $values[$_] })
  if ($missing.Count -gt 0) {
    Fail "Live eidStack configuration is incomplete: $($missing -join ', '). Live mode will not fall back to mock."
  }
}

function Refresh-Urls($Status, $Lan) {
  $rootEnv = Join-Path $projectRoot '.env'
  $mobileEnv = Join-Path $projectRoot 'apps\mobile\.env'
  $hostName = if ($Lan) { $Lan.Address } else { '127.0.0.1' }

  $apiUrl = Get-SupabaseStatusValue $Status @('API_URL')
  $publishableKey = Get-SupabaseStatusValue $Status @('PUBLISHABLE_KEY', 'ANON_KEY')
  $secretKey = Get-SupabaseStatusValue $Status @('SECRET_KEY', 'SERVICE_ROLE_KEY')

  if (-not $apiUrl -or -not $publishableKey -or -not $secretKey) {
    Fail 'Supabase status did not provide the required local URL and keys.'
  }

  Set-EnvironmentValue $rootEnv 'SUPABASE_URL' $apiUrl
  Set-EnvironmentValue $rootEnv 'SUPABASE_PUBLISHABLE_KEY' $publishableKey
  Set-EnvironmentValue $rootEnv 'SUPABASE_SECRET_KEY' $secretKey
  Set-EnvironmentValue $rootEnv 'CORS_ORIGINS' "http://localhost:8081,http://127.0.0.1:8081,http://${hostName}:8081" -Managed

  Set-EnvironmentValue $mobileEnv 'EXPO_PUBLIC_API_URL' "http://${hostName}:3000" -Managed
  Set-EnvironmentValue $mobileEnv 'EXPO_PUBLIC_SUPABASE_URL' ($apiUrl -replace '127\.0\.0\.1', $hostName) -Managed
  Set-EnvironmentValue $mobileEnv 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' $publishableKey
}
