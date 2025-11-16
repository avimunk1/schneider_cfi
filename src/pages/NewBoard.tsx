import React, { useState, useEffect, useRef } from "react";
import { api, PreviewRequest, ConversationMessage } from "@/lib/api";
import * as htmlToImage from "html-to-image";
import * as Lucide from "lucide-react";

type AgentMessage = { role: "agent" | "user"; text: string; ts: string };
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

const USER_NAME_STORAGE_KEY = "cfi_user_name";

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
  const createInitialAgentMessage = (): AgentMessage => ({
    role: "agent",
    text: "שלום! אני הסוכן שלך ליצירת לוח תקשורת.\n\nבואו נתחיל - ספר/י לי על הלוח שאת/ה צריך/ה, ואני אשאל שאלות הבהרה לפי הצורך.",
    ts: new Date().toISOString(),
  });

  const [messages, setMessages] = useState<AgentMessage[]>([createInitialAgentMessage()]);
  const [input, setInput] = useState("");
  const [uiState, setUiState] = useState<UIState>("idle");
  const [preview, setPreview] = useState<any>(null);
  const [title, setTitle] = useState("לוח תקשורת מותאם");
  const [assets, setAssets] = useState<{ png_url: string; pdf_url: string } | null>(null);
  const [generatedBoard, setGeneratedBoard] = useState<GeneratedBoard | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [pendingUserName, setPendingUserName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({
    age: 8,
    gender: "ילד",
    can_read: true,
    second_language: "עברית",
    sector: "יהודי",
    religion: "לא דתי",
  });
  const [showProfileForm, setShowProfileForm] = useState(true); // Open by default
  const [profileWasModified, setProfileWasModified] = useState(false); // Track if user actually changed any field
  const [isEditingAfterPreview, setIsEditingAfterPreview] = useState(false); // Track if user clicked "edit" after preview
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(USER_NAME_STORAGE_KEY);
      if (storedName) {
        setUserName(storedName);
        setPendingUserName(storedName);
        setShowNameModal(false);
      } else {
        setPendingUserName("");
        setShowNameModal(true);
      }
    } catch (error) {
      console.warn("Failed to access localStorage for user name:", error);
      setPendingUserName("");
      setShowNameModal(true);
    }
  }, []);

  const openNameModal = () => {
    setPendingUserName(userName || "");
    setShowNameModal(true);
  };

  const handleNameConfirm = () => {
    const trimmed = pendingUserName.trim();
    if (!trimmed) {
      return;
    }
    setUserName(trimmed);
    try {
      window.localStorage.setItem(USER_NAME_STORAGE_KEY, trimmed);
    } catch (error) {
      console.warn("Failed to persist user name:", error);
    }
    setShowNameModal(false);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uiState]);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const send = async () => {
    if (!input.trim() || uiState !== "idle") return;

    if (!userName.trim()) {
      openNameModal();
      return;
    }
    
    const userTimestamp = new Date().toISOString();
    const userMsg: AgentMessage = { role: "user", text: input, ts: userTimestamp };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsEditingAfterPreview(false); // Reset edit mode when sending new message
    setUiState("thinking");
    
    try {
      // Build conversation history for backend
      const conversationHistory: ConversationMessage[] = messages.map(m => ({
        role: m.role,
        text: m.text,
        timestamp: m.ts,
      }));
      
      const req: PreviewRequest = {
        patient_profile: profileWasModified ? patientProfile : {},  // Only send profile if user opened the form
        board_description: input,
        preferences: {},  // Let LLM decide layout based on user request
        conversation_history: conversationHistory,
        session_id: sessionId || undefined,
        user_name: userName.trim(),
      };
      
      const p = await api.preview(req);
      setPreview(p);
      setSessionId(p.session_id);
      
      // Add agent response (buttons will appear if message includes "הבנתי")
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: p.summary,
          ts: new Date().toISOString(),
        },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: `שגיאה: ${e.message}`, ts: new Date().toISOString() },
      ]);
    } finally {
      setUiState("idle");
    }
  };

  const startGeneration = async () => {
    if (!preview || uiState !== "idle" || !sessionId) return;
    
    setUiState("generating");
    setMessages((m) => [
      ...m,
      { role: "agent", text: "מתחיל ליצור את הלוח...", ts: new Date().toISOString() },
    ]);
    
    try {
      const res = await api.generateStart({
        parsed: { 
          layout: preview.parsed.layout, 
          entities: preview.parsed.entities,
          topic: preview.parsed.topic 
        },
        profile: preview.profile,
        title,
        session_id: sessionId,
        user_name: userName.trim() || undefined,
      });
      
      setSessionId(res.session_id);
      
      startPolling(res.job_id);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: `שגיאה: ${e.message}`, ts: new Date().toISOString() },
      ]);
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
            const progressTimestamp = new Date().toISOString();
            if (lastMsg?.role === "agent" && lastMsg.text.includes("יוצר")) {
              // Replace last progress message
              return [
                ...m.slice(0, -1),
                { role: "agent", text: status.progress.message, ts: progressTimestamp },
              ];
            } else {
              // Add new progress message
              return [
                ...m,
                { role: "agent", text: status.progress.message, ts: progressTimestamp },
              ];
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
            { role: "agent", text: "הלוח מוכן! גלול למטה לצפייה והורדה.", ts: new Date().toISOString() },
          ]);
          setUiState("idle");
        } else if (status.progress.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setMessages((m) => [
            ...m,
            { role: "agent", text: status.progress.message, ts: new Date().toISOString() },
          ]);
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
      const element = boardRef.current;
      
      console.log('=== DOWNLOAD PNG START ===');
      console.log('Original element dimensions:', {
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      });
      console.log('Original computed styles:', {
        width: window.getComputedStyle(element).width,
        height: window.getComputedStyle(element).height,
        maxWidth: window.getComputedStyle(element).maxWidth,
        overflow: window.getComputedStyle(element).overflow,
        position: window.getComputedStyle(element).position,
      });
      
      // Clone the board so we can render it off-screen for capture
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.right = 'auto';
      clone.style.margin = '0 auto';
      clone.style.zIndex = '9999';
      clone.style.width = '794px';
      clone.style.maxWidth = '794px';
      clone.style.background = '#ffffff';
      clone.style.boxShadow = 'none';
      clone.style.overflow = 'visible';
      clone.style.direction = 'rtl';
      clone.id = 'board-download-clone';
      
      document.body.appendChild(clone);
      
      // Wait a moment for layout & fonts to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cloneHeight = clone.scrollHeight;
      console.log('Clone dimensions for capture:', {
        offsetWidth: clone.offsetWidth,
        offsetHeight: clone.offsetHeight,
        scrollWidth: clone.scrollWidth,
        scrollHeight: cloneHeight,
      });
      
      console.log('Calling htmlToImage.toPng with:', {
        width: 794,
        height: cloneHeight,
        pixelRatio: 2,
      });
      
      const dataUrl = await htmlToImage.toPng(clone, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 794,
        height: cloneHeight,
        cacheBust: true,
      });
      
      console.log('PNG generated, data URL length:', dataUrl.length);
      
      // Remove the clone after capture
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
      console.log('Temporary clone removed');
      
      const link = document.createElement("a");
      link.download = `${title || "communication-board"}.png`;
      link.href = dataUrl;
      link.click();
      console.log('=== DOWNLOAD PNG COMPLETE ===');
    } catch (err) {
      console.error("Failed to download PNG:", err);
      console.error('Error stack:', err);
      const cloneNode = document.getElementById('board-download-clone');
      if (cloneNode && cloneNode.parentNode) {
        cloneNode.parentNode.removeChild(cloneNode);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startNewConversation = () => {
    setMessages([createInitialAgentMessage()]);
    setInput("");
    setPreview(null);
    setAssets(null);
    setGeneratedBoard(null);
    setIsEditingAfterPreview(false);
    setUiState("idle");
    setSessionId(null);
    setFeedbackRating(null);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating || !sessionId) return;
    
    try {
      await api.submitFeedback({
        session_id: sessionId,
        rating: feedbackRating,
        comment: feedbackComment || undefined,
      });
      setFeedbackSubmitted(true);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("שגיאה בשליחת המשוב. אנא נסה שוב.");
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
    <>
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg space-y-4" dir="rtl">
            <div className="space-y-1 text-right">
              <h2 className="text-lg font-semibold text-gray-900">ברוך/ה הבא/ה!</h2>
              <p className="text-sm text-gray-600">
                אנא הזן/י את שמך כדי שנוכל לשייך את ההפעלה הזו.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 text-right" htmlFor="user-name-input">
                שם
              </label>
              <input
                id="user-name-input"
                type="text"
                value={pendingUserName}
                onChange={(e) => setPendingUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleNameConfirm();
                  }
                }}
                className="w-full rounded-md border border-gray-300 p-2 text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={'לדוגמה: ד"ר כהן'}
              />
            </div>
            <div className="flex justify-end gap-3">
              {userName && (
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    setPendingUserName(userName);
                    setShowNameModal(false);
                  }}
                >
                  ביטול
                </button>
              )}
              <button
                type="button"
                onClick={handleNameConfirm}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-gray-400"
                disabled={!pendingUserName.trim()}
              >
                המשך
              </button>
            </div>
          </div>
        </div>
      )}
      <div dir="rtl" className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">סוכן יצירת לוח חדש</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={openNameModal}
            className="px-3 py-2 text-sm border border-gray-300 bg-white hover:bg-gray-100 rounded-md w-full sm:w-auto text-right"
          >
            {userName ? `👤 ${userName}` : "הצג חלון להזנת שם"}
          </button>
          <button
            onClick={() => setShowProfileForm(!showProfileForm)}
            className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md w-full sm:w-auto"
          >
            {showProfileForm ? "הסתר" : "פרטי מטופל"}
          </button>
        </div>
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
        <div className="border rounded-lg p-3 sm:p-4 bg-blue-50 space-y-3">
          <h3 className="font-medium text-blue-900">פרטי המטופל (אופציונלי)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">גיל</label>
              <input
                type="number"
                value={patientProfile.age || ""}
                onChange={(e) => {
                  setProfileWasModified(true);
                  const age = parseInt(e.target.value) || undefined;
                  const updates: Partial<PatientProfile> = { age };
                  
                  // Auto-set gender based on age
                  if (age && age < 18) {
                    updates.gender = "ילד";
                  } else if (age && age >= 18) {
                    updates.gender = "גבר";
                  }
                  
                  // Auto-set can_read based on age
                  if (age && age < 7) {
                    updates.can_read = false;
                  } else if (age && age >= 7) {
                    updates.can_read = true;
                  }
                  
                  setPatientProfile({ 
                    ...patientProfile, 
                    ...updates
                  });
                }}
                className="w-full border rounded-md p-2"
                placeholder="לדוגמה: 8"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">מגדר</label>
              <select
                value={patientProfile.gender || ""}
                onChange={(e) => {
                  setProfileWasModified(true);
                  setPatientProfile({ ...patientProfile, gender: e.target.value || undefined });
                }}
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
                onChange={(e) => {
                  setProfileWasModified(true);
                  setPatientProfile({ ...patientProfile, can_read: e.target.value === "yes" ? true : e.target.value === "no" ? false : undefined });
                }}
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
                onChange={(e) => {
                  setProfileWasModified(true);
                  setPatientProfile({ ...patientProfile, second_language: e.target.value || undefined });
                }}
                className="w-full border rounded-md p-2"
                placeholder="לדוגמה: אנגלית"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">דת/מגזר</label>
              <select
                value={patientProfile.sector || ""}
                onChange={(e) => {
                  setProfileWasModified(true);
                  setPatientProfile({ ...patientProfile, sector: e.target.value || undefined });
                }}
                className="w-full border rounded-md p-2"
              >
                <option value="יהודי">יהודי</option>
                <option value="מוסלמי">מוסלמי</option>
                <option value="נוצרי">נוצרי</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">דתיות</label>
              <select
                value={patientProfile.religion || ""}
                onChange={(e) => {
                  setProfileWasModified(true);
                  setPatientProfile({ ...patientProfile, religion: e.target.value || undefined });
                }}
                className="w-full border rounded-md p-2"
              >
                <option value="דתי">דתי</option>
                <option value="לא דתי">לא דתי</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="border rounded-lg p-3 sm:p-4 bg-white space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "agent" ? "text-purple-800" : "text-gray-800"}>
            <span className="font-medium inline-flex items-center gap-1">
              {m.role === "agent" ? (
                <>
                  <img src="/PS_icon.png" alt="Agent" className="w-5 h-5 inline-block" />
                  <span>סוכן</span>
                </>
              ) : (
                "👤 את/ה"
              )}:
            </span>{" "}
            <span className="whitespace-pre-wrap">{m.text}</span>
            
            {/* Show YES/NO buttons after the last agent message if preview is ready AND agent confirmed understanding */}
            {m.role === "agent" && i === messages.length - 1 && preview && uiState === "idle" && !assets && m.text.includes("הבנתי") && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={startGeneration}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium w-full sm:w-auto"
                >
                  ✅ כן, התחל
                </button>
                <button
                  onClick={() => {
                    setPreview(null);
                    setIsEditingAfterPreview(true);
                    setMessages((m) => [
                      ...m,
                      { role: "agent", text: "בסדר, מה תרצה לשנות?", ts: new Date().toISOString() },
                    ]);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium w-full sm:w-auto"
                >
                  ✏️ ערוך פרטים
                </button>
              </div>
            )}
          </div>
        ))}
        {uiState === "thinking" && (
          <div className="text-purple-600 italic">סוכן חושב...</div>
        )}
        {uiState === "generating" && (
          <div className="text-green-600 italic">יוצר את הלוח...</div>
        )}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Hide during generation and when preview buttons are shown (unless user clicked edit) */}
      {(() => {
        const lastMessage = messages[messages.length - 1];
        const showingPreviewButtons = lastMessage?.role === "agent" && preview && uiState === "idle" && !assets && lastMessage.text.includes("הבנתי");
        const shouldShowInput = uiState !== "generating" && (!showingPreviewButtons || isEditingAfterPreview);
        
        return shouldShowInput && (
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
        );
      })()}

      {/* Title edit - Hidden for now (not in use) */}
      {false && preview && uiState === "idle" && !assets && (
        <div className="border rounded-lg p-3 bg-blue-50">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">כותרת הלוח:</label>
            <input
              className="border rounded-md p-2 flex-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת הלוח"
              dir="rtl"
            />
          </div>
        </div>
      )}

      {/* Generated Board Display - Show when completed */}
      {generatedBoard && (
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-center">הלוח שלך מוכן!</h2>

          {/* A4 Frame Board - Container with scroll */}
          <div 
            className="bg-white rounded-lg shadow-lg mx-auto w-full overflow-x-auto"
            style={{ 
              maxWidth: '100%',
              direction: 'rtl'
            }}
          >
            {/* Inner board - always 794px wide for consistent layout */}
            <div
              ref={boardRef}
              className="p-4 sm:p-8 mx-auto"
              style={{
                width: '794px',
                minHeight: 'fit-content',
              }}
            >
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-4 sm:mb-6">{generatedBoard.title}</h1>
            
            {(() => {
              const count = generatedBoard.entities.length;
              const { rows, cols, baseCellSize, gap, spiralPositions } = calculateBoardLayout(count);
              console.log('Board layout:', { count, rows, cols, baseCellSize, gap });
              
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
                  className="grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, ${baseCellSize}px)`,
                    gridTemplateRows: `repeat(${rows}, ${baseCellSize}px)`,
                    gap: `${gap}px`,
                    justifyContent: 'start', // In RTL context, 'start' means right side
                    alignContent: 'start'
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
          </div>

          {/* Action Buttons - Moved here below the board */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={downloadPNG}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium w-full sm:w-auto"
            >
              <Lucide.Download className="w-5 h-5" />
              הורד כ-PNG
            </button>
            <button 
              onClick={startNewConversation}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium w-full sm:w-auto"
            >
              <Lucide.Plus className="w-5 h-5" />
              שיחה חדשה
            </button>
          </div>

          {/* User Feedback Section */}
          {!feedbackSubmitted ? (
            <div className="border rounded-lg p-4 sm:p-6 bg-blue-50 space-y-4">
              <h3 className="font-medium text-blue-900 text-center text-lg">
                איך היה הלוח? נשמח למשוב שלך 😊
              </h3>
              
              {/* Star Rating */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-gray-600">דרג את הלוח:</span>
                <div className="flex gap-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className="text-4xl transition-all hover:scale-110 focus:outline-none"
                      title={`${star} כוכבים`}
                      type="button"
                    >
                      {feedbackRating && star <= feedbackRating ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                {feedbackRating && (
                  <div className="text-center text-sm text-gray-600 font-medium">
                    בחרת: {feedbackRating} מתוך 5 כוכבים
                  </div>
                )}
              </div>
              
              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                  הערות נוספות (אופציונלי)
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="מה היה טוב? מה אפשר לשפר?"
                  className="w-full border border-gray-300 rounded-md p-3 min-h-[100px] text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  dir="rtl"
                />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedbackRating}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
                type="button"
              >
                {feedbackRating ? 'שלח משוב' : 'אנא בחר דירוג תחילה'}
              </button>
            </div>
          ) : (
            <div className="text-center py-6 bg-green-50 rounded-lg border border-green-200">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-green-700 font-medium text-lg">תודה רבה על המשוב!</div>
              <div className="text-sm text-green-600 mt-1">המשוב שלך עוזר לנו להשתפר</div>
            </div>
          )}

          {/* Backend PDF Link - Stays at bottom */}
          {assets && (
            <div className="text-center pt-4 border-t border-gray-200">
              <a 
                className="text-sm text-blue-600 underline hover:text-blue-800" 
                href={`${import.meta.env.VITE_API_BASE_URL || ""}${assets.pdf_url}`}
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
    </>
  );
}


