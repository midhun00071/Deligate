$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPackage = Join-Path $projectRoot 'package.json'
$script:pnpmCommand = $null

. (Join-Path $PSScriptRoot 'dev\common.ps1')
. (Join-Path $PSScriptRoot 'dev\environment.ps1')
. (Join-Path $PSScriptRoot 'dev\network.ps1')
. (Join-Path $PSScriptRoot 'dev\supabase.ps1')
. (Join-Path $PSScriptRoot 'dev\doctor.ps1')

function Start-Development {
  Invoke-Pnpm @('--filter', '@deligate/eidstack', 'build')
  Invoke-Pnpm @('--filter', '@deligate/validation', 'build')

  Step 'Starting API; Expo QR will remain in the foreground'
  $command = Get-PnpmCommand
  $apiCommand = @($command.File) + $command.Prefix + @('--filter', '@deligate/api', 'dev')
  $api = Start-Process 'cmd.exe' `
    -ArgumentList @('/d', '/c', ($apiCommand -join ' ')) `
    -WindowStyle Hidden `
    -PassThru

  try {
    Invoke-Pnpm @('--filter', '@deligate/mobile', 'dev', '--', '--lan')
  } finally {
    if (-not $api.HasExited) {
      & taskkill /PID $api.Id /T /F *> $null
    }
  }
}

function Parse-Arguments([object[]] $Arguments) {
  $mode = $null
  $lanOverride = $null

  for ($index = 0; $index -lt $Arguments.Count; $index++) {
    $argument = [string]$Arguments[$index]

    switch ($argument) {
      '--check' {
        if ($mode) { Fail 'Use only one of --check or --doctor.' }
        $mode = '--check'
      }
      '--doctor' {
        if ($mode) { Fail 'Use only one of --check or --doctor.' }
        $mode = '--doctor'
      }
      '--lan-ip' {
        if ($lanOverride) { Fail '--lan-ip may be supplied only once.' }
        if ($index + 1 -ge $Arguments.Count) {
          Fail '--lan-ip requires an IPv4 value.'
        }
        $index++
        $lanOverride = [string]$Arguments[$index]
      }
      default {
        Fail 'Usage: run.cmd [--check|--doctor] [--lan-ip <IPv4>]'
      }
    }
  }

  return [pscustomobject]@{
    Mode = $mode
    LanOverride = $lanOverride
  }
}

Set-Location $projectRoot

try {
  $options = Parse-Arguments $args

  if ($options.Mode -eq '--check') {
    Assert-Prerequisites
    Ensure-Dependencies
    Run 'git' @('-c', "safe.directory=$projectRoot", 'diff', '--check')
    Invoke-Pnpm @('lint')
    Invoke-Pnpm @('typecheck')
    Invoke-Pnpm @('build')
    Invoke-Pnpm @('exec', 'supabase', 'db', 'lint')
    exit 0
  }

  $lan = Get-LanSelection $options.LanOverride

  if ($options.Mode -eq '--doctor') {
    if (Invoke-Doctor $lan) {
      exit 0
    }
    exit 1
  }

  Assert-Prerequisites
  Ensure-Dependencies
  Ensure-EnvironmentFiles
  Assert-EidStackConfig

  $status = Ensure-Supabase
  Refresh-Urls $status $lan
  Invoke-Pnpm @('exec', 'node', 'scripts/seed-local-dev.mjs')
  Assert-DevelopmentPorts

  $rootValues = Read-EnvironmentValues (Join-Path $projectRoot '.env')
  $hostName = if ($lan) { $lan.Address } else { '127.0.0.1' }

  Write-Host @"

============================================================
 DELIGATE LOCAL DEVELOPMENT
============================================================
Mode:            $($rootValues['EIDSTACK_MODE'])
LAN interface:   $(if ($lan) { $lan.Name } else { 'unavailable' })
LAN IP:          $hostName

Web:             http://localhost:8081
API LAN:         http://${hostName}:3000
Supabase LAN:    http://${hostName}:54321
Supabase Studio: http://127.0.0.1:54323

Demo users: LOCAL DEVELOPMENT ONLY
Delivery Admin:      delivery.admin@deligate.local
Building Security:   building.security@deligate.local
Password:            DeligateDemo2026!

Physical device:
1. Put the phone and laptop on the same reachable network.
2. Open Expo Go.
3. Scan the Expo LAN QR shown below.

Diagnostics: .\run.cmd --doctor
Validation:  .\run.cmd --check
============================================================
"@ -ForegroundColor Green

  Start-Development
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
