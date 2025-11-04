import os
import json
from typing import Dict, Any, List
from openai import OpenAI


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def understand_request(board_description: str, patient_profile: Dict) -> Dict[str, Any]:
    """
    Use LLM to understand user intent and extract structured plan.
    Returns either a plan or questions for clarification.
    """
    client = _get_client()
    
    system_prompt = """You are an assistant helping speech therapists create communication boards.
Your job is to understand what board the user wants to create.

Analyze the user's description and patient profile, then return a JSON response with:
{
  "needs_clarification": boolean,
  "questions": ["question1", "question2"] (if clarification needed),
  "plan": {
    "topic": "topic name",
    "entities": ["item1", "item2", ...],
    "layout": "2x4" or "3x3",
    "reasoning": "explanation"
  } (if plan is clear)
}

Guidelines:
- If topic is clear (e.g., "fruits", "emotions", "medical needs"), extract 8 relevant items
- If description is vague, ask 1-2 clarifying questions
- Consider patient age and can_read status
- For can_read=false, prefer concrete nouns over abstract concepts
"""

    user_msg = f"""Patient profile: {json.dumps(patient_profile, ensure_ascii=False)}

User description: {board_description}

Provide your analysis as JSON."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    
    result = json.loads(response.choices[0].message.content)
    return result


def build_image_prompts(entities: List[str], patient_profile: Dict, image_style: str) -> List[Dict[str, str]]:
    """
    Use LLM to create detailed, optimized prompts for image generation.
    """
    client = _get_client()
    
    age = patient_profile.get("age", 10)
    gender = patient_profile.get("gender", "child")
    
    system_prompt = f"""You are an expert at creating image generation prompts for communication boards.

Patient context:
- Age: {age}
- Gender: {gender}
- Style needed: {image_style}

For each entity, create a detailed prompt optimized for Google's Gemini image generation that:
- Describes a single, clear object on white background
- Uses {image_style} style (realistic/explicit if patient can't read; clean/friendly otherwise)
- Is age-appropriate for {age} year old
- No text, logos, or watermarks in image
- Explicit, recognizable representation (not icons or symbols)

Return JSON array:
[
  {{"entity": "entity_name", "prompt": "detailed generation prompt"}},
  ...
]
"""

    user_msg = f"Create image prompts for these entities: {json.dumps(entities, ensure_ascii=False)}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg}
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    
    print(f"[llm_agent] OpenAI response: {response.choices[0].message.content}")
    result = json.loads(response.choices[0].message.content)
    print(f"[llm_agent] Parsed result: {result}")
    
    # Handle both array directly or wrapped in "prompts" key
    if isinstance(result, list):
        return result
    prompts = result.get("prompts", result.get("image_prompts", result.get("items", [])))
    print(f"[llm_agent] Extracted prompts: {prompts}")
    return prompts

