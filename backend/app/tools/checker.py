from typing import Dict


def _layout_capacity(layout: str) -> int:
    if layout == "2x4":
        return 8
    if layout == "3x3":
        return 9
    return 8


def validate_requirements(norm_profile: Dict, parsed_board: Dict) -> Dict:
    missing = []

    layout = parsed_board.get("layout", "2x4")
    entities = parsed_board.get("entities", [])
    cap = _layout_capacity(layout)
    ok = len(entities) > 0 and len(entities) <= cap

    if len(entities) == 0:
        missing.append("entities")

    return {"ok": ok, "missing": missing}


