import time
import uuid
from typing import Dict

from . import schemas
from .tools.profile import normalize_profile
from .tools.llm_agent import understand_request, build_image_prompts
from .tools.checker import validate_requirements
from .tools.labels import generate_labels
from .tools.render import render_board
from .tools import conversation_logger
from .logger import logger


def handle_preview(req: schemas.PreviewRequest) -> schemas.PreviewResponse:
    """
    Step 1: Use LLM to understand user intent and create a plan
    """
    t0 = time.time()
    session_id = req.session_id or uuid.uuid4().hex

    history_payload = [msg.model_dump() for msg in req.conversation_history]
    conversation_logger.record_preview_request(
        session_id=session_id,
        user_name=req.user_name,
        board_description=req.board_description,
        conversation_history=history_payload,
    )

    try:
        # Normalize profile
        norm = normalize_profile(req.patient_profile, req.preferences)
        
        # Build conversation context for LLM
        conversation_context = "\n".join([
            f"{msg.role}: {msg.text}" for msg in req.conversation_history
        ])
        
        # Use LLM to understand the request
        patient_dict = req.patient_profile.model_dump() if hasattr(req.patient_profile, "model_dump") else dict(req.patient_profile)
        llm_result = understand_request(req.board_description, patient_dict, conversation_context)

        # Check if LLM needs clarification
        if llm_result.get("needs_clarification"):
            # Return questions to user
            questions_text = "\n".join(llm_result.get("questions", []))
            summary_text = f"צריך הבהרה:\n{questions_text}"
            conversation_logger.record_preview_result(
                session_id=session_id,
                summary=summary_text,
                llm_payload=llm_result,
            )
            return schemas.PreviewResponse(
                parsed=schemas.ParsedBoard(topic=None, entities=[], layout="2x4"),
                profile=schemas.PreviewProfile(
                    labels_languages=norm["labels_languages"], 
                    image_style=norm["image_style"],
                    age=req.patient_profile.age,
                    gender=req.patient_profile.gender,
                    language=req.patient_profile.language,
                    can_read=req.patient_profile.can_read,
                    religion=req.patient_profile.religion,
                    sector=req.patient_profile.sector
                ),
                checks=schemas.Checks(ok=False, missing=["clarification_needed"]),
                summary=summary_text,
                session_id=session_id,
                user_name=req.user_name,
            )
        
        # Extract plan from LLM
        plan = llm_result.get("plan", {})
        entities = plan.get("entities", [])
        layout = plan.get("layout", "2x4")
        topic = plan.get("topic")
        reasoning = plan.get("reasoning", "")

        parsed = schemas.ParsedBoard(topic=topic, entities=entities, layout=layout)
        checks = validate_requirements(norm, parsed.model_dump())

        # Use the LLM's reasoning as-is - it already contains the complete formatted response
        summary_text = reasoning
        conversation_logger.record_preview_result(
            session_id=session_id,
            summary=summary_text,
            llm_payload=llm_result,
        )

        return schemas.PreviewResponse(
            parsed=parsed,
            profile=schemas.PreviewProfile(
                labels_languages=norm["labels_languages"], 
                image_style=norm["image_style"],
                age=req.patient_profile.age,
                gender=req.patient_profile.gender,
                language=req.patient_profile.language,
                can_read=req.patient_profile.can_read,
                religion=req.patient_profile.religion,
                sector=req.patient_profile.sector
            ),
            checks=schemas.Checks(ok=checks["ok"], missing=checks["missing"]),
            summary=summary_text,
            session_id=session_id,
            user_name=req.user_name,
        )
    except Exception as err:
        conversation_logger.record_error(session_id, "preview", str(err))
        conversation_logger.finalize_session(session_id)
        setattr(err, "session_id", session_id)
        raise


def handle_generate(req: schemas.GenerateRequest, assets_dir: str, job_id: str = None) -> schemas.GenerateResponse:
    """
    Step 2: Use LLM to build image prompts, then generate with Google
    """
    from pathlib import Path
    from .tools.image_gen import _generate_with_gemini, _generate_placeholder
    
    t_images_start = time.time()
    session_id = req.session_id or uuid.uuid4().hex
    conversation_logger.record_generate_start(session_id, len(req.parsed.entities))

    try:
        # Use LLM to build detailed prompts for each entity
        profile_dict = req.profile.model_dump() if hasattr(req.profile, "model_dump") else dict(req.profile)
        
        # Create a working copy with defaults for image generation
        # but keep original profile for display/transparency
        working_profile = profile_dict.copy()
        if 'age' not in working_profile or working_profile['age'] is None:
            working_profile['age'] = 10
        if 'gender' not in working_profile or working_profile['gender'] is None:
            working_profile['gender'] = 'child'
        
        # Build board context from topic and title
        board_context = req.parsed.topic if hasattr(req.parsed, 'topic') and req.parsed.topic else req.title
        if not board_context or board_context == "לוח תקשורת מותאם":
            # Try to infer context from entities
            if any(word in str(req.parsed.entities).lower() for word in ["breakfast", "לחם", "חלב", "ביצה", "בוקר"]):
                board_context = "breakfast / ארוחת בוקר"
        
        try:
            prompts = build_image_prompts(
                req.parsed.entities,
                working_profile,  # Use working profile with defaults for image generation
                req.profile.image_style,
                board_context
            )
            logger.info("LLM prompts generated", 
                       prompt_count=len(prompts),
                       board_context=board_context, 
                       profile_age=working_profile.get('age'), 
                       profile_gender=working_profile.get('gender'))
        except Exception as e:
            logger.error("LLM prompt building failed", error=str(e), exc_info=True)
            conversation_logger.record_error(session_id, "prompt_building", str(e))
            # Fallback to simple prompts
            prompts = [{"entity": ent, "prompt": f"A realistic {ent} on white background"} for ent in req.parsed.entities]

        assets = Path(assets_dir)
        max_attempts = 2

        if job_id:
            from .main import _generation_status

        for attempt in range(1, max_attempts + 1):
            image_paths = []
            try:
                if job_id and job_id in _generation_status:
                    _generation_status[job_id].message = "יוצר תמונות..."

                for i, item in enumerate(prompts):
                    entity = item.get("entity", "item")
                    prompt_text = item.get("prompt", entity)

                    if job_id and job_id in _generation_status:
                        _generation_status[job_id].current_entity = entity
                        _generation_status[job_id].completed_count = i
                        _generation_status[job_id].message = f"יוצר תמונה: {entity}..."

                    filename = _generate_with_gemini(entity, prompt_text, assets, prefix=session_id)
                    if not filename:
                        filename = _generate_placeholder(entity, assets, prefix=session_id)

                    image_paths.append(filename)

                if len(image_paths) != len(req.parsed.entities):
                    raise RuntimeError(
                        f"Generated {len(image_paths)} images but expected {len(req.parsed.entities)}"
                    )

                t_images = int((time.time() - t_images_start) * 1000)

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
                    prefix=session_id,
                )
                t_render = int((time.time() - t_render_start) * 1000)

                assets_obj = schemas.Assets(
                    png_url=f"/assets/{out_png}",
                    pdf_url=f"/assets/{out_pdf}",
                    image_files=image_paths,
                )
                conversation_logger.record_generate_success(
                    session_id=session_id,
                    image_files=image_paths,
                    board_png=out_png,
                    board_pdf=out_pdf,
                )
                conversation_logger.finalize_session(session_id)
                return schemas.GenerateResponse(
                    assets=assets_obj,
                    timings_ms=schemas.Timings(images=t_images, render=t_render),
                    session_id=session_id,
                    user_name=req.user_name,
                )

            except Exception as err:
                conversation_logger.record_error(session_id, "image_generation", str(err))
                logger.warning(
                    "[orchestrator] Image generation attempt %s failed: %s",
                    attempt,
                    err,
                )

                # Clean up partial images
                for path in image_paths:
                    try:
                        (assets / path).unlink(missing_ok=True)
                    except Exception:
                        logger.debug("[orchestrator] Failed to cleanup partial image %s", path)

                if job_id and job_id in _generation_status:
                    _generation_status[job_id].message = "הייתה תקלה ביצירת התמונות, מנסה שוב..." if attempt < max_attempts else "הייתה תקלה זמנית ביצירת התמונות." 

                if attempt == max_attempts:
                    logger.exception("[orchestrator] Image generation failed after retries")
                    conversation_logger.finalize_session(session_id)
                    if job_id and job_id in _generation_status:
                        _generation_status[job_id].status = "error"
                        _generation_status[job_id].message = "יצירת התמונות נכשלה זמנית. נסה שוב בעוד רגע."
                    final_error = RuntimeError("יצירת התמונות נכשלה זמנית. נסה שוב בעוד רגע.")
                    setattr(final_error, "session_id", session_id)
                    setattr(final_error, "session_error_logged", True)
                    raise final_error from err

                time.sleep(1)
                t_images_start = time.time()
                continue
    except Exception as err:
        if not getattr(err, "session_error_logged", False):
            conversation_logger.record_error(session_id, "generate", str(err))
            conversation_logger.finalize_session(session_id)
        setattr(err, "session_id", session_id)
        raise



