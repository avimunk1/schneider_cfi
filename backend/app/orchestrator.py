import time
from typing import Dict

from . import schemas
from .tools.profile import normalize_profile
from .tools.llm_agent import understand_request, build_image_prompts
from .tools.checker import validate_requirements
from .tools.image_gen import generate_images
from .tools.labels import generate_labels
from .tools.render import render_board


def handle_preview(req: schemas.PreviewRequest) -> schemas.PreviewResponse:
    """
    Step 1: Use LLM to understand user intent and create a plan
    """
    t0 = time.time()

    # Normalize profile
    norm = normalize_profile(req.patient_profile, req.preferences)
    
    # Use LLM to understand the request
    patient_dict = req.patient_profile.model_dump() if hasattr(req.patient_profile, "model_dump") else dict(req.patient_profile)
    llm_result = understand_request(req.board_description, patient_dict)

    # Check if LLM needs clarification
    if llm_result.get("needs_clarification"):
        # Return questions to user
        questions_text = "\n".join(llm_result.get("questions", []))
        return schemas.PreviewResponse(
            parsed=schemas.ParsedBoard(topic=None, entities=[], layout="2x4"),
            profile=schemas.PreviewProfile(labels_languages=norm["labels_languages"], image_style=norm["image_style"]),
            checks=schemas.Checks(ok=False, missing=["clarification_needed"]),
            summary=f"צריך הבהרה:\n{questions_text}",
        )
    
    # Extract plan from LLM
    plan = llm_result.get("plan", {})
    entities = plan.get("entities", [])
    layout = plan.get("layout", "2x4")
    topic = plan.get("topic")
    reasoning = plan.get("reasoning", "")

    parsed = schemas.ParsedBoard(topic=topic, entities=entities, layout=layout)
    checks = validate_requirements(norm, parsed.model_dump())

    summary = f"{reasoning}\n\nאני אכין לוח {layout} עם {len(entities)} פריטים: {', '.join(entities[:3])}..."

    return schemas.PreviewResponse(
        parsed=parsed,
        profile=schemas.PreviewProfile(labels_languages=norm["labels_languages"], image_style=norm["image_style"]),
        checks=schemas.Checks(ok=checks["ok"], missing=checks["missing"]),
        summary=summary,
    )


def handle_generate(req: schemas.GenerateRequest, assets_dir: str) -> schemas.GenerateResponse:
    """
    Step 2: Use LLM to build image prompts, then generate with Google
    """
    t_images_start = time.time()

    # Use LLM to build detailed prompts for each entity
    profile_dict = req.profile.model_dump() if hasattr(req.profile, "model_dump") else dict(req.profile)
    try:
        prompts = build_image_prompts(
            req.parsed.entities,
            {"age": 8, "gender": "child"},  # TODO: pass actual profile
            req.profile.image_style
        )
        print(f"[orchestrator] Got {len(prompts)} prompts from LLM")
    except Exception as e:
        print(f"[orchestrator] LLM prompt building failed: {e}, using simple prompts")
        # Fallback to simple prompts
        prompts = [{"entity": e, "prompt": f"A realistic {e} on white background"} for e in req.parsed.entities]
    
    # Generate images with Google Gemini
    image_paths = generate_images(prompts, assets_dir)
    t_images = int((time.time() - t_images_start) * 1000)

    # Labels
    labels_per_entity = generate_labels(
        req.parsed.entities,
        req.profile.labels_languages,
    )

    t_render_start = time.time()
    out_png, out_pdf = render_board(
        layout=req.parsed.layout,
        title=req.title,
        entities=req.parsed.entities,
        image_paths=image_paths,
        labels_per_entity=labels_per_entity,
        assets_dir=assets_dir,
    )
    t_render = int((time.time() - t_render_start) * 1000)

    assets = schemas.Assets(
        png_url=f"/assets/{out_png}",
        pdf_url=f"/assets/{out_pdf}",
    )
    return schemas.GenerateResponse(assets=assets, timings_ms=schemas.Timings(images=t_images, render=t_render))


