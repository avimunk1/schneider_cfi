export type ConversationMessage = {
  role: string;
  text: string;
};

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
  conversation_history?: ConversationMessage[];
};

export type PreviewResponse = {
  parsed: { topic?: string; entities: string[]; layout: string };
  profile: { labels_languages: string[]; image_style: string };
  checks: { ok: boolean; missing: string[] };
  summary: string;
};

export type GenerateRequest = {
  parsed: { layout: string; entities: string[]; topic?: string };
  profile: { labels_languages: string[]; image_style: string };
  title: string;
};

export type GenerateResponse = {
  assets: { png_url: string; pdf_url: string };
  timings_ms: { images: number; render: number };
};

export type GenerateStartResponse = {
  job_id: string;
};

export type ProgressResponse = {
  progress: {
    status: "in_progress" | "completed" | "error";
    current_entity?: string;
    completed_count: number;
    total_count: number;
    message: string;
  };
  assets?: { png_url: string; pdf_url: string; image_files?: string[] };
};

// In local dev: empty string → uses Vite proxy (/api → localhost:8000)
// In production: Railway backend URL from environment variable
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function http<T>(path: string, method: string = "POST", body?: any): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  
  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(`${API_BASE}${path}`, options);
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
  preview: (req: PreviewRequest) => http<PreviewResponse>("/api/boards/preview", "POST", req),
  generate: (req: GenerateRequest) => http<GenerateResponse>("/api/boards/generate", "POST", req),
  generateStart: (req: GenerateRequest) => http<GenerateStartResponse>("/api/boards/generate/start", "POST", req),
  generateStatus: (jobId: string) => http<ProgressResponse>(`/api/boards/generate/status/${jobId}`, "GET"),
};


