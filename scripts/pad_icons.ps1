Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\WEBSITE\Team-RotorFPV-Website\public\TRFPV_Assets\JUSTLOGO.png"
$dstDir = "c:\Users\sarth\Documents\MY DOCUMENTS\VIT\Team Rotor Fpv\App\assets\images"

if (-not (Test-Path $srcPath)) {
    Write-Host "Source image not found: $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Original dimensions: $($srcImg.Width) x $($srcImg.Height)"

$maxDim = [Math]::Max($srcImg.Width, $srcImg.Height)
# Make canvas 2.25x larger so diagonal propeller tips sit comfortably inside center 66% circle safe zone
$canvasSize = [int]($maxDim * 2.25)
$bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::White)

$x = [int](($canvasSize - $srcImg.Width) / 2)
$y = [int](($canvasSize - $srcImg.Height) / 2)
$graphics.DrawImage($srcImg, $x, $y, $srcImg.Width, $srcImg.Height)

$bmp.Save("$dstDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("$dstDir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("$dstDir\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("$dstDir\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$srcImg.Save("$dstDir\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bmp.Dispose()
$srcImg.Dispose()

Write-Host "Padded icons generated successfully! New Canvas size: $canvasSize x $canvasSize"
