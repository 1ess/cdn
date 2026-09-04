[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Position = 0)]
    [string]$Path = $PSScriptRoot,

    [string]$OutputPath,

    [ValidateRange(1, 100)]
    [int]$Quality = 82,

    [ValidateRange(1, 100)]
    [int]$PreviewQuality = 20,

    [ValidateRange(16, 2048)]
    [int]$PreviewWidth = 48,

    [switch]$DeleteSource,
    [switch]$Overwrite,
    [switch]$GeneratePreview,
    [switch]$IncludeGif
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-Converter {
    $magick = Get-Command magick -ErrorAction SilentlyContinue
    if ($magick) { return @{ Name = 'magick'; Path = $magick.Source } }

    $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($ffmpeg) { return @{ Name = 'ffmpeg'; Path = $ffmpeg.Source } }

    $cwebp = Get-Command cwebp -ErrorAction SilentlyContinue
    if ($cwebp) { return @{ Name = 'cwebp'; Path = $cwebp.Source } }

    throw @'
No supported image converter was found.

Install one of these, reopen PowerShell, and run the script again:
  winget install ImageMagick.ImageMagick
  winget install Gyan.FFmpeg

ImageMagick is recommended, especially when GIF input is needed.
'@
}

function Invoke-CheckedCommand {
    param([string]$FilePath, [string[]]$Arguments)

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Converter exited with code $LASTEXITCODE."
    }
}

function Convert-WithMagick {
    param($Converter, [System.IO.FileInfo]$Source, [string]$Destination, [int]$ImageQuality, [int]$Width)

    $arguments = @($Source.FullName)
    if ($Width -gt 0) {
        $arguments += @('-auto-orient', '-thumbnail', "${Width}x")
    }
    else {
        $arguments += '-auto-orient'
    }
    $arguments += @('-strip', '-quality', [string]$ImageQuality, $Destination)
    Invoke-CheckedCommand $Converter.Path $arguments
}

function Convert-WithFfmpeg {
    param($Converter, [System.IO.FileInfo]$Source, [string]$Destination, [int]$ImageQuality, [int]$Width)

    # FFmpeg's WebP quality scale is 0..100. Keep aspect ratio for previews.
    $arguments = @('-hide_banner', '-loglevel', 'error', '-y', '-i', $Source.FullName)
    if ($Width -gt 0) {
        $arguments += @('-vf', "scale='min($Width,iw)':-2")
    }
    $arguments += @('-frames:v', '1', '-c:v', 'libwebp', '-quality', [string]$ImageQuality, $Destination)
    Invoke-CheckedCommand $Converter.Path $arguments
}

function Convert-WithCwebp {
    param($Converter, [System.IO.FileInfo]$Source, [string]$Destination, [int]$ImageQuality, [int]$Width)

    if ($Source.Extension -ieq '.gif') {
        throw 'cwebp does not support GIF input. Install ImageMagick or FFmpeg, or omit -IncludeGif.'
    }
    $arguments = @('-quiet', '-metadata', 'none', '-q', [string]$ImageQuality)
    if ($Width -gt 0) {
        $arguments += @('-resize', [string]$Width, '0')
    }
    $arguments += @($Source.FullName, '-o', $Destination)
    Invoke-CheckedCommand $Converter.Path $arguments
}

function Convert-Image {
    param($Converter, [System.IO.FileInfo]$Source, [string]$Destination, [int]$ImageQuality, [int]$Width = 0)

    switch ($Converter.Name) {
        'magick' { Convert-WithMagick $Converter $Source $Destination $ImageQuality $Width }
        'ffmpeg' { Convert-WithFfmpeg $Converter $Source $Destination $ImageQuality $Width }
        'cwebp'  { Convert-WithCwebp  $Converter $Source $Destination $ImageQuality $Width }
    }
}

$root = (Resolve-Path -LiteralPath $Path).Path.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
$outputRoot = $root
if ($OutputPath) {
    $unresolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
    $outputRoot = [System.IO.Path]::GetFullPath($unresolvedOutput).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
}
$converter = Find-Converter
$extensions = @('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff')
if ($IncludeGif) { $extensions += '.gif' }

$images = @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    $extensions -contains $_.Extension.ToLowerInvariant() -and
    $_.BaseName -notlike '*.preview'
})

Write-Host "Converter : $($converter.Name)"
Write-Host "Source    : $root"
Write-Host "Output    : $outputRoot"
Write-Host "Images    : $($images.Count)"

$converted = 0
$skipped = 0
$failed = 0

foreach ($image in $images) {
    $relativePath = $image.FullName.Substring($root.Length).TrimStart([char]'\', [char]'/')
    $relativeDirectory = [System.IO.Path]::GetDirectoryName($relativePath)
    $destinationDirectory = if ($relativeDirectory) {
        Join-Path $outputRoot $relativeDirectory
    }
    else {
        $outputRoot
    }
    $webp = Join-Path $destinationDirectory ($image.BaseName + '.webp')
    $preview = Join-Path $destinationDirectory ($image.BaseName + '.preview.webp')

    if ((Test-Path -LiteralPath $webp) -and -not $Overwrite) {
        Write-Host "SKIP  $($image.FullName) (WebP already exists)"
        $skipped++
        continue
    }

    try {
        if ($PSCmdlet.ShouldProcess($image.FullName, "convert to $webp")) {
            if (-not (Test-Path -LiteralPath $destinationDirectory)) {
                New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
            }
            Convert-Image $converter $image $webp $Quality
            if ($GeneratePreview) {
                Convert-Image $converter $image $preview $PreviewQuality $PreviewWidth
            }
            if ($DeleteSource) {
                Remove-Item -LiteralPath $image.FullName
            }
            Write-Host "OK    $($image.FullName)"
            $converted++
        }
    }
    catch {
        Write-Warning "FAIL  $($image.FullName): $($_.Exception.Message)"
        $failed++
    }
}

Write-Host "Done. Converted: $converted; skipped: $skipped; failed: $failed"
if ($failed -gt 0) { exit 1 }
