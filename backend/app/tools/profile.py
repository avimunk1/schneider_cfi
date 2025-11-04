from typing import Dict, List
from ..schemas import PatientProfile, Preferences


def normalize_profile(profile: PatientProfile, preferences: Preferences | None) -> Dict:
    data = profile.model_dump() if hasattr(profile, "model_dump") else dict(profile)

    labels_languages: List[str] = ["hebrew"]
    second = None
    if preferences and preferences.second_language:
        second = preferences.second_language
    elif profile.second_language:
        second = profile.second_language
    elif profile.language and profile.language.lower() not in ("hebrew", "he"):
        second = profile.language
    if second:
        labels_languages.append(second)

    # Image style: explicit, non-icon imagery when can_read is False
    can_read = data.get("can_read")
    image_style = "realistic_explicit" if can_read is False else "cartoon_clean"

    return {
        "labels_languages": labels_languages,
        "image_style": image_style,
    }


