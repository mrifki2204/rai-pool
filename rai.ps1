# rai.ps1 - RAI management CLI (Windows)
# Usage: .\rai.ps1 [start|stop|restart|status|logs]

param(
  [Parameter(Position = 0)][string]$Command = "help"
)

$ErrorActionPreference = "Stop"

$ProjectDir = if ($env:POOLPROX_HOME -and (Test-Path $env:POOLPROX_HOME)) {
  $env:POOLPROX_HOME
} else {
  Split-Path -Parent $MyInvocation.MyCommand.Path
}

$PidFile = Join-Path $ProjectDir ".rai.pid"
$LogFile = Join-Path $ProjectDir ".rai.log"
$EnvFile = Join-Path $ProjectDir ".env"
$BunExe = "C:\Users\Administrator\AppData\Roaming\npm\node_modules\bun\bin\bun.exe"

function Get-EnvValue([string]$key, [string]$default) {
  if (-not (Test-Path $EnvFile)) { return $default }
  $line = Select-String -Path $EnvFile -Pattern "^$key=" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($line) { return ($line.Line -replace "^$key=", "").Trim('"').Trim("'") }
  return $default
}

function Test-Running {
  if (-not (Test-Path $PidFile)) { return $false }
  $procId = Get-Content $PidFile -ErrorAction SilentlyContinue
  if (-not $procId) { return $false }
  try {
    $p = Get-Process -Id $procId -ErrorAction Stop
    return $true
  } catch {
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    return $false
  }
}

function Invoke-Start {
  $port = Get-EnvValue "PORT" "1930"

  if (Test-Running) {
    Write-Host "RAI already running (PID $(Get-Content $PidFile))" -ForegroundColor Yellow
    Write-Host "  Dashboard: http://localhost:$port"
    return
  }

  Write-Host "Starting RAI on port $port..."

  # Kill any leftover bun processes
  Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force

  $proc = Start-Process -FilePath $BunExe -ArgumentList "scripts/watchdog.ts" `
    -WorkingDirectory $ProjectDir `
    -RedirectStandardOutput $LogFile -RedirectStandardError "$LogFile.err" `
    -WindowStyle Hidden -PassThru

  $proc.Id | Out-File -FilePath $PidFile -Encoding ascii
  Start-Sleep -Seconds 4

  if (-not $proc.HasExited) {
    Write-Host "RAI started (PID $($proc.Id))" -ForegroundColor Green
    Write-Host "  Dashboard: http://localhost:$port"
    Write-Host "  API Key:   $(Get-EnvValue 'API_KEY' 'pool-proxy-secret-key')"
    Write-Host "  Logs:      .\rai.ps1 logs"
  } else {
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    Write-Host "Failed to start. Check logs at $LogFile" -ForegroundColor Red
    Get-Content $LogFile -Tail 10 -ErrorAction SilentlyContinue
  }
}

function Invoke-Stop {
  Write-Host "Stopping RAI..."
  Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force
  Remove-Item $PidFile -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Write-Host "RAI stopped"
}

function Invoke-Status {
  $port = Get-EnvValue "PORT" "1930"
  if (Test-Running) {
    $procId = Get-Content $PidFile
    Write-Host "RAI is running (PID $procId)" -ForegroundColor Green
    Write-Host "  Dashboard: http://localhost:$port"
  } else {
    Write-Host "RAI is not running" -ForegroundColor Red
  }
}

function Invoke-Logs {
  if (-not (Test-Path $LogFile)) {
    Write-Host "No logs yet"
    return
  }
  Get-Content $LogFile -Tail 30
}

switch ($Command.ToLower()) {
  "start"   { Invoke-Start }
  "stop"    { Invoke-Stop }
  "restart" { Invoke-Stop; Invoke-Start }
  "status"  { Invoke-Status }
  "logs"    { Invoke-Logs }
  default {
    Write-Host "rai - Pool Proxy Management CLI"
    Write-Host ""
    Write-Host "  .\rai.ps1 start    Start the server"
    Write-Host "  .\rai.ps1 stop     Stop the server"
    Write-Host "  .\rai.ps1 restart  Restart the server"
    Write-Host "  .\rai.ps1 status   Show server status"
    Write-Host "  .\rai.ps1 logs     View server logs"
  }
}
