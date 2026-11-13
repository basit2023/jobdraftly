param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [string]$DeployRoot = "C:\JobDraftly",
  [string]$ReleaseId = (Get-Date -Format "yyyyMMddHHmmss")
)

$ErrorActionPreference = "Stop"
$source = (Resolve-Path -LiteralPath $SourcePath).Path
$root = [System.IO.Path]::GetFullPath($DeployRoot)
if ($root -in @("C:\", "E:\") -or $root.Length -lt 4) { throw "DeployRoot is too broad." }
$release = Join-Path $root "releases\$ReleaseId"
$sharedEnvironment = Join-Path $root "shared\jobdraftly.production.env"
if (-not (Test-Path -LiteralPath $sharedEnvironment -PathType Leaf)) { throw "Missing protected production environment file: $sharedEnvironment" }
if (Test-Path -LiteralPath $release) { throw "Release already exists: $release" }

New-Item -ItemType Directory -Force -Path $release | Out-Null
$robocopyArgs = @($source, $release, "/E", "/XD", ".git", "node_modules", ".next", "backups", "test-results", "playwright-report", "/XF", ".env", ".env.local", ".env.production", "/NFL", "/NDL", "/NJH", "/NJS")
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Source copy failed with robocopy code $LASTEXITCODE." }

Push-Location $release
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
  & node.exe --env-file=$sharedEnvironment node_modules\prisma\build\index.js generate
  if ($LASTEXITCODE -ne 0) { throw "Prisma generation failed." }
  & node.exe --env-file=$sharedEnvironment node_modules\next\dist\bin\next build
  if ($LASTEXITCODE -ne 0) { throw "Next.js build failed." }
  & node.exe --env-file=$sharedEnvironment scripts\production-preflight.mjs
  if ($LASTEXITCODE -ne 0) { throw "Production preflight failed." }
  & node.exe --env-file=$sharedEnvironment scripts\backup-mysql.mjs
  if ($LASTEXITCODE -ne 0) { throw "Pre-migration backup failed." }
  & node.exe --env-file=$sharedEnvironment node_modules\prisma\build\index.js migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "Database migration failed." }
} finally {
  Pop-Location
}

Write-Output "Release prepared at $release. Stop services, repoint $(Join-Path $root 'current') to this release, start services, then run health and smoke checks. The script intentionally does not switch traffic or DNS."
