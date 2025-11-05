# Hebrew Font Rendering Fix

## Problem
Hebrew labels were displaying as placeholder boxes (▯▯▯) instead of proper Hebrew characters in the generated board images.

## Root Cause
1. **Font Issue**: `DejaVuSans.ttf` doesn't support Hebrew Unicode characters
2. **RTL Issue**: Hebrew is a Right-to-Left language that requires special bidirectional text processing

## Solution Implemented

### 1. Hebrew-Compatible Font Loading

**File: `backend/app/tools/render.py`**

Updated `_safe_font()` to try multiple Hebrew-compatible fonts in order:
- macOS fonts: Arial Unicode, Helvetica, Arial
- Linux fonts: DejaVu Sans, Liberation Sans, Noto Sans

The function now tries each font until it finds one that works on the system.

### 2. RTL Text Processing

**Installed Libraries:**
- `python-bidi==0.6.7` - Bidirectional text algorithm (Unicode BiDi)
- `arabic-reshaper==3.0.0` - Character reshaping for RTL languages

**Added Function: `_prepare_text_for_display()`**

This function:
1. Detects if text contains Hebrew (U+0590 to U+05FF) or Arabic characters
2. Applies Arabic reshaping if needed
3. Applies BiDi algorithm to reverse character order for proper RTL display
4. Returns the processed text ready for PIL rendering

### 3. Applied to All Text

RTL text processing now applied to:
- Board title
- Primary labels (Hebrew)
- Secondary labels (if any)

## How It Works

```python
# Before: "שלום" would render as boxes or backwards
# After: Text is processed for proper RTL display

def _prepare_text_for_display(text: str) -> str:
    if has_hebrew_or_arabic(text):
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)  # BiDi magic!
    return text
```

## Testing

To verify the fix:
1. Navigate to http://localhost:5173/new
2. Request a board in Hebrew: "אני צריך לוח עם פירות"
3. Generate the board
4. Download PNG/PDF
5. Hebrew text should now display correctly: תפוח, בננה, תפוז, etc.

## Files Modified

- `backend/app/tools/render.py` - Font loading and RTL text processing
- `backend/requirements.txt` - Added python-bidi and arabic-reshaper

## Font Priority (macOS)

1. **Arial Unicode.ttf** ✅ Best Hebrew support
2. **Helvetica.ttc** ✅ Good Hebrew support
3. **Arial.ttf** ✅ Standard Hebrew support

On Linux, the function will try DejaVu Sans and Liberation Sans.

## Future Improvements

1. **Custom Font Bundle**: Include Noto Sans Hebrew in the Docker image for consistent rendering
2. **Font Configuration**: Allow users to specify preferred font via environment variable
3. **Font Testing**: Add unit tests to verify Hebrew character rendering
4. **Arabic Support**: Test with Arabic text (already supported by the code)

## Technical Notes

- BiDi (Bidirectional) algorithm handles mixed LTR/RTL text (e.g., Hebrew with English numbers)
- Arabic reshaping handles character form variations (isolated, initial, medial, final)
- PIL `ImageDraw` doesn't natively support RTL, hence the need for preprocessing
- Font must support Unicode Hebrew range (U+0590-U+05FF)

## Deployment Notes

For Docker/Railway deployment, ensure the system has Hebrew fonts installed:

```dockerfile
# Add to Dockerfile if needed
RUN apt-get update && apt-get install -y \
    fonts-noto \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
```

The current Dockerfile base image (`ghcr.io/astral-sh/uv:python3.11-bookworm`) likely has basic fonts, but we may need to add Noto Sans Hebrew for best results.

