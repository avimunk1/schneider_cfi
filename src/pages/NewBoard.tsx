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

// Helper: Calculate optimal board layout
function calculateBoardLayout(count: number) {
  // A4 dimensions: 794px width, content area accounting for padding
  const contentWidth = 794 - 64; // 794px - (32px padding on each side)
  const contentHeight = 1123 - 120; // A4 height minus title space
  
  // Determine optimal grid dimensions (cols x rows)
  // Use asymmetric grids for better space utilization
  let cols: number, rows: number;
  
  if (count <= 4) {
    // 1-4: Use 2x2 grid
    cols = 2;
    rows = 2;
  } else if (count <= 6) {
    // 5-6: Use 3x2 grid (wider)
    cols = 3;
    rows = 2;
  } else if (count <= 9) {
    // 7-9: Use 3x3 grid
    cols = 3;
    rows = 3;
  } else if (count <= 12) {
    // 10-12: Use 4x3 grid
    cols = 4;
    rows = 3;
  } else if (count <= 16) {
    // 13-16: Use 4x4 grid
    cols = 4;
    rows = 4;
  } else {
    // 17+: Use 5x4 or larger
    cols = 5;
    rows = Math.ceil(count / 5);
  }
  
  // Calculate gap (minimum for easy selection)
  const minGap = 16;
  const maxGap = 30;
  let gap = Math.round(Math.min(contentWidth, contentHeight) / Math.max(cols, rows) * 0.06);
  gap = Math.max(minGap, Math.min(maxGap, gap));
  
  // Calculate maximum cell size that fits in the available space
  const availableWidthForCells = contentWidth - (gap * (cols - 1));
  const availableHeightForCells = contentHeight - (gap * (rows - 1));
  
  const maxCellWidth = Math.floor(availableWidthForCells / cols);
  const maxCellHeight = Math.floor(availableHeightForCells / rows);
  
  // Use the smaller dimension to keep cells square
  const baseCellSize = Math.min(maxCellWidth, maxCellHeight);
  
  // Generate spiral position mapping for the asymmetric grid
  const spiralPositions = generateAsymmetricSpiralPositions(rows, cols, count);
  
  return { gridSize: cols, rows, cols, baseCellSize, gap, spiralPositions };
}

// Helper: Generate spiral positions for asymmetric grids (rows x cols)
function generateAsymmetricSpiralPositions(rows: number, cols: number, count: number): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  
  // Phase 1: Corners (if they exist)
  const corners: Array<[number, number]> = [
    [0, 0],                 // top-left
    [0, cols - 1],          // top-right
    [rows - 1, cols - 1],   // bottom-right
    [rows - 1, 0],          // bottom-left
  ];
  
  for (const corner of corners) {
    if (positions.length < count && corner[0] < rows && corner[1] < cols) {
      positions.push(corner);
    }
  }
  
  // Phase 2: Edges (excluding corners)
  // Top edge
  for (let col = 1; col < cols - 1; col++) {
    if (positions.length < count) positions.push([0, col]);
  }
  
  // Right edge
  for (let row = 1; row < rows - 1; row++) {
    if (positions.length < count) positions.push([row, cols - 1]);
  }
  
  // Bottom edge
  for (let col = cols - 2; col > 0; col--) {
    if (positions.length < count) positions.push([rows - 1, col]);
  }
  
  // Left edge
  for (let row = rows - 2; row > 0; row--) {
    if (positions.length < count) positions.push([row, 0]);
  }
  
  // Phase 3: Interior cells (spiral inward)
  let layer = 1;
  while (positions.length < count && layer < Math.min(rows, cols) / 2) {
    const startRow = layer;
    const endRow = rows - layer - 1;
    const startCol = layer;
    const endCol = cols - layer - 1;
    
    if (startRow > endRow || startCol > endCol) break;
    
    // Top inner edge
    for (let col = startCol; col <= endCol && positions.length < count; col++) {
      positions.push([startRow, col]);
    }
    
    // Right inner edge
    for (let row = startRow + 1; row <= endRow && positions.length < count; row++) {
      positions.push([row, endCol]);
    }
    
    // Bottom inner edge
    if (endRow > startRow) {
      for (let col = endCol - 1; col >= startCol && positions.length < count; col--) {
        positions.push([endRow, col]);
      }
    }
    
    // Left inner edge
    if (endCol > startCol) {
      for (let row = endRow - 1; row > startRow && positions.length < count; row--) {
        positions.push([row, startCol]);
      }
    }
    
    layer++;
  }
  
  return positions;
}

export default function NewBoard() {
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "agent", text: "שלום! אני הסוכן שלך ליצירת לוח תקשורת.\n\nבואו נתחיל - ספר/י לי על הלוח שאת/ה צריך/ה, ואני אשאל שאלות הבהרה לפי הצורך." },
  ]);
  const [input, setInput] = useState("");
  const [uiState, setUiState] = useState<UIState>("idle");
  const [preview, setPreview] = useState<any>(null);
  const [title, setTitle] = useState("לוח תקשורת מותאם");
  const [assets, setAssets] = useState<{ png_url: string; pdf_url: string } | null>(null);
  const [generatedBoard, setGeneratedBoard] = useState<GeneratedBoard | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({});
  const [showProfileForm, setShowProfileForm] = useState(false);
  const pollingRef = useRef<number | null>(null);
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
            const apiBase = import.meta.env.VITE_API_BASE_URL || "";
            preview.parsed.entities.forEach((entity: string, idx: number) => {
              // Map entities to generated image URLs
              imageMap[entity] = `${apiBase}/assets/${status.assets!.image_files![idx]}`;
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
        } else if (status.progress.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setMessages((m) => [...m, { role: "agent", text: status.progress.message }]);
          setUiState("idle");
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

  // Quick test with existing images
  const [testImageCount, setTestImageCount] = useState<number>(4);
  
  const availableImages = [
    'img_00b6f530.png', 'img_10a94e8c.png', 'img_313f8140.png', 'img_3f37cd8c.png',
    'img_49454a03.png', 'img_5a4ded43.png', 'img_751c01b4.png', 'img_8f8ddb2e.png',
    'img_b5e4c86b.png', 'img_cf4229e4.png', 'img_d31fda13.png', 'img_e668d51e.png',
  ];
  
  const generateTestBoard = () => {
    const selectedImages = availableImages.slice(0, testImageCount);
    const entities = selectedImages.map((_, i) => `פריט ${i + 1}`);
    const images = Object.fromEntries(
      selectedImages.map((img, i) => [`פריט ${i + 1}`, `/assets/${img}`])
    );
    
    setGeneratedBoard({
      title: `לוח בדיקה - ${testImageCount} תמונות`,
      entities,
      images,
      layout: `${Math.ceil(Math.sqrt(testImageCount))}x${Math.ceil(Math.sqrt(testImageCount))}`
    });
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

      {/* Quick Test Section - Only show if enabled via env variable */}
      {import.meta.env.VITE_SHOW_TEST_FEATURES === 'true' && (
        <div className="border rounded-lg p-4 bg-green-50 space-y-3">
          <h3 className="font-medium text-green-900">🧪 בדיקה מהירה - תמונות קיימות</h3>
          <div className="flex items-center gap-3">
            <label className="text-sm">מספר תמונות:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={testImageCount}
              onChange={(e) => setTestImageCount(parseInt(e.target.value) || 1)}
              className="border rounded-md p-2 w-20"
            />
            <button
              onClick={generateTestBoard}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              צור לוח בדיקה
            </button>
          </div>
        </div>
      )}

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
            
            {(() => {
              const count = generatedBoard.entities.length;
              const { rows, cols, baseCellSize, gap, spiralPositions } = calculateBoardLayout(count);
              
              // Create a 2D grid to place entities
              const grid: Array<Array<{ entity: string; image: string } | null>> = Array(rows)
                .fill(null)
                .map(() => Array(cols).fill(null));
              
              // Place entities in spiral positions
              generatedBoard.entities.forEach((entity, idx) => {
                if (idx < spiralPositions.length) {
                  const [row, col] = spiralPositions[idx];
                  if (row < rows && col < cols) {
                    grid[row][col] = {
                      entity,
                      image: generatedBoard.images[entity]
                    };
                  }
                }
              });
              
              // Dynamic sizing based on count
              const imageHeight = baseCellSize * 0.65; // 65% of cell for image
              const fontSize = baseCellSize > 250 ? '1.5rem' : baseCellSize > 180 ? '1.25rem' : baseCellSize > 120 ? '1rem' : '0.875rem';
              const padding = baseCellSize > 250 ? '2rem' : baseCellSize > 180 ? '1.5rem' : baseCellSize > 120 ? '1rem' : '0.75rem';
              
              return (
                <div 
                  className="grid w-full h-full"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, ${baseCellSize}px)`,
                    gridTemplateRows: `repeat(${rows}, ${baseCellSize}px)`,
                    gap: `${gap}px`,
                    justifyContent: 'space-evenly',
                    alignContent: 'space-evenly'
                  }}
                >
                  {grid.flat().map((cell, idx) => {
                    if (!cell) {
                      // Empty cell
                      return <div key={`empty-${idx}`} />;
                    }
                    
                    return (
                      <div 
                        key={cell.entity}
                        className="flex flex-col items-center justify-center rounded-xl bg-slate-100 shadow-sm"
                        style={{ padding }}
                      >
                        {cell.image && (
                          <img 
                            src={cell.image}
                            alt={cell.entity}
                            className="w-full object-contain mb-2"
                            style={{ height: `${imageHeight}px` }}
                            onError={(e) => {
                              // Fallback for missing images
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div 
                          className="text-center font-medium"
                          style={{ fontSize }}
                        >
                          {cell.entity}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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


