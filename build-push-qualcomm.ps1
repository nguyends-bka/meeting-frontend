# Build frontend Docker image locally for Qualcomm (ARM64).
# Sử dụng Docker Buildx để cross-build sang linux/arm64.
# Mặc định lưu thành file nén frontend-qualcomm.tar.

param(
    [string]$ImageName = "nguyends/frontend-qualcomm",
    [string]$Tag = "latest",
    [string]$ApiUrl = "http://100.101.128.127:3001",
    [string]$VirtualMicWsUrl = "",
    [string]$TarFile = "frontend-qualcomm.tar",
    [string]$Platform = "linux/amd64",
    [switch]$NoSave
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$FullImage = "${ImageName}:${Tag}"
Write-Host "Building Qualcomm ($Platform) Image: $FullImage" -ForegroundColor Cyan
Write-Host "  NEXT_PUBLIC_API_URL=$ApiUrl" -ForegroundColor Gray

# Kiểm tra Buildx
$buildxCheck = docker buildx version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Docker Buildx is not available. Please enable Buildx to build images."
}

# Xây dựng tham số build
$buildArgs = @(
    "buildx", "build",
    "--platform", $Platform,
    "--pull",
    "--no-cache",
    "-t", $FullImage,
    "--build-arg", "NEXT_PUBLIC_API_URL=$ApiUrl"
)

if ($VirtualMicWsUrl) {
    $buildArgs += "--build-arg", "NEXT_PUBLIC_VIRTUAL_MIC_WS_URL=$VirtualMicWsUrl"
}

# Nạp vào docker daemon cục bộ để có thể save sau đó
$buildArgs += "--load"
$buildArgs += "-f", "Dockerfile", "."

& docker $buildArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Build $Platform OK: $FullImage" -ForegroundColor Green

if (-not $NoSave) {
    $TarPath = Join-Path $PSScriptRoot $TarFile
    if (Test-Path $TarPath) { Remove-Item $TarPath }
    Write-Host "Saving image to $TarPath ..." -ForegroundColor Cyan
    & docker save $FullImage -o $TarPath
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Saved successfully: $TarPath" -ForegroundColor Green
    Write-Host "Copy to server: scp $TarFile ai@100.101.128.127:~/nguyends/BKMeeting/" -ForegroundColor Green
}
