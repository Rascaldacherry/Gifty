param([switch]$Sqlite)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBackend = Join-Path $taskRoot 'backend'
$taskFrontend = Join-Path $taskRoot 'frontend'
$taskArtifacts = Join-Path $taskRoot '.artifacts'
$taskPython = Join-Path $taskBackend '.venv\Scripts\python.exe'
$taskNodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($taskNodeCommand) {
    $taskNode = $taskNodeCommand.Source
} else {
    $taskPortableRoot = Join-Path $env:LOCALAPPDATA 'GiftyDev'
    $taskPortable = Get-ChildItem -LiteralPath $taskPortableRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'node-*-win-x64' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$taskPortable) { throw 'Install Node.js 22 LTS, then reopen the terminal and run this script again.' }
    $taskNode = Join-Path $taskPortable.FullName 'node.exe'
}
$taskNpm = Join-Path (Split-Path -Parent $taskNode) 'npm.cmd'
if (Get-NetTCPConnection -LocalPort 3000,8000 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Ports 3000 or 8000 are already in use. If Gifty is running, open http://localhost:3000. Otherwise stop the existing server first.'
}
if (!(Test-Path -LiteralPath $taskPython)) {
    python -m venv (Join-Path $taskBackend '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12+ is required.' }
}
& $taskPython -c 'import fastapi, sqlalchemy, alembic, psycopg, uvicorn' 2>$null
if ($LASTEXITCODE -ne 0) {
    & $taskPython -m pip install -r (Join-Path $taskBackend 'requirements.lock.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
}

$taskOriginal = @{}
foreach ($taskKey in @('Path','DATABASE_URL','API_ORIGIN','FRONTEND_ORIGIN','NEXT_TELEMETRY_DISABLED')) {
    $taskOriginal[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process')
}
$taskApiProcess = $null
$taskWebProcess = $null
try {
    $env:Path = (Split-Path -Parent $taskNode) + ';' + $env:Path
    $env:API_ORIGIN = 'http://127.0.0.1:8000'
    $env:FRONTEND_ORIGIN = 'http://localhost:3000'
    $env:NEXT_TELEMETRY_DISABLED = '1'
    if ($Sqlite) { $env:DATABASE_URL = 'sqlite:///' + ((Join-Path $taskBackend 'gifty.db') -replace '\\','/') }
    if (!(Test-Path -LiteralPath (Join-Path $taskFrontend 'node_modules\next'))) {
        & $taskNpm --prefix $taskFrontend ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
    & $taskPython -m alembic -c (Join-Path $taskBackend 'alembic.ini') upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Start PostgreSQL or use -Sqlite.' }
    New-Item -ItemType Directory -Path $taskArtifacts -Force | Out-Null
    $taskApiProcess = Start-Process -FilePath $taskPython -WorkingDirectory $taskBackend -ArgumentList @('-m','uvicorn','app.main:app','--reload','--host','127.0.0.1','--port','8000','--no-access-log') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskArtifacts 'backend.log') -RedirectStandardError (Join-Path $taskArtifacts 'backend-error.log')
    $taskWebProcess = Start-Process -FilePath $taskNode -WorkingDirectory $taskFrontend -ArgumentList @('node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskArtifacts 'frontend.log') -RedirectStandardError (Join-Path $taskArtifacts 'frontend-error.log')
    Write-Host 'Gifty is starting: http://localhost:3000' -ForegroundColor Magenta
    Write-Host 'Keep this terminal open. Ctrl+C stops both servers. Logs: .artifacts/'
    while (!$taskApiProcess.HasExited -and !$taskWebProcess.HasExited) { Start-Sleep -Seconds 1 }
    throw 'A server stopped. See .artifacts/backend-error.log or frontend-error.log.'
} finally {
    foreach ($taskProcess in @($taskApiProcess, $taskWebProcess)) {
        if ($taskProcess -and !$taskProcess.HasExited) {
            & "$env:SystemRoot\System32\taskkill.exe" /PID $taskProcess.Id /T /F 2>$null | Out-Null
        }
    }
    foreach ($taskKey in $taskOriginal.Keys) {
        [Environment]::SetEnvironmentVariable($taskKey, $taskOriginal[$taskKey], 'Process')
    }
}
