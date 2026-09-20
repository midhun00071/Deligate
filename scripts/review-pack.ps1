$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDirectory = Join-Path $projectRoot 'review-packs'
$archivePath = Join-Path $outputDirectory "$timestamp-review.zip"
$stagingDirectory = Join-Path ([IO.Path]::GetTempPath()) "deligate-review-$timestamp"

function Copy-ProjectFile([string] $RelativePath) {
  $source = Join-Path $projectRoot $RelativePath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
  $destination = Join-Path $stagingDirectory $RelativePath
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}

Set-Location $projectRoot
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

try {
  $trackedChanges = & git diff --name-only HEAD
  $untrackedFiles = & git ls-files --others --exclude-standard
  foreach ($path in @($trackedChanges) + @($untrackedFiles) | Sort-Object -Unique) {
    if ($path) { Copy-ProjectFile $path }
  }
  & git status --short | Set-Content -LiteralPath (Join-Path $stagingDirectory 'git-status.txt')
  & git diff --stat HEAD | Set-Content -LiteralPath (Join-Path $stagingDirectory 'git-diff-stat.txt')
  & git diff HEAD | Set-Content -LiteralPath (Join-Path $stagingDirectory 'changes.patch')
  & git diff --name-status --diff-filter=D HEAD | Set-Content -LiteralPath (Join-Path $stagingDirectory 'deleted-files.txt')
  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal
  Write-Host "Created $archivePath"
} finally {
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
