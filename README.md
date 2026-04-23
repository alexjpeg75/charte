# Image composition generator

This repository contains a local generator script for show compositions in multiple aspect ratios.

## Usage

```bash
php generate_output1.php \
  --logo=/absolute/path/to/logo.png \
  --keyart=/absolute/path/to/keyart.png \
  --outdir=/workspace/charte/output1
```

- `--logo` (required): PNG logo file
- `--keyart` (required): key art image file (PNG/JPG)
- `--outdir` (optional): target output folder (defaults to `./output1`)

The script writes the generated PNG files to `output1/`.

## Note about binaries

Source and generated binary assets are intentionally **not committed** in this repo.
