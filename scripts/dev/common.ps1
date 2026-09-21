function Fail([string] $Message) {
  throw $Message
}

function Step([string] $Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Run([string] $File, [string[]] $Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "$File failed with exit code $LASTEXITCODE."
  }
}

function Get-ProjectPackage {
  return Get-Content -Raw -LiteralPath $projectPackage | ConvertFrom-Json
}

function Get-PinnedPnpmVersion {
  $packageManager = (Get-ProjectPackage).packageManager
  if ($packageManager -match '^pnpm@(\d+\.\d+\.\d+)$') {
    return $Matches[1]
  }
  Fail 'packageManager must pin an exact pnpm version.'
}

function Get-CommandVersion([string] $File, [string[]] $Arguments) {
  try {
    $output = & $File @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return ($output -join "`n").Trim()
  } catch {
    return $null
  }
}

function Find-PnpmCommand {
  $expected = Get-PinnedPnpmVersion
  $candidates = @(
    @{ File = 'corepack'; Prefix = @('pnpm') },
    @{ File = 'pnpm'; Prefix = @() }
  )

  foreach ($candidate in $candidates) {
    if (-not (Get-Command $candidate.File -ErrorAction SilentlyContinue)) {
      continue
    }

    $version = Get-CommandVersion $candidate.File ($candidate.Prefix + @('--version'))
    if ($version -eq $expected) {
      return $candidate
    }
  }

  return $null
}

function Resolve-PnpmCommand {
  $existing = Find-PnpmCommand
  if ($null -ne $existing) {
    return $existing
  }

  $expected = Get-PinnedPnpmVersion
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "pnpm $expected is required. Enable Corepack or install Node.js with npm."
  }

  Step "Bootstrapping pnpm $expected"
  Run 'npm' @('install', '--global', "pnpm@$expected")

  $version = Get-CommandVersion 'pnpm' @('--version')
  if ($version -ne $expected) {
    Fail "pnpm $expected could not be installed."
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
  Run $command.File ($command.Prefix + $Arguments)
}

function Test-PnpmCommand($Command, [string[]] $Arguments) {
  try {
    & $Command.File @($Command.Prefix + $Arguments) *> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Test-RequiredTools($Command) {
  $checks = @(
    @('exec', 'turbo', '--version'),
    @('exec', 'tsc', '--version'),
    @('exec', 'supabase', '--version'),
    @('--filter', '@deligate/mobile', 'exec', 'expo', '--version')
  )

  foreach ($check in $checks) {
    if (-not (Test-PnpmCommand $Command $check)) {
      return $false
    }
  }
  return $true
}

function Ensure-Dependencies {
  Step 'Installing workspace dependencies'
  Invoke-Pnpm @('install', '--config.confirmModulesPurge=false')

  $command = Get-PnpmCommand
  if (Test-RequiredTools $command) {
    return
  }

  Step 'Repairing incomplete dependency store once'
  Invoke-Pnpm @('install', '--force', '--config.confirmModulesPurge=false')

  if (-not (Test-RequiredTools $command)) {
    Fail 'Required tool binaries remain unavailable after one repair. Delete only this repository node_modules and rerun run.cmd.'
  }
}

function Assert-Prerequisites {
  if ($PSVersionTable.PSVersion.Major -lt 5) {
    Fail 'Windows PowerShell 5.1 or newer is required.'
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js is required. Install the version declared in package.json.'
  }

  $engine = (Get-ProjectPackage).engines.node
  if ($engine -notmatch '^>=\s*(\d+)') {
    Fail 'Unsupported Node engine constraint.'
  }

  $requiredMajor = [int]$Matches[1]
  $actual = [version]((& node --version).TrimStart('v'))
  if ($actual.Major -lt $requiredMajor) {
    Fail "Node.js $engine is required; found $actual."
  }

  $null = Get-PnpmCommand

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker Desktop is required. Install it, complete first-run setup, then rerun.'
  }

  & docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    return
  }

  $desktop = Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path -LiteralPath $desktop) {
    Write-Host 'Starting Docker Desktop and waiting for its daemon...'
    Start-Process -FilePath $desktop -WindowStyle Hidden | Out-Null

    for ($attempt = 1; $attempt -le 30; $attempt++) {
      Start-Sleep -Seconds 2
      & docker info *> $null
      if ($LASTEXITCODE -eq 0) {
        return
      }
    }
  }

  Fail 'Docker Desktop is installed but its daemon is unavailable. Start it and complete its first-run requirements.'
}
