export type PreviewRequest = {
  patient_profile: {
    age?: number;
    gender?: string;
    language?: string;
    can_read?: boolean;
    second_language?: string;
  };
  board_description: string;
  preferences?: {
    layout?: string;
    paper_size?: string;
    second_language?: string;
  };
};

export type PreviewResponse = {
  parsed: { topic?: string; entities: string[]; layout: string };
  profile: { labels_languages: string[]; image_style: string };
  checks: { ok: boolean; missing: string[] };
  summary: string;
};

export type GenerateRequest = {
  parsed: { layout: string; entities: string[] };
  profile: { labels_languages: string[]; image_style: string };
  title: string;
};

export type GenerateResponse = {
  assets: { png_url: string; pdf_url: string };
  timings_ms: { images: number; render: number };
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

async function http<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: any = undefined;
    try {
      detail = await res.json();
    } catch {}
    throw new Error(
      detail?.message ? `API error: ${detail.message}` : `HTTP ${res.status}`
    );
  }
  return (await res.json()) as T;
}

export const api = {
  preview: (req: PreviewRequest) => http<PreviewResponse>("/api/boards/preview", req),
  generate: (req: GenerateRequest) => http<GenerateResponse>("/api/boards/generate", req),
};


