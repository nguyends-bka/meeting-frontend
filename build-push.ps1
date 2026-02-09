# Build frontend Docker image on LOCAL. Use -NoPush to only build (then docker save + scp).
param(
    [string]$ImageName = $env:IMAGE_NAME,
    [string]$Tag = $env:IMAGE_TAG,
    [string]$ApiUrl = $env:NEXT_PUBLIC_API_URL,
    [string]$VirtualMicWsUrl = $env:NEXT_PUBLIC_VIRTUAL_MIC_WS_URL,
    [switch]$NoPush
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not $ImageName) { $ImageName = "nguyends/frontend" }
if (-not $Tag) { $Tag = "latest" }
if (-not $ApiUrl) { $ApiUrl = "https://meeting.soict.io" }
$FullImage = "${ImageName}:${Tag}"
Write-Host "Building: $FullImage" -ForegroundColor Cyan
Write-Host "  NEXT_PUBLIC_API_URL=$ApiUrl" -ForegroundColor Gray
$buildArgs = @(
    "build",
    "-t", $FullImage,
    "--build-arg", "NEXT_PUBLIC_API_URL=$ApiUrl"
)
if ($VirtualMicWsUrl) {
    $buildArgs += "--build-arg", "NEXT_PUBLIC_VIRTUAL_MIC_WS_URL=$VirtualMicWsUrl"
}
$buildArgs += "-f", "Dockerfile", "."
& docker $buildArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Build OK: $FullImage" -ForegroundColor Green
if ($NoPush) {
    $TarPath = Join-Path $PSScriptRoot "frontend.tar"
    Write-Host "Saving image to $TarPath ..." -ForegroundColor Cyan
    & docker save $FullImage -o $TarPath
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Saved: $TarPath" -ForegroundColor Green
    exit 0
}
Write-Host "Pushing: $FullImage" -ForegroundColor Cyan
& docker push $FullImage
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done." -ForegroundColor Green
