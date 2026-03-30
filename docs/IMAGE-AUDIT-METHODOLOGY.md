# Image Audit & Mapping Methodology

Reference document for card image extraction, mapping, and auditing across all TCG sets.

## Extraction Methods (Ranked by Quality)

### ✅ Method 1: pdfimages + Inverted CMYK→RGB (BEST — use this)
Extracts perfectly-cropped individual card images, then converts colors.
- **Step 1:** `pdfimages -j input.pdf output_prefix` — extracts raw CMYK JPEGs
- **Step 2:** Filter by size (cards ~377x525, discard page backgrounds ~1701x2386)
- **Step 3:** Apply inverted CMYK→RGB formula (see below)
- **Output:** Perfectly cropped RGB PNGs with correct colors
- **Why it works:** pdfimages gives exact card boundaries; the CMYK inversion fixes colors

### ❌ Method 2: pdftoppm (correct colors, bad cropping)
Renders full PDF pages as RGB images.
- **Command:** `pdftoppm -png -r 300 input.pdf output_prefix`
- **Problem:** Card positions vary per page — automated grid cropping is unreliable
- **Colors are correct** but you'd need manual cropping or complex contour detection
- **Use only for:** Visual reference, not automated extraction

### ❌ Method 3: pdfimages without CMYK fix (DO NOT USE)
Raw extraction without color conversion.
- **Output:** CMYK JPEG — browsers display as black/white or wrong colors
- **Conversion attempts that failed:**
  - Pillow `img.convert('RGB')` — doesn't handle inverted CMYK
  - ImageMagick `convert -colorspace sRGB` — same issue
  - Pillow with ICC profiles — no embedded profiles in these PDFs

### ⚠️ Method 3: Web scraping (fallback)
Download images from official sites or retailers.
- **Sources:** onepiece-cardgame.com, tcghobby.com, PriceCharting
- **Problem:** Not all cards available, varying quality, copyright concerns
- **Use only for:** Cards not in any PDF, or to verify specific cards

## Audit Workflow

### Setup
1. Extract images using Method 1 (pdftoppm)
2. Generate audit HTML page with all images in PDF order
3. Human reviews each card, inputs the PDF label text
4. AI translates labels and maps to card IDs

### Audit Page Features
- Three buttons: ✅ Correct, ❌ Wrong, 📝 Save
- Export to clipboard for batch processing
- Notes embedded in HTML on regeneration (survives reload)
- Confirmed cards sorted to bottom after AI processes batch

### File Organization
```
onepiece/images/
├── don/                    # Live images used by the website
│   ├── DON-GOLD.png       # Mapped card images
│   ├── _originals/         # NEVER DELETE — backup of all original PNGs
│   ├── _pdf_cards/         # Raw CMYK JPEGs from pdfimages (archival)
│   ├── _pdf_cards_rgb/     # Failed CMYK→RGB conversions (can delete)
│   └── _pdf_rendered/      # ✅ Good RGB PNGs from pdftoppm (use these)
├── audit/
│   ├── don-audit.html      # Current audit page
│   ├── don-audit-notes.json # Saved human notes
│   └── don-pdf-index.html  # PDF image index
```

### Rules
1. **Never delete `_originals/`** — these are the pre-audit backup
2. **Never delete `_pdf_cards/`** — raw archival data
3. **`_pdf_rendered/` is the source of truth** for new image mapping
4. **All mapping changes go through the audit page** — no direct file renames
5. **Human notes are saved in `don-audit-notes.json`** and embedded in HTML on regeneration

## Applying to Other Sets
This same methodology works for any card set:
1. Find the official PDF card list
2. Extract with `pdftoppm -png -r 300`
3. Crop cards from rendered pages
4. Generate audit HTML
5. Human maps labels → card IDs
6. AI processes batch and updates database

## Known Issues
- PDF grid positions may vary between sets (adjust crop coordinates)
- Some PDFs have variable cards-per-page (not always 3×3)
- Gold/foil cards may render differently than physical appearance
- Some DON cards are event/region exclusives not in any PDF

## CMYK Conversion Breakthrough

The key discovery: PDF-embedded CMYK images have **inverted** channel values (255 = 0% ink, 0 = 100% ink).

### Working Formula
```python
arr = 255 - np.array(cmyk_image)  # INVERT first
c, m, y, k = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
r = (255 * (1 - c/255) * (1 - k/255)).astype(np.uint8)
g = (255 * (1 - m/255) * (1 - k/255)).astype(np.uint8)
b = (255 * (1 - y/255) * (1 - k/255)).astype(np.uint8)
```

### What Failed
- `PIL.Image.convert('RGB')` — doesn't handle inverted CMYK
- `ImageMagick convert -colorspace sRGB` — same issue
- `pdftoppm` page rendering + grid cropping — correct colors but card positions vary per page, cropping unreliable

### What Works
1. `pdfimages` to extract individual CMYK cards (perfectly cropped)
2. Invert all CMYK channels (255 - value)
3. Apply standard CMYK→RGB formula
4. Filter out page backgrounds by size (cards ~377x525, backgrounds ~1701x2386)
