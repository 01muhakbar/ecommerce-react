$ErrorActionPreference = "Stop"

function Write-Pass($message) {
  Write-Host "[PASS] $message" -ForegroundColor Green
}

function Write-Fail($message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Write-Info($message) {
  Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-WarnMsg($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

$hasFailure = $false

Write-Info "DB health check started"

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlCommand) {
  $xamppMysql = "c:\xampp\mysql\bin\mysql.exe"
  if (Test-Path $xamppMysql) {
    $mysqlExe = $xamppMysql
    Write-Info "mysql command not found in PATH, using $xamppMysql"
  } else {
    Write-Fail "mysql command is not available (PATH or c:\xampp\mysql\bin\mysql.exe)."
    exit 1
  }
} else {
  $mysqlExe = $mysqlCommand.Source
  Write-Info "Using mysql at $mysqlExe"
}

try {
  & $mysqlExe -u root -e "SELECT 1" | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Pass "MySQL query check passed: SELECT 1"
  } else {
    Write-Fail "MySQL query check failed with exit code $LASTEXITCODE"
    $hasFailure = $true
  }
} catch {
  Write-Fail "MySQL query check failed: $($_.Exception.Message)"
  $hasFailure = $true
}

$healthUrl = "http://localhost:3001/api/health"
try {
  $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
  if ($response.StatusCode -ne 200) {
    Write-Fail "API health endpoint returned status $($response.StatusCode)"
    $hasFailure = $true
  } else {
    $parsed = $null
    try {
      $parsed = $response.Content | ConvertFrom-Json
    } catch {
      $parsed = $null
    }

    if ($parsed -and $parsed.ok -eq $true -and $parsed.db -eq "connected") {
      Write-Pass "API health check passed: /api/health reports db=connected"
    } elseif ($parsed -and $parsed.ok -eq $true) {
      Write-WarnMsg "API health endpoint is up but db is not reported as connected."
    } else {
      Write-WarnMsg "API health endpoint is up but response is unexpected."
    }
  }
} catch {
  Write-WarnMsg "Skipped API health check ($healthUrl not reachable). Start server to validate this check."
}

if ($hasFailure) {
  Write-Fail "DB health check finished with failures."
  exit 1
}

Write-Pass "DB health check finished successfully."
exit 0
