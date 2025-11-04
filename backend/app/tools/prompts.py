from typing import Dict, List


def build_prompts(profile: Dict, parsed: Dict) -> List[Dict]:
    image_style = profile.get("image_style", "realistic_explicit")
    prompts = []
    for entity in parsed.get("entities", []):
        prompt_text = (
            f"Explicit, non-icon depiction of '{entity}' on white background; one main object; "
            f"style={image_style}; no text, no watermarks, no logos; age-appropriate."
        )
        prompts.append({"entity": entity, "prompt": prompt_text})
    return prompts


