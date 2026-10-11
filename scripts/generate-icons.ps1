Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null

function New-DeliveryIcon([int]$size, [string]$filename) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($size / 512, $size / 512)
    $orange = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#ef704f'))
    $cream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#fff8ed'))
    $green = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#437352'))
    $dark = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#26392b'))
    $graphics.FillRectangle($orange, 0, 0, 512, 512)
    $graphics.FillEllipse($cream, 105, 105, 302, 302)
    $graphics.FillEllipse($green, 165, 175, 82, 110)
    $graphics.FillEllipse($green, 268, 159, 80, 118)
    $graphics.FillEllipse($orange, 225, 193, 65, 62)
    $graphics.FillPie($dark, 151, 206, 210, 184, 0, 180)
    $graphics.FillRectangle($dark, 164, 286, 184, 15)
    $graphics.FillEllipse($cream, 175, 214, 160, 96)
    $graphics.FillPie($dark, 151, 206, 210, 184, 0, 180)
    $bitmap.Save((Join-Path $iconDirectory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    $orange.Dispose(); $cream.Dispose(); $green.Dispose(); $dark.Dispose()
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-DeliveryIcon 192 'icon-192.png'
New-DeliveryIcon 512 'icon-512.png'
New-DeliveryIcon 512 'icon-maskable-512.png'
