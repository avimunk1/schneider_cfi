import React, { useState } from "react";
import { api, PreviewRequest } from "@/lib/api";

type AgentMessage = { role: "agent" | "user"; text: string };

export default function NewBoard() {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "agent", text: "שלום! אני הסוכן שלך ליצירת לוח תקשורת. ספר/י לי על המטופל ועל הלוח שתרצה/י." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [title, setTitle] = useState("לוח תקשורת מותאם");
  const [assets, setAssets] = useState<{ png_url: string; pdf_url: string } | null>(null);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: AgentMessage = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const req: PreviewRequest = {
        patient_profile: { can_read: false },
        board_description: input,
        preferences: { layout: "2x4" },
      };
      const p = await api.preview(req);
      setPreview(p);
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: `תוכנית: ${p.summary}. יש ${p.parsed.entities.length} פריטים. להמשיך ליצירה?`,
        },
      ]);
      setInput("");
    } catch (e: any) {
      setMessages((m) => [...m, { role: "agent", text: `שגיאה: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await api.generate({
        parsed: { layout: preview.parsed.layout, entities: preview.parsed.entities },
        profile: preview.profile,
        title,
      });
      setAssets(res.assets);
      setMessages((m) => [
        ...m,
        { role: "agent", text: `מוכן! ניתן להוריד: PNG ו-PDF.` },
      ]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "agent", text: `שגיאה: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">סוכן יצירת לוח חדש</h1>

      <div className="border rounded-lg p-4 bg-white space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "agent" ? "text-purple-800" : "text-gray-800"}>
            <span className="font-medium">{m.role === "agent" ? "Agent" : "You"}:</span> {m.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-md p-2"
          placeholder="תאר/י את הלוח הנדרש..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button className="px-4 py-2 bg-purple-600 text-white rounded-md" onClick={send} disabled={loading}>
          שלח
        </button>
      </div>

      {preview && (
        <div className="border rounded-lg p-4 bg-white space-y-2">
          <div className="font-medium">תקציר</div>
          <div className="text-sm text-gray-700">{preview.summary}</div>
          <div className="text-sm text-gray-700">פריטים: {preview.parsed.entities.join(", ")}</div>
          <div className="flex items-center gap-2 mt-2">
            <input
              className="border rounded-md p-2 flex-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת"
            />
            <button className="px-4 py-2 bg-green-600 text-white rounded-md" onClick={generate} disabled={loading}>
              צור לוח
            </button>
          </div>
        </div>
      )}

      {assets && (
        <div className="border rounded-lg p-4 bg-white space-y-2">
          <div className="font-medium">קבצים</div>
          <div className="flex gap-3">
            <a className="text-blue-600 underline" href={assets.png_url} target="_blank">PNG</a>
            <a className="text-blue-600 underline" href={assets.pdf_url} target="_blank">PDF</a>
          </div>
        </div>
      )}
    </div>
  );
}


