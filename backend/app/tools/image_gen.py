import os
import uuid
import base64
from pathlib import Path
from typing import List, Dict, Optional
from PIL import Image, ImageDraw, ImageFont
from google import genai


def _safe_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _sanitize_prefix(prefix: Optional[str]) -> str:
    if not prefix:
        return ""
    safe = "".join(ch for ch in str(prefix) if ch.isalnum() or ch in {"-", "_"})
    if safe and not safe.endswith("_"):
        safe = f"{safe}_"
    return safe


def _generate_placeholder(entity: str, assets: Path, prefix: Optional[str] = None) -> str:
    """Fallback placeholder image"""
    img = Image.new("RGB", (512, 512), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = _safe_font(28)

    text = str(entity)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.rectangle([10, 10, 502, 502], outline=(30, 30, 30), width=4)
    draw.text(((512 - tw) / 2, (512 - th) / 2), text, fill=(20, 20, 20), font=font, align="center")

    filename = f"{_sanitize_prefix(prefix)}img_{uuid.uuid4().hex[:8]}.png"
    img.save(assets / filename)
    return filename


def _generate_with_gemini(entity: str, prompt_text: str, assets: Path, prefix: Optional[str] = None) -> str | None:
    """Try Gemini image generation"""
    api_key = os.getenv("GOOGLE_GENAI_API_KEY")
    if not api_key:
        print(f"[image_gen] No API key for {entity}")
        return None

    try:
        print(f"[image_gen] Generating {entity} with prompt: {prompt_text[:100]}...")
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[{"role": "user", "parts": [{"text": prompt_text}]}],
        )

        print(f"[image_gen] Raw response type: {type(response)}")
        
        # Extract inline image data if available
        if response and response.candidates:
            print(f"[image_gen] Found {len(response.candidates)} candidates")
            candidate = response.candidates[0]
            print(f"[image_gen] Candidate content parts: {len(candidate.content.parts)}")
            
            for i, part in enumerate(candidate.content.parts):
                if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                    # Check if data is already bytes or needs decoding
                    raw_data = part.inline_data.data
                    print(f"[image_gen] Data type: {type(raw_data)}, first bytes: {raw_data[:20] if isinstance(raw_data, bytes) else 'not bytes'}")
                    
                    if isinstance(raw_data, bytes):
                        img_data = raw_data
                    else:
                        img_data = base64.b64decode(raw_data)
                    
                    filename = f"{_sanitize_prefix(prefix)}img_{uuid.uuid4().hex[:8]}.png"
                    with open(assets / filename, "wb") as f:
                        f.write(img_data)
                    print(f"[image_gen] SUCCESS: {entity} -> {filename} ({len(img_data)} bytes)")
                    return filename
                    
        print(f"[image_gen] No image data in response for {entity}")
        return None
    except Exception as e:
        print(f"[image_gen] Gemini failed for {entity}: {e}")
        return None


def generate_images(prompts: List[Dict], assets_dir: str, prefix: Optional[str] = None) -> List[str]:
    out_paths: List[str] = []
    assets = Path(assets_dir)
    assets.mkdir(parents=True, exist_ok=True)

    for item in prompts:
        entity = item.get("entity", "item")
        prompt_text = item.get("prompt", entity)

        # Try Gemini first
        filename = _generate_with_gemini(entity, prompt_text, assets, prefix=prefix)
        if not filename:
            # Fallback to placeholder
            filename = _generate_placeholder(entity, assets, prefix=prefix)

        out_paths.append(filename)

    return out_paths


