# Image Audit & Mapping Methodology

Reference document for card image extraction, mapping, and auditing across all TCG sets.

## Extraction Methods (Ranked by Quality)

### ✅ Method 1: pdftoppm (BEST — use this)
Renders PDF pages as RGB images, then crop individual cards.
- **Output:** RGB PNG, correct colors, high resolution
- **Command:** `pdftoppm -png -r 300 input.pdf output_prefix`
- **Post-process:** Crop individual cards from rendered pages using grid positions
- **Why it works:** Renders through the PDF engine which handles CMYK→RGB properly

### ❌ Method 2: pdfimages (DO NOT USE for display)
Extracts raw embedded images from PDF.
- **Output:** CMYK JPEG — browsers display as black/white or wrong colors
- **Problem:** One Piece card PDFs use CMYK color space for print
- **Use only for:** Backup/archival of raw data, not for display
- **Conversion attempts that failed:**
  - Pillow `img.convert('RGB')` — washed out colors
  - ImageMagick `convert -colorspace sRGB` — still wrong
  - Manual CMYK inversion `255-C, 255-M, 255-Y` — slightly better but still off
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
