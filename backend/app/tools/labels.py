from typing import Dict, List

# Simple translation dictionary for common terms (Hebrew to other languages)
TRANSLATIONS = {
    "hebrew": {
        # Medical
        "כאב": {"english": "Pain", "arabic": "ألم"},
        "כואב לי": {"english": "It hurts", "arabic": "يؤلمني"},
        "תרופה": {"english": "Medicine", "arabic": "دواء"},
        "רופא": {"english": "Doctor", "arabic": "طبيب"},
        "אחות": {"english": "Nurse", "arabic": "ممرضة"},
        # Basic needs
        "אוכל": {"english": "Food", "arabic": "طعام"},
        "לאכול": {"english": "To eat", "arabic": "آكل"},
        "שתייה": {"english": "Drink", "arabic": "شراب"},
        "לשתות": {"english": "To drink", "arabic": "أشرب"},
        "מים": {"english": "Water", "arabic": "ماء"},
        "שירותים": {"english": "Toilet", "arabic": "حمام"},
        "לשירותים": {"english": "Toilet", "arabic": "حمام"},
        "שינה": {"english": "Sleep", "arabic": "نوم"},
        "עייף": {"english": "Tired", "arabic": "متعب"},
        # Emotions / Communication
        "עזרה": {"english": "Help", "arabic": "مساعدة"},
        "בית": {"english": "Home", "arabic": "بيت"},
        "משחק": {"english": "Play", "arabic": "لعب"},
        "אמא": {"english": "Mom", "arabic": "أمي"},
        "אבא": {"english": "Dad", "arabic": "أبي"},
        "כן": {"english": "Yes", "arabic": "نعم"},
        "לא": {"english": "No", "arabic": "لا"},
        "מפחד": {"english": "Scared", "arabic": "خائف"},
    }
}


def _translate(text: str, target_lang: str) -> str:
    """Simple lookup translation from Hebrew to target language"""
    text_lower = text.strip().lower()
    he_dict = TRANSLATIONS.get("hebrew", {})
    if text_lower in he_dict:
        mapping = he_dict[text_lower]
        return mapping.get(target_lang, text)
    return text


def generate_labels(entities: List[str], languages: List[str]) -> List[Dict[str, str]]:
    """Generate labels in multiple languages for each entity"""
    out: List[Dict[str, str]] = []
    for entity in entities:
        entry: Dict[str, str] = {}
        for lang in languages:
            if lang.lower() in ("hebrew", "he"):
                entry[lang] = entity
            else:
                entry[lang] = _translate(entity, lang.lower())
        out.append(entry)
    return out


