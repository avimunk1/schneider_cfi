import React, { useState, useEffect, useRef } from "react";
import { api, PreviewRequest, ConversationMessage } from "@/lib/api";
import * as htmlToImage from "html-to-image";
import * as Lucide from "lucide-react";

type AgentMessage = { role: "agent" | "user"; text: string };
type UIState = "idle" | "thinking" | "generating";
type GeneratedBoard = {
  title: string;
  entities: string[];
  images: { [key: string]: string };  // entity -> image URL
  layout: string;
};

type PatientProfile = {
  age?: number;
  gender?: string;
  language?: string;
  can_read?: boolean;
  second_language?: string;
  religion?: string;
  sector?: string;
};

export default function NewBoard() {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "agent", text: "שלום! אני הסוכן שלך ליצירת לוח תקשורת.\n\nבואו נתחיל - ספר/י לי על הלוח שאת/ה צריך/ה, ואני אשאל שאלות הבהרה לפי הצורך." },
  ]);
  const [input, setInput] = useState("");
  const [uiState, setUiState] = useState<UIState>("idle");
  const [preview, setPreview] = useState<any>(null);
  const [title, setTitle] = useState("לוח תקשורת מותאם");
  const [assets, setAssets] = useState<{ png_url: string; pdf_url: string } | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generatedBoard, setGeneratedBoard] = useState<GeneratedBoard | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({});
  const [showProfileForm, setShowProfileForm] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const send = async () => {
    if (!input.trim() || uiState !== "idle") return;
    
    const userMsg: AgentMessage = { role: "user", text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setUiState("thinking");
    
    try {
      // Build conversation history for backend
      const conversationHistory: ConversationMessage[] = messages.map(m => ({
        role: m.role,
        text: m.text
      }));
      
      const req: PreviewRequest = {
        patient_profile: patientProfile,
        board_description: input,
        preferences: {},  // Let LLM decide layout based on user request
        conversation_history: conversationHistory,
      };
      
      const p = await api.preview(req);
      setPreview(p);
      
      // Add agent response
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: p.summary,
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "agent", text: `שגיאה: ${e.message}` }]);
    } finally {
      setUiState("idle");
    }
  };

  const startGeneration = async () => {
    if (!preview || uiState !== "idle") return;
    
    setUiState("generating");
    setMessages((m) => [...m, { role: "agent", text: "מתחיל ליצור את הלוח..." }]);
    
    try {
      const res = await api.generateStart({
        parsed: { 
          layout: preview.parsed.layout, 
          entities: preview.parsed.entities,
          topic: preview.parsed.topic 
        },
        profile: preview.profile,
        title,
      });
      
      setGenerationJobId(res.job_id);
      startPolling(res.job_id);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "agent", text: `שגיאה: ${e.message}` }]);
      setUiState("idle");
    }
  };

  const startPolling = (jobId: string) => {
    let lastMessage = "";
    
    pollingRef.current = setInterval(async () => {
      try {
        const status = await api.generateStatus(jobId);
        
        // Update progress message if changed
        if (status.progress.message !== lastMessage) {
          lastMessage = status.progress.message;
          setMessages((m) => {
            const lastMsg = m[m.length - 1];
            if (lastMsg?.role === "agent" && lastMsg.text.includes("יוצר")) {
              // Replace last progress message
              return [...m.slice(0, -1), { role: "agent", text: status.progress.message }];
            } else {
              // Add new progress message
              return [...m, { role: "agent", text: status.progress.message }];
            }
          });
        }
        
        // Check if completed
        if (status.progress.status === "completed" && status.assets) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setAssets(status.assets);
          
          // Build the generated board for display
          if (preview && status.assets.image_files) {
            const imageMap: { [key: string]: string } = {};
            preview.parsed.entities.forEach((entity: string, idx: number) => {
              // Map entities to generated image URLs
              imageMap[entity] = `/assets/${status.assets!.image_files![idx]}`;
            });
            
            setGeneratedBoard({
              title,
              entities: preview.parsed.entities,
              images: imageMap,
              layout: preview.parsed.layout
            });
          }
          
          setMessages((m) => [
            ...m.filter(msg => !msg.text.includes("יוצר תמונה")),
            { role: "agent", text: "הלוח מוכן! גלול למטה לצפייה והורדה." },
          ]);
          setUiState("idle");
          setGenerationJobId(null);
        } else if (status.progress.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setMessages((m) => [...m, { role: "agent", text: status.progress.message }]);
          setUiState("idle");
          setGenerationJobId(null);
        }
      } catch (e: any) {
        console.error("Polling error:", e);
      }
    }, 2000); // Poll every 2 seconds
  };

  const downloadPNG = async () => {
    if (!boardRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(boardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${title || "communication-board"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download PNG:", err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">סוכן יצירת לוח חדש</h1>
        <button
          onClick={() => setShowProfileForm(!showProfileForm)}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
        >
          {showProfileForm ? "הסתר" : "פרטי מטופל"}
        </button>
      </div>

      {/* Patient Profile Form */}
      {showProfileForm && (
        <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
          <h3 className="font-medium text-blue-900">פרטי המטופל (אופציונלי)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">גיל</label>
              <input
                type="number"
                value={patientProfile.age || ""}
                onChange={(e) => setPatientProfile({ ...patientProfile, age: parseInt(e.target.value) || undefined })}
                className="w-full border rounded-md p-2"
                placeholder="לדוגמה: 8"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">מגדר</label>
              <select
                value={patientProfile.gender || ""}
                onChange={(e) => setPatientProfile({ ...patientProfile, gender: e.target.value || undefined })}
                className="w-full border rounded-md p-2"
              >
                <option value="">לא צוין</option>
                <option value="ילד">ילד</option>
                <option value="ילדה">ילדה</option>
                <option value="גבר">גבר</option>
                <option value="אישה">אישה</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">האם קורא/ת?</label>
              <select
                value={patientProfile.can_read === undefined ? "" : patientProfile.can_read ? "yes" : "no"}
                onChange={(e) => setPatientProfile({ ...patientProfile, can_read: e.target.value === "yes" ? true : e.target.value === "no" ? false : undefined })}
                className="w-full border rounded-md p-2"
              >
                <option value="">לא צוין</option>
                <option value="yes">כן</option>
                <option value="no">לא</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">שפה שנייה</label>
              <input
                type="text"
                value={patientProfile.second_language || ""}
                onChange={(e) => setPatientProfile({ ...patientProfile, second_language: e.target.value || undefined })}
                className="w-full border rounded-md p-2"
                placeholder="לדוגמה: אנגלית"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">דת/מגזר</label>
              <select
                value={patientProfile.sector || ""}
                onChange={(e) => setPatientProfile({ ...patientProfile, sector: e.target.value || undefined })}
                className="w-full border rounded-md p-2"
              >
                <option value="">לא צוין</option>
                <option value="חילוני">חילוני</option>
                <option value="מסורתי">מסורתי</option>
                <option value="דתי">דתי</option>
                <option value="חרדי">חרדי</option>
                <option value="מוסלמי">מוסלמי</option>
                <option value="נוצרי">נוצרי</option>
                <option value="דרוזי">דרוזי</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">דתיות</label>
              <select
                value={patientProfile.religion || ""}
                onChange={(e) => setPatientProfile({ ...patientProfile, religion: e.target.value || undefined })}
                className="w-full border rounded-md p-2"
              >
                <option value="">לא צוין</option>
                <option value="דתי">דתי</option>
                <option value="לא דתי">לא דתי</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="border rounded-lg p-4 bg-white space-y-3 max-h-[500px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "agent" ? "text-purple-800" : "text-gray-800"}>
            <span className="font-medium">{m.role === "agent" ? "🤖 סוכן" : "👤 את/ה"}:</span>{" "}
            <span className="whitespace-pre-wrap">{m.text}</span>
          </div>
        ))}
        {uiState === "thinking" && (
          <div className="text-purple-600 italic">סוכן חושב...</div>
        )}
      </div>

      {/* Input Area - Always visible for flexible conversation */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-md p-2"
          placeholder="תאר/י את הלוח הנדרש או שנה/י את הבקשה..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={uiState !== "idle"}
        />
        <button 
          className="px-4 py-2 bg-purple-600 text-white rounded-md disabled:bg-gray-400" 
          onClick={send} 
          disabled={uiState !== "idle" || !input.trim()}
        >
          שלח
        </button>
      </div>

      {/* Action Area - Show when preview is ready */}
      {preview && uiState === "idle" && !assets && (
        <div className="border rounded-lg p-4 bg-green-50 space-y-3">
          <div className="font-medium text-green-800">מוכן ליצירה!</div>
          <div className="text-sm text-gray-700" dir="rtl">
            פריטים: {preview.parsed.entities.join(", ")}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="border rounded-md p-2 flex-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת הלוח"
              dir="rtl"
            />
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded-md" 
              onClick={startGeneration}
            >
              צור לוח
            </button>
          </div>
        </div>
      )}

      {/* Generated Board Display - Show when completed */}
      {generatedBoard && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">הלוח שלך מוכן!</h2>
            <button 
              onClick={downloadPNG}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Lucide.Download className="w-4 h-4" />
              הורד כ-PNG
            </button>
          </div>

          {/* A4 Frame Board */}
          <div 
            ref={boardRef}
            className="bg-white rounded-lg shadow-lg p-8 mx-auto"
            style={{ 
              width: '794px', 
              aspectRatio: '1 / 1.414',
              direction: 'rtl'
            }}
          >
            <h1 className="text-3xl font-bold text-center mb-6">{generatedBoard.title}</h1>
            
            <div 
              className={`grid gap-4 h-full`}
              style={{
                gridTemplateColumns: generatedBoard.layout === "3x3" ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
                gridTemplateRows: generatedBoard.layout === "3x3" ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'
              }}
            >
              {generatedBoard.entities.map((entity, idx) => (
                <div 
                  key={idx}
                  className="flex flex-col items-center justify-center rounded-xl p-4 bg-slate-100 shadow-sm"
                >
                  {generatedBoard.images[entity] && (
                    <img 
                      src={generatedBoard.images[entity]}
                      alt={entity}
                      className="w-full h-32 object-contain mb-2"
                      onError={(e) => {
                        // Fallback for missing images
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="text-center text-lg font-medium">{entity}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Backend PDF Link (alternative) */}
          {assets && (
            <div className="text-center">
              <a 
                className="text-blue-600 underline hover:text-blue-800" 
                href={assets.pdf_url} 
                target="_blank"
                rel="noreferrer"
              >
                או הורד את הגרסה הישנה (PDF מהשרת)
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


