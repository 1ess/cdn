![](https://cdn.jsdelivr.net/gh/1ess/cdn/0xfee1dead.jpg)

## Convert images to WebP on Windows

Install ImageMagick once:

```powershell
winget install ImageMagick.ImageMagick
```

Open a new PowerShell window, then recursively convert all supported images. The
output WebP keeps the original pixel width and height, and the source files are
retained by default:

```powershell
.\Convert-ImagesToWebP.ps1
```

Each image produces `name.webp`. This is a direct format conversion and does not
resize the image.

To write converted images into a new root directory while retaining the complete
source subdirectory structure:

```powershell
.\Convert-ImagesToWebP.ps1 -OutputPath "D:\webp-output"
```

For example, `blogImg\2026\photo.jpg` becomes
`D:\webp-output\blogImg\2026\photo.webp`.

If a low-resolution placeholder is also wanted for page-level progressive
loading, enable it explicitly:

```powershell
.\Convert-ImagesToWebP.ps1 -GeneratePreview
```

This additionally produces a tiny `name.preview.webp` placeholder. Use the
preview first in the page, then replace it with the full image after loading.

```html
<img class="progressive" src="photo.preview.webp" data-src="photo.webp" alt="">
<style>
  .progressive { filter: blur(12px); transition: filter .25s ease; }
  .progressive.loaded { filter: none; }
</style>
<script>
  document.querySelectorAll('img.progressive').forEach((img) => {
    const full = new Image();
    full.src = img.dataset.src;
    full.onload = () => {
      img.src = full.src;
      img.classList.add('loaded');
    };
  });
</script>
```

Useful options:

```powershell
# Preview the operation without writing files
.\Convert-ImagesToWebP.ps1 -WhatIf

# Replace existing WebP outputs
.\Convert-ImagesToWebP.ps1 -Overwrite

# Use a separate output root and preserve the source directory structure
.\Convert-ImagesToWebP.ps1 -OutputPath "D:\webp-output"

# Convert successfully, then delete each source image
.\Convert-ImagesToWebP.ps1 -DeleteSource

# Also create low-resolution placeholders for page-level progressive loading
.\Convert-ImagesToWebP.ps1 -GeneratePreview

# Include GIF files (animation handling depends on the selected converter)
.\Convert-ImagesToWebP.ps1 -IncludeGif
```

WebP has no progressive encoding mode equivalent to progressive JPEG. Optional
preview files provide progressive loading at the page level: show the small
preview with blur styling, preload the full `.webp`, and swap it in when loading
completes. The full `.webp` always retains the source image dimensions.
