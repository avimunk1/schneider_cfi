// 📦 Local development instructions (CLI):
// 1) Create a minimal React project (Vite/Next/CRA).
// 2) Install dependencies: npm i react react-dom lucide-react html-to-image
// 3) Install Tailwind and/or use equivalent components instead of shadcn/ui.
// 4) Save this file as CommunicationBoardDemo.tsx and display it in Entry Point.
// 5) (Optional) You can provide external data in JSON files (see below), but in a closed/sandbox environment
//    it's better not to rely on dynamic import. Here we use soft fetch at runtime with fallback to Defaults.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as Lucide from "lucide-react"; // Centralized import + smart fallback
import * as htmlToImage from "html-to-image";

// ──────────────────────────────────────────────────────────────────────────────
//                               Types
// ──────────────────────────────────────────────────────────────────────────────

type Profile = {
  age: number;
  gender: "בן" | "גבר" | "אישה" | "ילדה" | string;
  sector: "חרדי" | "דתי" | "מסורתי" | "חילוני" | "מוסלמי" | string;
  context: "מחלקה" | "טיפול נמרץ" | "בית" | string;
};

type TileItem = {
  key: string;
  label: string;
  icon: string; // Icon name from lucide or logical mapping key
  categories: string[];
  rules?: {
    ageMin?: number;
    ageMax?: number;
    gender?: string;
    genderNot?: string;
    sectorIn?: string[];
    contextIn?: string[];
  };
};

// ──────────────────────────────────────────────────────────────────────────────
//                   Default data (convenient for running here immediately)
// ──────────────────────────────────────────────────────────────────────────────

const CATEGORY_STYLES_DEFAULT: Record<string, string> = {
  "צרכים בסיסיים": "bg-rose-200",
  "רגשות ושיתוף": "bg-teal-200",
  "רצונות ופעולות": "bg-pink-200",
  "רפואי": "bg-orange-200",
  "דת": "bg-amber-200",
  "יומיומי": "bg-indigo-200",
};

const TILE_LIBRARY_DEFAULT: TileItem[] = [
  // Basic
  { key: "לא נוח לי", label: "לא נוח לי", icon: "VenetianMask", categories: ["רגשות ושיתוף"], rules: {} },
  { key: "חם לי", label: "חם לי", icon: "Sun", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "קר לי", label: "קר לי", icon: "Gauge", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לעשות מקלחת", label: "מקלחת", icon: "ShowerHead", categories: ["רצונות ופעולות"], rules: {} },
  { key: "לאכול", label: "לאכול", icon: "Utensils", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לשתות", label: "לשתות", icon: "CupSoda", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לשירותים", label: "שירותים", icon: "Landmark", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "עייף", label: "עייף", icon: "BedDouble", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "טלוויזיה", label: "טלוויזיה", icon: "Tv", categories: ["רצונות ופעולות"], rules: { sectorIn: ["דתי", "מסורתי", "חילוני", "מוסלמי"] } },
  { key: "טאבלט", label: "טאבלט", icon: "TabletSmartphone", categories: ["רצונות ופעולות"], rules: { sectorIn: ["דתי", "מסורתי", "חילוני", "מוסלמי"] } },
  { key: "מוזיקה", label: "מוזיקה", icon: "Music4", categories: ["רצונות ופעולות"], rules: {} },
  { key: "לנגב פנים", label: "לנגב פנים", icon: "Hand", categories: ["רצונות ופעולות"], rules: {} },
  // Medical
  { key: "בדיקה רפואית", label: "בדיקה רפואית", icon: "Stethoscope", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "בדיקת דם", label: "בדיקת דם", icon: "Droplets", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "חום", label: "למדוד חום", icon: "Thermometer", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "לחץ דם", label: "לחץ דם", icon: "Gauge", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "תרופה", label: "תרופה", icon: "Pill", categories: ["רפואי"], rules: { ageMax: 130 } },
  // Religious / Cultural
  { key: "תפילה", label: "תפילה", icon: "StarOfDavid", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"], genderNot: "אישה", ageMin: 9 } },
  { key: "ברכה", label: "ברכה", icon: "ScrollText", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"] } },
  { key: "שבת", label: "שמירת שבת", icon: "MoonStar", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי"] } },
  { key: "צניעות", label: "צניעות", icon: "Shield", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"], gender: "אישה", ageMin: 12 } },
  // Age-based / Roles
  { key: "ליווי", label: "אני צריך ליווי", icon: "HandPlatter", categories: ["רגשות ושיתוף"], rules: { ageMin: 65 } },
  { key: "רופא", label: "רופא/ה", icon: "HeartPulse", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "תרומת צדקה", label: "לתת צדקה", icon: "HandCoins", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"] } },
  { key: "סיגריה", label: "סיגריה", icon: "Cigarette", categories: ["יומיומי"], rules: { ageMin: 18, ageMax: 130 } },
  // Children / Youth
  { key: "הורה", label: "אבא/אמא", icon: "PersonStanding", categories: ["רגשות ושיתוף"], rules: { ageMax: 18 } },
  { key: "ללמוד", label: "ללמוד", icon: "BookOpen", categories: ["יומיומי"], rules: { ageMin: 6, ageMax: 18 } },
  { key: "חדר כושר", label: "להתאמן", icon: "Activity", categories: ["יומיומי"], rules: { ageMin: 13 } },
  // Meals
  { key: "ארוחת בוקר", label: "ארוחת בוקר", icon: "Coffee", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לחם", label: "לחם", icon: "Wheat", categories: ["צרכים בסיסיים"], rules: {} },
  // Head injury / Medical communication
  { key: "כואב לי", label: "כואב לי", icon: "Zap", categories: ["רפואי", "צרכים בסיסיים"], rules: {} },
  { key: "כואב הראש", label: "כואב הראש", icon: "Brain", categories: ["רפואי"], rules: {} },
  { key: "סחרחורת", label: "סחרחורת", icon: "RotateCcw", categories: ["רפואי"], rules: {} },
  { key: "בחילה", label: "בחילה", icon: "Frown", categories: ["רפואי"], rules: {} },
  { key: "עייף מאוד", label: "עייף מאוד", icon: "Moon", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לא מבין", label: "לא מבין", icon: "HelpCircle", categories: ["רגשות ושיתוף"], rules: {} },
  { key: "כן", label: "כן", icon: "Check", categories: ["רגשות ושיתוף"], rules: {} },
  { key: "לא", label: "לא", icon: "X", categories: ["רגשות ושיתוף"], rules: {} },
  // Additional Medical Icons from Lucide
  { key: "אמבולנס", label: "אמבולנס", icon: "Ambulance", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "לב", label: "לב", icon: "Heart", categories: ["רפואי"], rules: {} },
  { key: "דופק", label: "דופק", icon: "Activity", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "זריקה", label: "זריקה", icon: "Syringe", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "פצע", label: "פצע", icon: "Bandage", categories: ["רפואי"], rules: {} },
  { key: "רנטגן", label: "רנטגן", icon: "Scan", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "אחות", label: "אחות", icon: "UserCheck", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "מיטה רפואית", label: "מיטה רפואית", icon: "Bed", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "חמצן", label: "חמצן", icon: "Wind", categories: ["רפואי"], rules: { contextIn: ["מחלקה", "טיפול נמרץ"] } },
  { key: "עין", label: "עין", icon: "Eye", categories: ["רפואי"], rules: {} },
  { key: "אוזן", label: "אוזן", icon: "Ear", categories: ["רפואי"], rules: {} },
  { key: "שיניים", label: "שיניים", icon: "Smile", categories: ["רפואי"], rules: {} },
  { key: "בטן", label: "בטן", icon: "Circle", categories: ["רפואי"], rules: {} },
  { key: "גב", label: "גב", icon: "User", categories: ["רפואי"], rules: {} },
  { key: "רגל", label: "רגל", icon: "Footprints", categories: ["רפואי"], rules: {} },
  { key: "יד", label: "יד", icon: "Hand", categories: ["רפואי"], rules: {} },
  // Additional tiles for common pediatric ICU needs
  { key: "שמיכה", label: "שמיכה", icon: "Shirt", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "גבס", label: "גבס", icon: "Bandage", categories: ["רפואי"], rules: {} },
  { key: "מגרד", label: "מגרד", icon: "Zap", categories: ["רפואי"], rules: {} },
  { key: "שורף", label: "שורף", icon: "Flame", categories: ["רפואי"], rules: {} },
  { key: "אמא", label: "אמא", icon: "Heart", categories: ["רגשות ושיתוף"], rules: { ageMax: 18 } },
  { key: "אבא", label: "אבא", icon: "User", categories: ["רגשות ושיתוף"], rules: { ageMax: 18 } },
  { key: "מפחד", label: "מפחד", icon: "Frown", categories: ["רגשות ושיתוף"], rules: {} },
  { key: "רוצה הביתה", label: "רוצה הביתה", icon: "Home", categories: ["רגשות ושיתוף"], rules: {} },
];

// ──────────────────────────────────────────────────────────────────────────────
//                     External data loading (optional)
//  If you want to provide external JSON, place the files in public: /category_styles.json and /tile_library.json
//  Here we use fetch at runtime; if 404/error—we stay with the default. No dynamic import.
//  Also, if window.__BOARD_DATA__ exists – it gets priority.
// ──────────────────────────────────────────────────────────────────────────────

function useDataLoader() {
  const [categoryStyles, setCategoryStyles] = useState<Record<string, string>>(CATEGORY_STYLES_DEFAULT);
  const [tileLibrary, setTileLibrary] = useState<TileItem[]>(TILE_LIBRARY_DEFAULT);

  useEffect(() => {
    // 1) Data streamed through window
    const winData = (typeof window !== "undefined" && (window as any).__BOARD_DATA__) || null;
    if (winData?.categoryStyles && typeof winData.categoryStyles === "object") {
      setCategoryStyles(winData.categoryStyles);
    }
    if (winData?.tileLibrary && Array.isArray(winData.tileLibrary)) {
      setTileLibrary(winData.tileLibrary);
    }

    // 2) Attempt to read static JSON from /public
    const tryFetchJson = async (url: string) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    (async () => {
      const cs = await tryFetchJson("/category_styles.json");
      if (cs && typeof cs === "object") setCategoryStyles(cs);
      const tl = await tryFetchJson("/tile_library.json");
      if (Array.isArray(tl)) setTileLibrary(tl);
    })();
  }, []);

  return { categoryStyles, tileLibrary };
}

// ──────────────────────────────────────────────────────────────────────────────
//                            Board generation logic
// ──────────────────────────────────────────────────────────────────────────────

function computeTiles(profile: Profile, limit: number, tileLibrary: TileItem[], categoryOrder: string[], selectedCategory?: string) {
  const { age, gender, sector, context } = profile || ({} as any);

  const allowed = tileLibrary.filter((t) => {
    const r = (t as any).rules || ({} as any);
    if (r.ageMin != null && age != null && age < r.ageMin) return false;
    if (r.ageMax != null && age != null && age > r.ageMax) return false;
    if (r.gender && gender && r.gender !== gender) return false;
    if (r.genderNot && gender && r.genderNot === gender) return false;
    if (r.sectorIn && sector && !r.sectorIn.includes(sector)) return false;
    if (r.contextIn && context && !r.contextIn.includes(context)) return false;
    // Add category filtering
    if (selectedCategory && selectedCategory !== "הכל" && !t.categories.includes(selectedCategory)) return false;
    return true;
  });

  // Group by category
  const byCat: Record<string, TileItem[]> = {};
  for (const tile of allowed) {
    for (const c of tile.categories) {
      (byCat[c] ||= []).push(tile);
    }
  }

  // Balance between categories + determinism
  const result: TileItem[] = [];
  const picked = new Set<string>();
  let safety = 0;
  while (result.length < Math.min(limit, allowed.length) && safety < 500) {
    for (const c of categoryOrder) {
      const pool = (byCat[c] || []).filter((t) => !picked.has(t.key));
      if (pool.length) {
        const t = pool[0];
        result.push(t);
        picked.add(t.key);
      }
      if (result.length >= limit) break;
    }
    safety++;
  }

  if (result.length < limit) {
    for (const t of allowed) {
      if (!picked.has(t.key)) {
        result.push(t);
        picked.add(t.key);
      }
      if (result.length >= limit) break;
    }
  }

  return result.slice(0, limit);
}

function useGeneratedTiles(profile: Profile, limit: number, tileLibrary: TileItem[], categoryStyles: Record<string, string>, selectedCategory?: string) {
  return useMemo(() => {
    const order = Object.keys(categoryStyles);
    return computeTiles(profile, limit, tileLibrary, order, selectedCategory);
  }, [profile, limit, tileLibrary, categoryStyles, selectedCategory]);
}

// ──────────────────────────────────────────────────────────────────────────────
//                                UI Components
// ──────────────────────────────────────────────────────────────────────────────

function Tile({ item, categoryStyles }: { item: TileItem; categoryStyles: Record<string, string> }) {
  const Icon = (Lucide as any)[item.icon] || (Lucide as any).Star || (Lucide as any).Smile;
  const cat = item.categories?.[0] || "יומיומי";
  const bg = categoryStyles[cat] || "bg-slate-200";
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl p-2 ${bg} shadow-sm`}>
      <Icon className="w-10 h-10 mb-2" />
      <div className="text-center text-sm font-medium leading-tight">{item.label}</div>
    </div>
  );
}

function Legend({ categoryStyles }: { categoryStyles: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {Object.entries(categoryStyles).map(([cat, bg]) => (
        <div key={cat} className="flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded-sm ${bg}`} />
          <span>{cat}</span>
        </div>
      ))}
    </div>
  );
}


function A4Frame({ children, title, categoryStyles }: { children: React.ReactNode; title: string; categoryStyles: Record<string, string> }) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border p-6 w-full max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Legend categoryStyles={categoryStyles} />
      </div>
      <div className="relative rounded-2xl border bg-gradient-to-br from-fuchsia-50 to-cyan-50 p-3">
        <div className="aspect-[1/1.414] w-full rounded-xl p-4 bg-white">{children}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
//                            Demo Component
// ──────────────────────────────────────────────────────────────────────────────

export default function CommunicationBoardDemo() {
  const [preset, setPreset] = useState<"נער חרדי" | "גבר בן 70" | "נער מוסלמי דתי" | "פגיעת ראש 3-6" | "פגיעת ראש 7+" | "בדיקה רפואית 7+" | "מותאם">("נער חרדי");
  const [profile, setProfile] = useState<Profile>({ age: 15, gender: "בן", sector: "חרדי", context: "מחלקה" });
  const [limit, setLimit] = useState(16);
  const [selectedCategory, setSelectedCategory] = useState<string>("הכל");
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiDescription, setAiDescription] = useState("תכין לי לוח לילדה בת 5 המאושפזת בטיפול נמרץ שיכלול תמונות בנושאים הבאים:\nכואב לי ; קר לי ; שמיכה\nאחות ; גבס ; מגרד ; שורף\nאמא ; מפחד");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStep, setAgentStep] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const { categoryStyles, tileLibrary } = useDataLoader();

  const tiles = useGeneratedTiles(profile, limit, tileLibrary, categoryStyles, selectedCategory);

  const onPreset = (p: typeof preset) => {
    setPreset(p);
    if (p === "נער חרדי") setProfile({ age: 15, gender: "בן", sector: "חרדי", context: "מחלקה" });
    else if (p === "גבר בן 70") setProfile({ age: 70, gender: "גבר", sector: "חילוני", context: "מחלקה" });
    else if (p === "נער מוסלמי דתי") setProfile({ age: 15, gender: "בן", sector: "מוסלמי", context: "מחלקה" });
    else if (p === "פגיעת ראש 3-6") setProfile({ age: 4, gender: "בן", sector: "חילוני", context: "טיפול נמרץ" });
    else if (p === "פגיעת ראש 7+") setProfile({ age: 10, gender: "בן", sector: "חילוני", context: "טיפול נמרץ" });
    else if (p === "בדיקה רפואית 7+") setProfile({ age: 10, gender: "בן", sector: "חילוני", context: "מחלקה" });
  };

  const downloadPNG = async () => {
    if (!boardRef.current) return;
    const dataUrl = await htmlToImage.toPng(boardRef.current, { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `לוח-תקשורת_${profile.sector}_${profile.age}.png`;
    link.href = dataUrl;
    link.click();
  };

  const generateAIBoard = async () => {
    if (!aiDescription.trim()) return;
    
    setIsGenerating(true);
    
    try {
      // Agent thinking steps
      const steps = [
        "מנתח את התיאור בעברית...",
        "מזהה מאפייני מטופל...",
        "חיפוש אייקונים רלוונטיים...",
        "בוחר קטגוריות מתאימות...",
        "מתאים את הלוח לצרכים התרבותיים...",
        "בונה לוח תקשורת מותאם..."
      ];
      
      for (let i = 0; i < steps.length; i++) {
        setAgentStep(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400)); // Random delay for realism
      }
      
      // Parse the Hebrew description and extract profile information
      const parsedProfile = parseHebrewDescription(aiDescription);
      
      // Final step
      setAgentStep("מסיים יצירת הלוח...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the profile and settings
      setProfile(parsedProfile.profile);
      setLimit(parsedProfile.tileCount);
      setSelectedCategory(parsedProfile.category);
      setPreset("מותאם");
      
      // Close modal and reset
      setShowAIModal(false);
      setAiDescription("");
      setAgentStep("");
      
    } catch (error) {
      console.error("Error generating AI board:", error);
      setAgentStep("שגיאה ביצירת הלוח");
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsGenerating(false);
      setAgentStep("");
    }
  };

  const parseHebrewDescription = (description: string): { profile: Profile, tileCount: number, category: string } => {
    // Enhanced Hebrew text analysis for medical scenarios
    const text = description.toLowerCase();
    
    // Extract age - more flexible patterns
    let age = 15;
    const ageMatch = text.match(/(\d+)\s*(שנ|גיל|בת|בן)/);
    if (ageMatch) age = parseInt(ageMatch[1]);
    
    // Extract gender - more patterns
    let gender = "בן";
    if (text.includes("בת") || text.includes("ילדה")) gender = "ילדה";
    else if (text.includes("אישה") && age > 18) gender = "אישה";
    else if (text.includes("גבר") && age > 18) gender = "גבר";
    else if (age <= 18 && text.includes("בן")) gender = "בן";
    
    // Extract sector
    let sector = "חילוני";
    if (text.includes("חרדי") || text.includes("דתי")) sector = "חרדי";
    else if (text.includes("מסורתי")) sector = "מסורתי";
    else if (text.includes("מוסלמי")) sector = "מוסלמי";
    
    // Extract context - more medical terms
    let context: string = "מחלקה";
    if (text.includes("טיפול נמרץ") || text.includes("נמרץ") || text.includes("מאושפז")) context = "טיפול נמרץ";
    else if (text.includes("בית")) context = "בית";
    
    // Enhanced category detection
    let category = "הכל";
    const medicalTerms = ["כאב", "תרופ", "רפואי", "גבס", "מגרד", "שורף", "אחות", "דופק"];
    const emotionalTerms = ["מפחד", "אמא", "אבא", "רגש", "דיבור", "הביתה"];
    const basicTerms = ["אוכל", "שתי", "בסיס", "שמיכה", "קר", "חם"];
    
    if (medicalTerms.some(term => text.includes(term))) category = "רפואי";
    else if (emotionalTerms.some(term => text.includes(term))) category = "רגשות ושיתוף";
    else if (basicTerms.some(term => text.includes(term))) category = "צרכים בסיסיים";
    
    // Extract tile count - count specific items mentioned
    let tileCount = 16;
    const itemCount = (text.match(/\n/g) || []).length; // Count line breaks as items
    if (itemCount > 8) tileCount = 20;
    else if (itemCount > 0 && itemCount <= 6) tileCount = 12;
    else if (text.includes("הרבה") || text.includes("גדול")) tileCount = 20;
    else if (text.includes("מעט") || text.includes("קטן")) tileCount = 12;
    
    return {
      profile: { age, gender, sector, context },
      tileCount,
      category
    };
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Schneider Logo Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img 
            src="/schneider-logo.png" 
            alt="Schneider Children's Medical Center" 
            className="h-16 w-auto"
            onError={(e) => {
              // Fallback if logo not found
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-3xl font-bold">לוח תקשורת מותאם אישית</h1>
            <p className="text-sm text-gray-600">מרכז שניידר לרפואת ילדים</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm">פרופיל מהיר</label>
            <select className="w-full border rounded-md p-2" value={preset} onChange={(e) => onPreset(e.target.value as any)}>
              {(["נער חרדי", "גבר בן 70", "נער מוסלמי דתי", "פגיעת ראש 3-6", "פגיעת ראש 7+", "בדיקה רפואית 7+", "מותאם"] as const).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">סוג פעילות</label>
            <select className="w-full border rounded-md p-2" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="הכל">הכל</option>
              {Object.keys(categoryStyles).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">גיל</label>
            <input
              type="number"
              className="w-full border rounded-md p-2"
              value={profile.age}
              onChange={(e) => {
                setPreset("מותאם");
                setProfile({ ...profile, age: parseInt(e.target.value || "0", 10) });
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">מגדר</label>
            <select
              className="w-full border rounded-md p-2"
              value={profile.gender}
              onChange={(e) => {
                setPreset("מותאם");
                setProfile({ ...profile, gender: e.target.value });
              }}
            >
              {["בן", "ילדה", "גבר", "אישה"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">מגזר/זהות</label>
            <select
              className="w-full border rounded-md p-2"
              value={profile.sector}
              onChange={(e) => {
                setPreset("מותאם");
                setProfile({ ...profile, sector: e.target.value });
              }}
            >
              {["חרדי", "דתי", "מסורתי", "חילוני", "מוסלמי"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">הקשר</label>
            <select
              className="w-full border rounded-md p-2"
              value={profile.context}
              onChange={(e) => {
                setPreset("מותאם");
                setProfile({ ...profile, context: e.target.value });
              }}
            >
              {["מחלקה", "טיפול נמרץ", "בית"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm">מספר אריחים</label>
            <input type="range" min={8} max={24} value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))} className="w-full" />
            <div className="text-xs text-muted-foreground">{limit} אריחים</div>
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button 
              onClick={() => setShowAIModal(true)} 
              className="px-4 py-2 rounded-md font-medium flex items-center gap-2"
              style={{ 
                backgroundColor: '#7c3aed', 
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Lucide.Sparkles className="w-4 h-4" style={{ color: 'white' }} /> 
              <span style={{ color: 'white' }}>יצירת לוח חכם</span>
            </button>
            <button 
              onClick={downloadPNG} 
              className="px-4 py-2 rounded-md font-medium flex items-center gap-2"
              style={{ 
                backgroundColor: '#3b82f6', 
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Lucide.Download className="w-4 h-4" style={{ color: 'white' }} /> 
              <span style={{ color: 'white' }}>הורדה כ‑PNG</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <A4Frame title="לוח תקשורת מותאם" categoryStyles={categoryStyles}>
        <div ref={boardRef} className="w-full h-full flex flex-col">
          <div className="grid grid-cols-4 gap-3 w-full h-full">
            {tiles.map((t) => (
              <Tile key={t.key} item={t} categoryStyles={categoryStyles} />
            ))}
          </div>
        </div>
      </A4Frame>

      {/* AI Generation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Lucide.Sparkles className="w-5 h-5 text-purple-600" />
                  יצירת לוח תקשורת חכם
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    הסבר בשפה חופשית מה תרצה לכלול בלוח
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    כלול בבקשה את מאפייני המטופל והלוח הנדרש. לדוגמה: "ילד בן 8 בטיפול נמרץ עם פגיעת ראש, צריך לוח רפואי עם אפשרויות כאב ותקשורת בסיסית"
                  </p>
                  <div className="relative">
                    <textarea
                      className="w-full border rounded-md p-3 h-32 resize-none"
                      placeholder="תאר את המטופל והלוח הנדרש..."
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      dir="rtl"
                    />
                    <button
                      onClick={() => setAiDescription("")}
                      className="absolute top-2 left-2 p-1 h-6 w-6 rounded"
                      title="נקה טקסט"
                      style={{
                        backgroundColor: '#9ca3af',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Lucide.X className="w-3 h-3" style={{ color: 'white' }} />
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="px-4 py-2 rounded-md text-white font-medium"
                    style={{ 
                      backgroundColor: '#6b7280', 
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ביטול
                  </button>
                  <button
                    onClick={generateAIBoard}
                    disabled={!aiDescription.trim() || isGenerating}
                    className="px-4 py-2 rounded-md text-white font-medium flex items-center gap-2"
                    style={{ 
                      backgroundColor: isGenerating || !aiDescription.trim() ? '#9ca3af' : '#7c3aed', 
                      color: 'white',
                      border: 'none',
                      cursor: isGenerating || !aiDescription.trim() ? 'not-allowed' : 'pointer',
                      opacity: isGenerating || !aiDescription.trim() ? '0.6' : '1'
                    }}
                  >
                    {isGenerating ? (
                      <>
                        <Lucide.Loader2 className="w-4 h-4 animate-spin" style={{ color: 'white' }} />
                        <span style={{ color: 'white' }}>יוצר לוח...</span>
                      </>
                    ) : (
                      <>
                        <Lucide.Wand2 className="w-4 h-4" style={{ color: 'white' }} />
                        <span style={{ color: 'white' }}>צור לוח חכם</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Agent thinking process */}
                {isGenerating && agentStep && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                      <span className="text-purple-800 font-medium">{agentStep}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
