# FLOPS recording frames

Captured 4 CDP screencast frames (kept up to 120 JPEGs).
Stitch with ffmpeg if available:

```
ffmpeg -y -framerate 5 -i frame-%04d.jpg -c:v libvpx-vp9 -pix_fmt yuv420p ../shop-day.webm
```
