param([string]$RuntimeRoot = $env:TESLANG_QA_ROOT)
$ErrorActionPreference = 'Stop'
# Optional machine-local runtime path; source and package versions stay in the repository.
$keys = @('PLAYWRIGHT_BROWSERS_PATH', 'QA_OUTPUT_DIR', 'TEMP', 'TMP')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
  if ($RuntimeRoot) {
    $qaPath = [IO.Path]::GetFullPath($RuntimeRoot)
    if (-not (Test-Path -LiteralPath ([IO.Path]::GetPathRoot($qaPath)))) { throw "QA runtime drive is not connected: $qaPath" }
    New-Item -ItemType Directory -Path (Join-Path $qaPath 'temp'), (Join-Path $qaPath 'test-results') -Force | Out-Null
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $qaPath 'playwright'
    $env:QA_OUTPUT_DIR = Join-Path $qaPath 'test-results'
    $env:TEMP = Join-Path $qaPath 'temp'
    $env:TMP = $env:TEMP
  }
  & npm.cmd run test:e2e
  $qaExit = $LASTEXITCODE
} finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
exit $qaExit
