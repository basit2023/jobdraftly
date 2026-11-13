param(
  [Parameter(Mandatory = $true)][ValidatePattern("^[A-Za-z0-9._-]+$")][string]$ReleaseId,
  [string]$DeployRoot = "C:\JobDraftly",
  [string]$AppServiceName = "jobdraftly-app-staging",
  [string]$WorkerServiceName = "jobdraftly-worker-staging",
  [string]$HealthBaseUrl = "http://127.0.0.1:3000",
  [ValidateRange(30, 600)][int]$HealthTimeoutSeconds = 300
)

$ErrorActionPreference = "Stop"

function Get-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
}

function Assert-PathBelow([string]$Path, [string]$Parent, [string]$Description) {
  $fullPath = Get-FullPath $Path
  $fullParent = Get-FullPath $Parent
  if (-not $fullPath.StartsWith("$fullParent\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Description must be inside $fullParent. Resolved path: $fullPath"
  }
}

function Wait-Healthy([string]$Url, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = "No request attempted."
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -eq 200) {
        Write-Output "Healthy: $Url"
        return
      }
      $lastError = "HTTP $($response.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Seconds 5
  }
  throw "Health check timed out for $Url. Last error: $lastError"
}

function Remove-Junction([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if (-not ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw "Refusing to remove non-junction path: $Path"
  }
  Remove-Item -LiteralPath $Path -Force
}

$root = Get-FullPath $DeployRoot
if ($root -in @("C:", "E:") -or $root.Length -lt 4) { throw "DeployRoot is too broad." }
$releasesRoot = Join-Path $root "releases"
$release = Join-Path $releasesRoot $ReleaseId
$current = Join-Path $root "current"
$incoming = Join-Path $root "current.incoming"
$previous = Join-Path $root "current.previous"

Assert-PathBelow $release $releasesRoot "Release"
foreach ($path in @($current, $incoming, $previous)) { Assert-PathBelow $path $root "Deployment junction" }

if (-not (Test-Path -LiteralPath $release -PathType Container)) { throw "Release does not exist: $release" }
if (-not (Test-Path -LiteralPath (Join-Path $release ".next\BUILD_ID") -PathType Leaf)) { throw "Release has no Next.js build: $release" }
foreach ($serviceName in @($AppServiceName, $WorkerServiceName)) {
  if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) { throw "Windows service is not installed: $serviceName" }
}
if (Test-Path -LiteralPath $current) {
  $currentItem = Get-Item -LiteralPath $current -Force
  if (-not ($currentItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    throw "Current deployment path is not a junction: $current"
  }
  $currentTarget = @($currentItem.Target)[0]
  if ([string]::IsNullOrWhiteSpace($currentTarget)) { throw "Current deployment junction has no target: $current" }
  if (-not [System.IO.Path]::IsPathRooted($currentTarget)) { $currentTarget = Join-Path $root $currentTarget }
  Assert-PathBelow $currentTarget $releasesRoot "Current release target"
}

Remove-Junction $incoming
if (Test-Path -LiteralPath $previous) {
  throw "A previous deployment junction still exists at $previous. Inspect it before deploying again."
}
New-Item -ItemType Junction -Path $incoming -Target $release | Out-Null

$hadPreviousRelease = Test-Path -LiteralPath $current
$promotionSucceeded = $false
$currentMovedToPrevious = $false
$incomingActivated = $false
try {
  Stop-Service -Name $WorkerServiceName -Force
  Stop-Service -Name $AppServiceName -Force

  if ($hadPreviousRelease) {
    Move-Item -LiteralPath $current -Destination $previous
    $currentMovedToPrevious = $true
  }
  Move-Item -LiteralPath $incoming -Destination $current
  $incomingActivated = $true

  Start-Service -Name $AppServiceName
  Wait-Healthy "$($HealthBaseUrl.TrimEnd('/'))/api/health/live" $HealthTimeoutSeconds
  Wait-Healthy "$($HealthBaseUrl.TrimEnd('/'))/api/health/ready" $HealthTimeoutSeconds

  Start-Service -Name $WorkerServiceName
  Wait-Healthy "$($HealthBaseUrl.TrimEnd('/'))/api/health/worker" $HealthTimeoutSeconds
  $promotionSucceeded = $true
} finally {
  if ($promotionSucceeded) {
    Remove-Junction $previous
    Write-Output "Release $ReleaseId is active and healthy."
  } else {
    Write-Warning "Promotion failed. Restoring the previous application release. Database migrations are not reversed."
    Stop-Service -Name $WorkerServiceName -Force -ErrorAction SilentlyContinue
    Stop-Service -Name $AppServiceName -Force -ErrorAction SilentlyContinue
    if ($incomingActivated) { Remove-Junction $current }
    if ($currentMovedToPrevious -and (Test-Path -LiteralPath $previous)) {
      Move-Item -LiteralPath $previous -Destination $current
    }
    if (Test-Path -LiteralPath $current) {
      Start-Service -Name $AppServiceName
      Start-Service -Name $WorkerServiceName
    }
    Remove-Junction $incoming
  }
}
