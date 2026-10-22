$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
# Toolchain versions are declared HERE and nowhere else. build-overlay.ps1 only
# ever looks under vendor\toolchain with version-less folder names, so bumping
# a version means editing this block alone.
$zigVersion = '0.14.1'
$zigArchiveName = "zig-x86_64-windows-$zigVersion.zip"
$sdkRevision = '18deaa52de0c425a78b329e9cb3c497281cd00ec'
$imguiRevision = '3912b3d9a9c1b3f17431aebafd86d2f40ee6e59c'

$toolchainDir = Join-Path $appRoot 'vendor/toolchain'
$sdkDir = Join-Path $toolchainDir 'reshade'
$zigDir = Join-Path $toolchainDir 'zig'
New-Item -ItemType Directory -Force -Path $toolchainDir, $sdkDir | Out-Null

# Official, pinned portable toolchain. No machine-wide installation or PATH changes.
$archive = Join-Path $toolchainDir $zigArchiveName
$compiler = Join-Path $zigDir 'zig.exe'
if (!(Test-Path -LiteralPath $compiler)) {
    if (!(Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest "https://ziglang.org/download/$zigVersion/$zigArchiveName" -OutFile $archive
    }
    $stream = [IO.File]::OpenRead($archive)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hasher.Dispose() }
    if ($digest -ne '554f5378228923ffd558eac35e21af020c73789d87afeabf4bfd16f2e6feed2c') {
        throw 'Zig archive checksum mismatch. Nothing was executed.'
    }
    # tar (bundled with Windows 10 1803+) extracts ~10x faster than
    # Expand-Archive on the ~4000 small files zig ships; fall back to the
    # managed extractor if tar is somehow missing.
    $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($tar) {
        tar -xf $archive -C $toolchainDir
        if ($LASTEXITCODE -ne 0) { throw "tar failed to extract $zigArchiveName (exit $LASTEXITCODE)." }
    } else {
        Expand-Archive -LiteralPath $archive -DestinationPath $toolchainDir -Force
    }
    if (!(Test-Path -LiteralPath $zigDir)) {
        Move-Item -LiteralPath (Join-Path $toolchainDir "zig-x86_64-windows-$zigVersion") -Destination $zigDir
    }
}

# Pinned ReShade SDK headers plus the ImGui snapshot the F8 panel was compiled
# against. Every file is fetched once; existing files are left alone so a
# second run needs no network at all.
function Fetch-Once([string]$Url, [string]$Dest) {
    if (Test-Path -LiteralPath $Dest) { return }
    Invoke-WebRequest $Url -OutFile $Dest
}

$headers = @('reshade.hpp', 'reshade_api.hpp', 'reshade_api_device.hpp', 'reshade_api_format.hpp', 'reshade_api_pipeline.hpp', 'reshade_api_resource.hpp', 'reshade_events.hpp', 'reshade_overlay.hpp')
foreach ($header in $headers) {
    Fetch-Once "https://raw.githubusercontent.com/crosire/reshade/$sdkRevision/include/$header" (Join-Path $sdkDir $header)
}
Fetch-Once "https://raw.githubusercontent.com/crosire/reshade/$sdkRevision/LICENSE.md" (Join-Path $sdkDir 'LICENSE-ReShade.md')
foreach ($header in @('imgui.h', 'imconfig.h', 'LICENSE.txt')) {
    $name = if ($header -eq 'LICENSE.txt') { 'LICENSE-ImGui.txt' } else { $header }
    Fetch-Once "https://raw.githubusercontent.com/ocornut/imgui/$imguiRevision/$header" (Join-Path $sdkDir $name)
}
Write-Output "Portable compiler and pinned ReShade SDK ready in $toolchainDir"
