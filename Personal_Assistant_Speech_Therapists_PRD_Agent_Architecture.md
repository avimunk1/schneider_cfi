
# Personal Assistant for Speech Therapists – PRD & Agent Architecture Specification

## 1. Product Overview

### Purpose
The Personal Assistant for Speech Therapists helps therapists create **personalized communication boards** for patients with speech or language impairments. The system uses AI to understand user descriptions, generate appropriate images, and assemble printable or digital boards.

### Goals
- Automate the creation of communication boards.  
- Personalize content for age, gender, culture, and language.  
- Reduce manual work in designing and searching for images.  
- Enable storage and reuse of boards and images.

### Primary Users
- Speech therapists and clinical professionals working with non-verbal patients.  
- Secondary: occupational therapists, educators, rehabilitation centers.

---

## 2. User Stories

| # | User Story | Acceptance Criteria |
|---|-------------|--------------------|
| 1 | As a speech therapist, I want to describe a communication board in natural language so that the system can generate it automatically. | The system interprets the description and provides a preview. |
| 2 | As a therapist, I want to define my patient’s characteristics (age, gender, religion, etc.) to make the board visually and culturally appropriate. | The board reflects the defined profile. |
| 3 | As a therapist, I want to review the planned board before generation. | The system displays a detailed summary for confirmation. |
| 4 | As a therapist, I want all text labels in the board to appear in Hebrew or another chosen language. | The system supports multilingual label generation. |
| 5 | As a therapist, I want to reuse past boards or images. | The system allows searching and reusing existing content. |

---

## 3. Functional Flow

1. **Patient Profile Input**  
   User enters patient attributes:  
   - Age, Gender  
   - Religion / Origin  
   - Religious (Yes / No)  
   - Language  
   - Can Read (Yes / No)

2. **Board Description (Free Text)**  
   User describes the desired board (e.g., layout, topic, content).

3. **Validation**  
   System checks for missing or unclear information.

4. **Board Plan & Confirmation**  
   AI summarizes planned board → user confirms or edits.

5. **Image Generation**  
   Reuse existing images or generate new ones.

6. **Board Rendering & Output**  
   Combine all content → generate final layout (PDF/PNG).  

7. **Storage & Searchability**  
   Save metadata for boards and images for future reuse.

---

## 4. Data Model

### 4.1 Board Metadata

| Field | Type | Description |
|--------|------|-------------|
| board_id | string | Unique identifier |
| creator_id | string | Therapist user ID |
| topic | string | Subject (e.g., “Fruits”) |
| patient_profile | JSON | Patient attributes |
| layout | string | Grid (e.g., “2x4”) |
| paper_size | string | e.g., “A5” |
| title | string | Board title |
| language | string | Board language |
| image_ids | array | Linked images |
| creation_date | date | Creation timestamp |
| prompt_text | string | Base generation prompt |

### 4.2 Image Metadata

| Field | Type | Description |
|--------|------|-------------|
| image_id | string | Unique identifier |
| entity | string | Object (e.g., “Watermelon”) |
| source | string | “generated” or “existing” |
| prompt | string | Image generation prompt |
| style | string | “cartoon”, “realistic”, etc. |
| url | string | Storage URL |
| width | int | Image width |
| height | int | Image height |
| associated_board_id | string | Board link |
| metadata | JSON | Additional attributes |

---

## 5. Agent-Based System Architecture

### 5.1 Overview

The system uses a **multi-tool agent architecture**, where a central **Orchestrator Agent** coordinates specialized tools for parsing, validation, image generation, and storage.

```
User ↔ Orchestrator Agent ↔ Tools
```

---

## 6. Components

### 6.1 Orchestrator Agent

#### Responsibilities
- Communicate with the therapist.  
- Maintain session state (profile, board request, current step).  
- Decide which tool to invoke next.  
- Merge results and generate user-facing responses.  
- Handle clarification, summarization, and confirmation.

#### Session State Example
```json
{
  "patient_profile": {
    "age": 8,
    "gender": "male",
    "religion": "jewish",
    "language": "hebrew",
    "can_read": true
  },
  "board_request": {
    "topic": "fruits",
    "num_cells": 8,
    "layout": "2x4",
    "paper_size": "A5",
    "title": "פירות"
  },
  "status": "awaiting_user_confirmation"
}
```

#### Main Phases
1. Collect Profile  
2. Parse Description  
3. Check Completeness  
4. Create Prompts  
5. Confirm with User  
6. Generate Images  
7. Render Board  
8. Save and Return Output

---

## 7. Tools

| Tool | Description | Input | Output |
|------|--------------|--------|--------|
| **ProfileValidatorTool** | Validates and normalizes patient data | `patient_profile` | Normalized profile, missing fields |
| **BoardParserTool** | Extracts structure from free text | `board_description` | Parsed layout, topic, entities |
| **RequirementsCheckerTool** | Detects missing parameters | `profile + board` | Boolean + missing fields |
| **PromptBuilderTool** | Builds prompts for board + images | `profile + board` | Board-level + image-level prompts |
| **ImageSearchTool** | Finds existing matching images | `entities + profile` | Found + missing entities |
| **ImageGeneratorTool** | Generates missing images | `prompts` | Image URLs + metadata |
| **TextLabelGeneratorTool** | Creates labels and translations | `entities + language` | Labels + short descriptions |
| **BoardRendererTool** | Assembles final layout | `images + metadata` | Board PDF/PNG URL |
| **DBHelperTool** | Saves / retrieves boards and images | Structured data | Success + IDs |

---

## 8. Tool Input/Output Examples

### PromptBuilderTool
**Input:**
```json
{
  "patient_profile": {"age":8,"gender":"male","language":"hebrew"},
  "board_request": {"topic":"fruits","style":"cartoon","layout":"2x4"}
}
```

**Output:**
```json
{
  "board_prompt": "Create cartoon-style fruit images suitable for an 8-year-old boy...",
  "image_prompts": [
    {"entity":"watermelon","prompt":"Cartoon watermelon on white background"},
    {"entity":"banana","prompt":"Cartoon banana on white background"}
  ]
}
```

### BoardRendererTool
**Input:**
```json
{
  "layout":"2x4",
  "paper_size":"A5",
  "title":"פירות",
  "language":"hebrew",
  "cells":[
    {"entity":"watermelon","image_id":"img-1","label":"אבטיח"},
    {"entity":"banana","image_id":"img-2","label":"בננה"}
  ]
}
```
**Output:**
```json
{
  "board_id":"board-999",
  "file_url":"https://storage/board-999.pdf"
}
```

---

## 9. Technical Infrastructure

| Layer | Technology | Description |
|--------|-------------|-------------|
| **Frontend** | React / Vue | Therapist UI for input, preview, and confirmation |
| **Backend** | Flask / FastAPI | Orchestrator agent API |
| **Storage** | S3 / GCS + DynamoDB | Persistent image and board data |
| **AI Models** | OpenAI / Vertex AI | LLM for orchestration + image generation |
| **Auth** | Cognito / Firebase Auth | Secure user management |

---

## 10. Non-Functional Requirements

| Category | Requirement |
|-----------|--------------|
| **Performance** | Generate complete board < 30 seconds |
| **Reliability** | 99% uptime |
| **Scalability** | Handle 100 concurrent users |
| **Security** | Store no patient-identifiable info |
| **Localization** | UI in Hebrew and English |
| **Accessibility** | WCAG-compliant interface |

---

## 11. Future Extensions
- Support digital interactive boards (not just print).  
- Add voice-to-text input for therapists.  
- Multi-user collaboration on boards.  
- Custom image upload (e.g., patient’s own photos).  
- Adaptive learning – reuse user preferences for style/language.  
