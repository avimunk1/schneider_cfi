import re
from typing import List, Optional
from ..schemas import Preferences, ParsedBoard


# Common topics with default entities
TOPIC_DEFAULTS = {
    "פירות": ["תפוח", "בננה", "תפוז", "אבטיח", "ענבים", "תות", "אגס", "דובדבן"],
    "ירקות": ["עגבניה", "מלפפון", "גזר", "חסה", "פלפל", "בצל", "תפוח אדמה", "ברוקולי"],
    "רגשות": ["שמח", "עצוב", "כועס", "מפחד", "רגוע", "מופתע", "עייף", "רעב"],
    "בית": ["מטבח", "חדר שינה", "אמבטיה", "סלון", "גינה", "מיטה", "שולחן", "כיסא"],
    "רפואי": ["כאב", "תרופה", "רופא", "אחות", "מזרק", "תחבושת", "חום", "לחץ דם"],
}


def parse_description(text: str, preferences: Optional[Preferences]) -> ParsedBoard:
    # Parse Hebrew descriptions intelligently
    lowered = text.strip().lower()

    layout = "2x4"
    if preferences and preferences.layout in {"2x4", "3x3"}:
        layout = preferences.layout
    
    entities: List[str] = []
    topic = None

    # Check if description contains explicit list of items
    # Look for newlines, commas, semicolons
    if "\n" in text or "," in text or ";" in text:
        parts = re.split(r"[,;\n\r\t]+", text)
        entities = [p.strip() for p in parts if p.strip() and len(p.strip()) > 1]
    
    # Check for topic keywords and generate defaults
    if not entities:
        for keyword, defaults in TOPIC_DEFAULTS.items():
            if keyword in lowered:
                topic = keyword
                entities = defaults.copy()
                break
    
    # If still no entities, try to extract from natural language
    if not entities:
        # Look for patterns like "בנושא X" or "עם X"
        if "בנושא" in lowered:
            # Default to basic needs
            entities = ["אוכל", "שתייה", "שירותים", "שינה", "כאב", "עזרה", "בית", "משחק"]
        else:
            # Parse as comma/space separated list
            parts = re.split(r"[,;\s]+", text)
            entities = [p.strip() for p in parts if p.strip() and len(p.strip()) > 2]
    
    # Final fallback
    if not entities:
        entities = ["אוכל", "שתייה", "שירותים", "שינה", "כאב", "עזרה", "בית", "משחק"]

    # Cap to layout size
    if layout == "2x4":
        entities = entities[:8]
    elif layout == "3x3":
        entities = entities[:9]

    return ParsedBoard(topic=topic, entities=entities, layout=layout)


