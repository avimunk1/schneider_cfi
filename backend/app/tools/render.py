import uuid
from pathlib import Path
from typing import List, Dict, Tuple

from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A5
from bidi.algorithm import get_display
import arabic_reshaper


def _grid_for_layout(layout: str) -> Tuple[int, int]:
    if layout == "2x4":
        return 2, 4  # rows, cols
    if layout == "3x3":
        return 3, 3
    return 2, 4


def _safe_font(size: int):
    """Load a font that supports Hebrew characters"""
    # Try Hebrew-compatible fonts in order of preference
    font_options = [
        # macOS fonts
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Arial.ttf",
        # Linux fonts
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        # Noto Sans (good Hebrew support)
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "Arial.ttf",
        "DejaVuSans.ttf",
    ]
    
    for font_path in font_options:
        try:
            font = ImageFont.truetype(font_path, size)
            print(f"[render] Loaded font: {font_path}")
            return font
        except (OSError, IOError):
            continue
    
    # Fallback to default (may not support Hebrew)
    print(f"[render] Warning: Could not load Hebrew-compatible font, using default")
    return ImageFont.load_default()


def _prepare_text_for_display(text: str) -> str:
    """Prepare text for display, handling RTL languages like Hebrew and Arabic"""
    if not text:
        return text
    
    # Check if text contains Hebrew or Arabic characters
    has_hebrew = any('\u0590' <= c <= '\u05FF' for c in text)
    has_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
    
    if has_hebrew or has_arabic:
        # For Hebrew/Arabic, we need to reverse the text for PIL rendering
        # PIL doesn't natively support RTL, so we reverse the string
        # This works because Hebrew/Arabic fonts render characters correctly
        # when displayed in reversed order
        try:
            # Reshape Arabic (connects letters properly)
            reshaped = arabic_reshaper.reshape(text)
            # Apply bidi algorithm
            return get_display(reshaped)
        except Exception as e:
            # Fallback: simple reversal for pure Hebrew
            print(f"[render] BiDi processing failed: {e}, using simple reversal")
            return text[::-1]
    
    return text


def render_board(
    layout: str,
    title: str,
    entities: List[str],
    image_paths: List[str],
    labels_per_entity: List[Dict[str, str]],
    assets_dir: str,
) -> Tuple[str, str]:
    rows, cols = _grid_for_layout(layout)
    cell_w, cell_h = 400, 420
    margin, gutter = 40, 20

    width = margin * 2 + cols * cell_w + (cols - 1) * gutter
    height = margin * 2 + rows * cell_h + (rows - 1) * gutter + 80  # title area

    board = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(board)
    font_title = _safe_font(40)
    font_label = _safe_font(22)

    # Title (prepare for RTL if needed)
    display_title = _prepare_text_for_display(title)
    tb = draw.textbbox((0, 0), display_title, font=font_title)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    draw.text(((width - tw) / 2, margin / 2), display_title, fill=(20, 20, 20), font=font_title)

    # Place cells
    assets = Path(assets_dir)
    for idx, (entity, labels) in enumerate(zip(entities, labels_per_entity)):
        r = idx // cols
        c = idx % cols
        if r >= rows:
            break
        x = margin + c * (cell_w + gutter)
        y = margin + 80 + r * (cell_h + gutter)

        # Cell background
        draw.rounded_rectangle([x, y, x + cell_w, y + cell_h], radius=16, fill=(245, 247, 250), outline=(220, 224, 230))

        # Image
        img_file = assets / image_paths[idx]
        try:
            img = Image.open(img_file).convert("RGB")
        except Exception:
            img = Image.new("RGB", (512, 512), color=(230, 230, 230))
        # Fit image into area (with some padding)
        area_h = cell_h - 60
        area_w = cell_w - 20
        img.thumbnail((area_w, area_h))
        ix = x + (cell_w - img.width) // 2
        iy = y + 10
        board.paste(img, (ix, iy))

        # Labels: Hebrew on first line, second language (if any) below
        langs = list(labels.keys())
        line1 = labels.get(langs[0], entity)
        line2 = labels.get(langs[1], "") if len(langs) > 1 else ""

        # Prepare text for RTL display
        display_line1 = _prepare_text_for_display(line1)
        lb1 = draw.textbbox((0, 0), display_line1, font=font_label)
        lw1, lh1 = lb1[2] - lb1[0], lb1[3] - lb1[1]
        draw.text((x + (cell_w - lw1) / 2, y + cell_h - 45), display_line1, fill=(30, 30, 30), font=font_label)

        if line2:
            display_line2 = _prepare_text_for_display(line2)
            lb2 = draw.textbbox((0, 0), display_line2, font=font_label)
            lw2, _ = lb2[2] - lb2[0], lb2[3] - lb2[1]
            draw.text((x + (cell_w - lw2) / 2, y + cell_h - 22), display_line2, fill=(60, 60, 60), font=font_label)

    # Save PNG
    png_name = f"board_{uuid.uuid4().hex[:8]}.png"
    pdf_name = f"board_{uuid.uuid4().hex[:8]}.pdf"
    assets.mkdir(parents=True, exist_ok=True)
    board.save(assets / png_name, format="PNG")

    # Save PDF with ReportLab (place the PNG to fill page width)
    c = canvas.Canvas(str(assets / pdf_name), pagesize=A5)
    pw, ph = A5  # in points
    # Convert pixels to points (assume ~96 dpi → 0.75 factor); simple fit by width
    scale = pw / board.width
    img_height_pts = board.height * scale
    # drawImage expects a file path
    c.drawImage(str(assets / png_name), 0, ph - img_height_pts, width=pw, height=img_height_pts)
    c.showPage()
    c.save()

    return png_name, pdf_name


