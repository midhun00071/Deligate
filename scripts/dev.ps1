$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPackage = Join-Path $projectRoot 'package.json'
$networkName = 'deligate-local'
$script:pnpmCommand = $null

function Write-Step([string] $Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked([string] $File, [string[]] $Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File failed with exit code $LASTEXITCODE."
  }
}

function Get-PinnedPnpmVersion {
  $packageManager = (Get-Content -Raw $projectPackage | ConvertFrom-Json).packageManager
  if ($packageManager -match '^pnpm@(\d+\.\d+\.\d+)$') {
    return $Matches[1]
  }
  throw "Unsupported packageManager value: $packageManager. Expected an exact pnpm version."
}

function Get-RequiredNodeMajor([string] $Constraint) {
  if ($Constraint -match '^\s*>=\s*(\d+)(?:\.\d+){0,2}\s*$') {
    return [int]$Matches[1]
  }
  throw "Unsupported Node engine constraint: $Constraint. Expected a minimum constraint such as >=22."
}

function Get-CommandVersion([string] $File, [string[]] $Arguments) {
  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & $File @Arguments 2>$null
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($output -join "`n").Trim()
}

function Resolve-PnpmCommand {
  $pinnedVersion = Get-PinnedPnpmVersion
  $candidates = @(
    @{ File = 'corepack'; Prefix = @('pnpm') },
    @{ File = 'pnpm'; Prefix = @() }
  )

  foreach ($candidate in $candidates) {
    if (-not (Get-Command $candidate.File -ErrorAction SilentlyContinue)) { continue }
    $version = Get-CommandVersion $candidate.File ($candidate.Prefix + @('--version'))
    if ($version -eq $pinnedVersion) { return $candidate }
  }

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "pnpm $pinnedVersion is required. Neither Corepack nor pnpm can provide it, and npm is unavailable for bootstrap."
  }

  Write-Step "Bootstrapping pnpm $pinnedVersion with npm"
  Invoke-Checked 'npm' @('install', '--global', "pnpm@$pinnedVersion")
  $version = Get-CommandVersion 'pnpm' @('--version')
  if ($version -ne $pinnedVersion) {
    throw "npm bootstrap did not provide pnpm $pinnedVersion. Found: $version."
  }
  return @{ File = 'pnpm'; Prefix = @() }
}

function Get-PnpmCommand {
  if ($null -eq $script:pnpmCommand) {
    $script:pnpmCommand = Resolve-PnpmCommand
  }
  return $script:pnpmCommand
}

function Invoke-Pnpm([string[]] $Arguments) {
  $command = Get-PnpmCommand
  Invoke-Checked $command.File ($command.Prefix + $Arguments)
}

function Invoke-PnpmCapture([string[]] $Arguments) {
  $command = Get-PnpmCommand
  $capturePath = Join-Path ([IO.Path]::GetTempPath()) "deligate-pnpm-$([guid]::NewGuid()).log"
  $commandLine = (@($command.File) + $command.Prefix + $Arguments) -join ' '
  try {
    & cmd.exe /d /c "$commandLine > `"$capturePath`" 2>&1"
    $exitCode = $LASTEXITCODE
    $output = if (Test-Path $capturePath) { Get-Content -Raw $capturePath } else { '' }
  } finally {
    Remove-Item -LiteralPath $capturePath -Force -ErrorAction SilentlyContinue
  }
  if ($exitCode -ne 0) {
    return $null
  }
  return $output
}

function Invoke-PnpmQuiet([string[]] $Arguments) {
  $command = Get-PnpmCommand
  $commandLine = (@($command.File) + $command.Prefix + $Arguments) -join ' '
  & cmd.exe /d /c "$commandLine > NUL 2>&1"
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Assert-Prerequisites {
  if ($PSVersionTable.PSVersion.Major -lt 5) {
    throw 'Windows PowerShell 5.1 or newer is required.'
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is not installed. Install the Node.js version required by package.json, then rerun run.cmd.'
  }
  $nodeConstraint = (Get-Content -Raw $projectPackage | ConvertFrom-Json).engines.node
  $requiredMajor = Get-RequiredNodeMajor $nodeConstraint
  $nodeVersion = [version]((& node --version).TrimStart('v'))
  if ($nodeVersion.Major -lt $requiredMajor) {
    throw "Node.js $requiredMajor or newer is required; found $nodeVersion."
  }
  $expectedPnpm = Get-PinnedPnpmVersion
  $actualPnpm = Get-CommandVersion (Get-PnpmCommand).File ((Get-PnpmCommand).Prefix + @('--version'))
  if ($actualPnpm -ne $expectedPnpm) {
    throw "pnpm $expectedPnpm is required by package.json. Found: $actualPnpm."
  }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI is not installed. Install Docker Desktop (winget install Docker.DockerDesktop is supported), complete first-run setup, then rerun run.cmd.'
  }
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    $desktop = Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) {
      Write-Host 'Starting Docker Desktop; waiting for its daemon...'
      Start-Process -FilePath $desktop | Out-Null
      for ($attempt = 1; $attempt -le 60; $attempt++) {
        Start-Sleep -Seconds 2
        & docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
      }
    }
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
      throw 'Docker is installed but its daemon is unavailable. Complete Docker Desktop first-run/WSL/elevation requirements, then rerun run.cmd.'
    }
  }
}

function Ensure-EnvironmentFile([string] $Path, [string] $Template) {
  if (-not (Test-Path $Path)) {
    Copy-Item -LiteralPath $Template -Destination $Path
    Write-Host "Created $([IO.Path]::GetFileName($Path)) from its example."
  }
}

function Remove-Utf8Bom([string] $Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) { return }
  [IO.File]::WriteAllBytes($Path, $bytes[3..($bytes.Length - 1)])
}

function Ensure-LocalEnvironmentFiles {
  $rootEnv = Join-Path $projectRoot '.env'
  $mobileEnv = Join-Path $projectRoot 'apps\mobile\.env'
  Ensure-EnvironmentFile $rootEnv (Join-Path $projectRoot '.env.example')
  Ensure-EnvironmentFile $mobileEnv (Join-Path $projectRoot 'apps\mobile\.env.example')
  Remove-Utf8Bom $rootEnv
  Remove-Utf8Bom $mobileEnv
}

function Set-LocalEnvironmentValue([string] $Path, [string] $Key, [string] $Value, [string[]] $ReplaceableValues = @()) {
  $lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $Path)
  $expression = "^(?<prefix>\s*$([regex]::Escape($Key))\s*=)(?<value>.*)$"
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $match = [regex]::Match($lines[$index], $expression)
    if (-not $match.Success) { continue }
    $currentValue = $match.Groups['value'].Value.Trim()
    if ($currentValue -and $currentValue -notin $ReplaceableValues) { return }
    $lines[$index] = "$($match.Groups['prefix'].Value)$Value"
    [IO.File]::WriteAllLines($Path, $lines, [Text.UTF8Encoding]::new($false))
    return
  }
  $lines.Add("$Key=$Value")
  [IO.File]::WriteAllLines($Path, $lines, [Text.UTF8Encoding]::new($false))
}

function Get-StatusValue($Status, [string[]] $Names) {
  foreach ($name in $Names) {
    $property = $Status.PSObject.Properties[$name]
    if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      return [string]$property.Value
    }
  }
  return $null
}

function Get-SupabaseStatus {
  $json = Invoke-PnpmCapture @('exec', 'supabase', 'status', '--output', 'json')
  if (-not $json) { return $null }
  $jsonStart = $json.IndexOf('{')
  if ($jsonStart -lt 0) {
    throw 'Supabase status succeeded but did not return machine-readable JSON.'
  }
  try {
    return $json.Substring($jsonStart) | ConvertFrom-Json
  } catch {
    throw "Supabase status returned invalid machine-readable JSON: $($_.Exception.Message)"
  }
}

function Ensure-Supabase {
  & docker network inspect $networkName *> $null
  if ($LASTEXITCODE -ne 0) { Invoke-Checked 'docker' @('network', 'create', $networkName) }
  $status = Get-SupabaseStatus
  if (-not $status) {
    Write-Host '[Deligate] Starting local Supabase...' -ForegroundColor Cyan
    try {
      Invoke-PnpmQuiet @('exec', 'supabase', 'start', '--network-id', $networkName)
    } catch {
      throw 'Local Supabase failed to start. Check Docker Desktop health and run the Supabase CLI directly for local diagnostics.'
    }
    $status = Get-SupabaseStatus
  }
  if (-not $status) { throw 'Supabase did not report healthy local status after startup.' }
  Invoke-PnpmQuiet @('exec', 'supabase', 'migration', 'up', '--local')
  return $status
}

function Set-DevelopmentEnvironment($Status) {
  $rootEnv = Join-Path $projectRoot '.env'
  $mobileEnv = Join-Path $projectRoot 'apps\mobile\.env'
  $apiUrl = Get-StatusValue $Status @('API_URL')
  $publishableKey = Get-StatusValue $Status @('PUBLISHABLE_KEY', 'ANON_KEY')
  $secretKey = Get-StatusValue $Status @('SECRET_KEY', 'SERVICE_ROLE_KEY')
  if (-not $apiUrl -or -not $publishableKey -or -not $secretKey) {
    throw 'Supabase status did not provide the required URL and keys. Update the local CLI and rerun; no environment file was overwritten.'
  }
  $activeInterfaceIndexes = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Virtual|Loopback|Hyper-V|WSL|Docker' } |
    Select-Object -ExpandProperty ifIndex
  $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' -and $_.InterfaceIndex -in $activeInterfaceIndexes } |
    Sort-Object -Property InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress
  $clientHost = if ($lanAddress) { $lanAddress } else { '127.0.0.1' }
  if (-not $lanAddress) { Write-Warning 'No active LAN IPv4 address was found; physical-device access requires setting the public URLs manually.' }
  Set-LocalEnvironmentValue $rootEnv 'SUPABASE_URL' $apiUrl @('http://127.0.0.1:54321')
  Set-LocalEnvironmentValue $rootEnv 'SUPABASE_PUBLISHABLE_KEY' $publishableKey
  Set-LocalEnvironmentValue $rootEnv 'SUPABASE_SECRET_KEY' $secretKey
  Set-LocalEnvironmentValue $rootEnv 'CORS_ORIGINS' "http://localhost:8081,http://127.0.0.1:8081,http://${clientHost}:8081" @('http://localhost:8081,http://127.0.0.1:8081')
  Set-LocalEnvironmentValue $mobileEnv 'EXPO_PUBLIC_API_URL' "http://${clientHost}:3000" @('http://127.0.0.1:3000')
  Set-LocalEnvironmentValue $mobileEnv 'EXPO_PUBLIC_SUPABASE_URL' ($apiUrl -replace '127\.0\.0\.1', $clientHost) @('http://127.0.0.1:54321')
  Set-LocalEnvironmentValue $mobileEnv 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' $publishableKey
}

function Invoke-Checks {
  Invoke-Checked 'git' @('diff', '--check')
  Invoke-Pnpm @('lint')
  Invoke-Pnpm @('typecheck')
  Invoke-Pnpm @('build')
  Invoke-Pnpm @('exec', 'supabase', 'db', 'lint')
}

function Start-Development {
  Write-Step 'Starting API and Expo development servers (Ctrl+C stops only these foreground processes)'
  $command = Get-PnpmCommand
  $apiCommand = @($command.File) + $command.Prefix + @('--filter', '@deligate/api', 'dev')
  $mobileCommand = @($command.File) + $command.Prefix + @('--filter', '@deligate/mobile', 'dev', '--', '--lan')
  $api = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', ($apiCommand -join ' ')) -NoNewWindow -PassThru
  $mobile = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', ($mobileCommand -join ' ')) -NoNewWindow -PassThru
  try { Wait-Process -Id $api.Id, $mobile.Id } finally {
    foreach ($process in @($api, $mobile)) {
      if (-not $process.HasExited) {
        & taskkill /PID $process.Id /T /F *> $null
      }
    }
  }
}

Set-Location $projectRoot
if ($args.Count -gt 1 -or ($args.Count -eq 1 -and $args[0] -ne '--check')) {
  Write-Host 'Usage: run.cmd [--check]' -ForegroundColor Red
  exit 2
}

try {
  Assert-Prerequisites
  Write-Step 'Installing workspace dependencies'
  Invoke-Pnpm @('install', '--config.confirmModulesPurge=false')
  if ($args.Count -eq 1) { Invoke-Checks; exit 0 }
  Ensure-LocalEnvironmentFiles
  $status = Ensure-Supabase
  Write-Step 'Preparing local environment configuration'
  Set-DevelopmentEnvironment $status
  Start-Development
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
