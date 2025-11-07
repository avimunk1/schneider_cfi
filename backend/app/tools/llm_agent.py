import os
import json
from typing import Dict, Any, List
from openai import OpenAI


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def understand_request(board_description: str, patient_profile: Dict, conversation_history: str = "") -> Dict[str, Any]:
    """
    Use LLM to understand user intent and extract structured plan.
    Returns either a plan or questions for clarification.
    """
    client = _get_client()
    
    system_prompt = """You are an assistant helping speech therapists create communication boards.
Your job is to understand what board the user wants to create.

IMPORTANT: Respond in the SAME LANGUAGE as the user's input (Hebrew/English/Arabic).
If the user writes in Hebrew, respond in Hebrew. If in English, respond in English.
All text fields (questions, reasoning) MUST be in the user's language.

Analyze the user's description and patient profile, then return a JSON response with:
{
  "needs_clarification": boolean,
  "questions": ["question1", "question2"] (in user's language if clarification needed),
  "plan": {
    "topic": "topic name",
    "entities": ["item1", "item2", ...],
    "layout": "2x4" or "3x3",
    "reasoning": "explanation in user's language"
  } (if plan is clear)
}

CRITICAL RESPONSE STYLE:
- Use FUTURE tense: "אצור לך" (I will create), NOT past tense "יצרתי" (I created)
- Start with "הבנתי" (I understood) to acknowledge the request
- EXPLICITLY list ALL the items that will be in the board
- CLEARLY state what profile info was provided and what's missing
- For missing info, state the DEFAULT that will be used: "לא ציינת גיל - אשתמש בברירת מחדל: 10 שנים"
- End with clarifying questions about missing info

Example Hebrew response when profile is incomplete:
"הבנתי, אני אצור לך לוח 3x3 עם הפריטים הבאים:
- פעלים (3): לאכול, לשתות, לרצות
- תארים (3): חם, קר, טוב
- שמות גוף (3): אני, אתה, הוא

פרטי מטופל:
• גיל: לא צוין - אשתמש בברירת מחדל של 10 שנים
• מגדר: לא צוין - אשתמש בברירת מחדל 'ילד'
• קורא/ת: לא צוין - אשתמש בתמונות ריאליסטיות (מתאים למי שלא קורא)

האם תרצה לציין את הפרטים האלה?"

Example when profile IS provided:
"הבנתי, אני אצור לך לוח 3x3 עם הפריטים הבאים: לחם, חלב, ביצה, לאכול, לשתות, לרצות, חם, קר, טוב.

פרטי מטופל:
• גיל: 8 שנים ✓
• מגדר: ילדה ✓
• קורא/ת: לא ✓

האם להתחיל ביצירת הלוח?"

Guidelines:
- RECOGNIZE GREETINGS: If user just says greetings like "שלום", "בוקר טוב", "היי", "hello" WITHOUT a board request, respond with needs_clarification=true
- ASK FOR TOPIC: When there's no clear board topic, ask: "שלום! איזה לוח תקשורת תרצה ליצור?" (Hello! What communication board would you like to create?)
- BE PROACTIVE: When user asks for verbs, adjectives, pronouns, or other word types, SUGGEST SPECIFIC ITEMS based on the context
- NEVER ask "כמה פעלים/תארים?" (how many) - always decide and suggest concrete items
- If user mentions categories (e.g., "פעלים ותארים"), suggest items with breakdown: "אני אשתמש ב-3 פעלים (לאכול, לשתות, לרצות) ו-3 תארים (חם, קר, טוב)"
- If user doesn't mention categories, just list the items without categorization
- For breakfast context: suggest relevant verbs like "eat", "drink", "pour", "want"
- For pronouns: suggest "I", "you", "he/she", "we", "they", "who"
- For adjectives: suggest relevant ones like "hot", "cold", "good", "bad", "big", "small"
- Always provide CONCRETE SUGGESTIONS rather than asking "which ones?" or "how many?"
- If topic is clear (e.g., "fruits", "emotions", "breakfast"), create a complete plan
- Consider patient age and can_read status
- For can_read=false, prefer concrete, visual items that can be shown in images
- Review conversation history to understand context and refinements
- Parse layout carefully: "3x3" means 3 rows × 3 columns = 9 items total
- Only ask clarification questions if the request is truly vague, ambiguous, or just a greeting
- When user specifies quantities (e.g., "3 verbs, 3 adjectives, 3 pronouns"), include EXACTLY those numbers

Examples:
- User: "breakfast board with 3 verbs, 3 adjectives, 3 pronouns"
  → entities: ["eat", "drink", "pour", "hot", "cold", "good", "I", "you", "he"]
  → layout: "3x3"
  → reasoning: "I understood. I will create a 3x3 board with these items: eat, drink, pour (3 verbs), hot, cold, good (3 adjectives), I, you, he (3 pronouns). You didn't specify the patient's age or whether they can read. Should I use realistic images?"
  
- User in Hebrew: "לוח ארוחת בוקר 3x3 עם 3 פעלים, 3 תארים, 3 שמות גוף"
  → entities: ["לאכול", "לשתות", "לרצות", "חם", "קר", "טוב", "אני", "אתה", "הוא"]
  → layout: "3x3"
  → reasoning: "הבנתי, אני אצור לך לוח 3x3 עם הפריטים הבאים:\n- פעלים (3): לאכול, לשתות, לרצות\n- תארים (3): חם, קר, טוב\n- שמות גוף (3): אני, אתה, הוא\n\nלא ציינת את גיל המטופל. האם זה ילד או מבוגר? גם לא ציינת האם הוא/היא קוראים - האם ליצור תמונות מפורשות או אייקונים?"
"""

    user_msg = f"""Patient profile: {json.dumps(patient_profile, ensure_ascii=False)}

Conversation history:
{conversation_history}

Latest user message: {board_description}

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


def build_image_prompts(entities: List[str], patient_profile: Dict, image_style: str, board_context: str = "") -> List[Dict[str, str]]:
    """
    Use LLM to create detailed, context-aware prompts for image generation.
    """
    client = _get_client()
    
    age = patient_profile.get("age", 10)
    gender = patient_profile.get("gender", "child")
    religion = patient_profile.get("religion", "")  # דתי/לא דתי
    sector = patient_profile.get("sector", "")  # מוסלמי/חרדי/דתי etc
    
    # Build cultural context
    cultural_context = ""
    if sector:
        if sector == "מוסלמי":
            cultural_context = "Muslim family with appropriate modest clothing (hijab for women/girls, traditional dress)"
        elif sector == "חרדי":
            cultural_context = "Ultra-Orthodox Jewish family with traditional dress (women in modest clothing, men with kippa/hat)"
        elif sector == "דתי":
            cultural_context = "Religious Jewish family with appropriate dress (women in modest clothing, men with kippa)"
        elif sector == "נוצרי":
            cultural_context = "Christian Arab family with appropriate cultural context"
        elif sector == "דרוזי":
            cultural_context = "Druze family with appropriate cultural dress"
        else:
            cultural_context = f"{sector} family with culturally appropriate representation"
    
    system_prompt = f"""You are an expert at creating image generation prompts for communication boards.

Patient context:
- Age: {age}
- Gender: {gender}
- Cultural background: {sector if sector else "not specified"}
- Religious: {religion if religion else "not specified"}
- Style needed: {image_style}
- Board context: {board_context if board_context else "general"}

CRITICAL CULTURAL SENSITIVITY:
{cultural_context if cultural_context else "Use culturally neutral representation"}

CRITICAL: Images must be CONTEXTUAL to the board topic AND culturally appropriate!

For abstract concepts (verbs, adjectives, pronouns), show them IN CONTEXT:
- If board is about breakfast:
  - "hot" → hot coffee or hot food, NOT the sun
  - "cold" → cold milk or cold juice, NOT ice
  - "eat" → person eating breakfast, NOT generic eating
  - "drink" → person drinking from cup, NOT water bottle
  - "I/you/he" → person at breakfast table in relevant pose

For each entity, create a detailed prompt optimized for Google's Gemini image generation that:
- Describes a single, clear scene or object on white background
- Uses {image_style} style (realistic/explicit if patient can't read; clean/friendly otherwise)
- Is age-appropriate for {age} year old
- No text, logos, or watermarks in image
- Explicit, recognizable representation (not icons or symbols)
- ALWAYS relates abstract concepts to the board's context (breakfast, emotions, etc.)

Return JSON array:
[
  {{"entity": "entity_name", "prompt": "detailed contextual generation prompt"}},
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

