# Schneider CFI – Personalized Communication Board

Interactive demo for a culturally aware communication board that adapts to patient profile and hospital context.

## Features

- **Profile-aware tiles**: adapts to age, gender, sector (religion/culture) and context
- **Cultural support**: respectful for Haredi, Religious, Muslim, Traditional, Secular
- **AI image generation**: create custom images with prompts tailored by age/gender/sector
- **Dynamic A4 layout**: auto‑sized tiles; fills from top‑right for RTL layouts
- **Always‑available export**: persistent bottom‑left “Download PNG” button
- **External configuration**: optional JSON data in `public/`

## Local development

1) Install dependencies
```bash
npm install
```

2) Configure environment (demo client‑side key)
Create a `.env` file in the project root:
```bash
VITE_GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_AI_STUDIO_API_KEY
```

3) Run the dev server
```bash
npm run dev
```
Open `http://localhost:5173`.

## Deployment (Vercel)

1) In Vercel → Project → Settings → Environment Variables:
   - Name: `VITE_GOOGLE_GENAI_API_KEY`
   - Value: your Google AI Studio API key
   - Scope: Preview + Production

2) Redeploy the project. Vite will inline the value at build time. For production, consider moving AI calls to a serverless function to keep secrets off the client.

## Project structure

- `src/components/CommunicationBoardDemo.tsx` – main component and UI
- `src/lib/gemini.ts` – AI image generation utilities and prompt construction
- `src/components/ui/` – small UI primitives
- `public/category_styles.json` – category colors (optional)
- `public/tile_library.json` – tile library (optional)

## Prompting policy (images)

Image prompts are automatically augmented with:
- Audience: derived from age and gender (e.g., “10‑year‑old boy/girl/man/woman”)
- Cultural line: adapted to sector (e.g., Muslim / religious Jewish / secular)
- Safety and clarity: single main object, friendly visuals, no text/letters/numbers, no logos/watermarks, no gore, no needles in skin

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Lucide React (icons)
- html-to-image (PNG export)
