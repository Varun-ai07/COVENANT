# COVENANT Logo Assets

Official logo files for the COVENANT Protocol.

## Files

| File | Size | Use Case |
|------|------|----------|
| `logo-dark.svg` | 200x200 | Main logo (dark theme) |
| `logo-light.svg` | 200x200 | Light theme variant |
| `logo-transparent.svg` | 200x200 | Transparent background |
| `logo-icon.svg` | 32x32 | Favicon (standard) |
| `logo-icon-16.svg` | 16x16 | Favicon (small) |
| `logo-wordmark.svg` | 400x100 | Full logo + text (dark) |
| `logo-wordmark-light.svg` | 400x100 | Full logo + text (light) |

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Amber 500 | `#F59E0B` | Primary gradient |
| Amber 600 | `#D97706` | Primary gradient end |
| Amber 300 | `#FCD34D` | Core highlight |
| Background Dark | `#0F0F1A` | Dark backgrounds |

## Usage

### Markdown/README
```markdown
![COVENANT](assets/logo/logo-wordmark.svg)
```

### HTML
```html
<img src="assets/logo/logo-dark.svg" alt="COVENANT" width="200">
```

### Favicon
Convert to ICO/PNG using:
```bash
# Using ImageMagick
convert logo-icon.svg favicon.ico
convert logo-icon-16.svg favicon-16x16.png
convert logo-icon.svg favicon-32x32.png

# Or use online tools like:
# - https://realfavicongenerator.net/
# - https://favicon.io/
```

## Design Elements

- **Orbital Rings** — Three rings representing agent discovery, negotiation, settlement
- **Three Nodes** — AI agents orbiting the trust core
- **Central Core** — The trust layer (TaskEscrow, verification)
- **Connection Lines** — Agent-to-agent communication pathways

## Converting to PNG

```bash
# Using npx sharp-cli
npx sharp-cli resize 200 200 -i logo-dark.svg -o logo-dark.png
npx sharp-cli resize 32 32 -i logo-icon.svg -o favicon-32x32.png
npx sharp-cli resize 16 16 -i logo-icon-16.svg -o favicon-16x16.png

# Using Inkscape
inkscape logo-dark.svg --export-type=png --export-width=200 --export-filename=logo-dark.png

# Using rsvg-convert
rsvg-convert -w 200 -h 200 logo-dark.svg -o logo-dark.png
```

## Social Media Sizes

Generate these sizes for social previews:
- **GitHub Open Graph** — 1280x640
- **Twitter Card** — 1200x600
- **LinkedIn** — 1200x627
