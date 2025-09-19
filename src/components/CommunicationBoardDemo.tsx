// 📦 הוראות הרצה מקומית (CLI):
// 1) צור פרויקט React מינימלי (Vite/Next/CRA).
// 2) התקן תלויות: npm i react react-dom lucide-react html-to-image
// 3) התקן Tailwind ו/או השתמש בקומפוננטות שוות ערך במקום shadcn/ui.
// 4) שמור קובץ זה כ-CommunicationBoardDemo.tsx והצג אותו ב-Entry Point.
// 5) (אופציונלי) ניתן לספק נתונים חיצוניים בקבצי JSON (ראה למטה), אך בסביבה סגורה/סנדבוקס
//    עדיף לא להסתמך על dynamic import. כאן עוברים ל-fetch רך בזמן ריצה עם נפילה ל-Defaults.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as Lucide from "lucide-react"; // ייבוא מרוכז + fallback חכם
import * as htmlToImage from "html-to-image";

// ──────────────────────────────────────────────────────────────────────────────
//                               טיפוסים
// ──────────────────────────────────────────────────────────────────────────────

type Profile = {
  age: number;
  gender: "בן" | "גבר" | "אישה" | "ילדה" | string;
  sector: "חרדי" | "דתי" | "מסורתי" | "חילוני" | "מוסלמי" | string;
  context: "מחלקה" | "בית" | "בית חולים" | "מרפאה" | string;
};

type TileItem = {
  key: string;
  label: string;
  icon: string; // שם אייקון מ-lucide או מפתח מפה לוגי
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
//                   נתוני ברירת מחדל (נוחים להרצה כאן ומיד)
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
  // בסיסי
  { key: "לא נוח לי", label: "לא נוח לי", icon: "VenetianMask", categories: ["רגשות ושיתוף"], rules: {} },
  { key: "חם לי", label: "חם לי", icon: "Sun", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "קר לי", label: "קר לי", icon: "Gauge", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לעשות מקלחת", label: "מקלחת", icon: "ShowerHead", categories: ["רצונות ופעולות"], rules: {} },
  { key: "לאכול", label: "לאכול", icon: "Utensils", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לשתות", label: "לשתות", icon: "CupSoda", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לשירותים", label: "שירותים", icon: "Landmark", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "עייף", label: "עייף", icon: "BedDouble", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "טלוויזיה", label: "טלוויזיה", icon: "Tv", categories: ["רצונות ופעולות"], rules: {} },
  { key: "טאבלט", label: "טאבלט", icon: "TabletSmartphone", categories: ["רצונות ופעולות"], rules: {} },
  { key: "מוזיקה", label: "מוזיקה", icon: "Music4", categories: ["רצונות ופעולות"], rules: {} },
  { key: "לנגב פנים", label: "לנגב פנים", icon: "Hand", categories: ["רצונות ופעולות"], rules: {} },
  // רפואי
  { key: "בדיקה רפואית", label: "בדיקה רפואית", icon: "Stethoscope", categories: ["רפואי"], rules: { contextIn: ["בית חולים", "מרפאה"] } },
  { key: "בדיקת דם", label: "בדיקת דם", icon: "Droplets", categories: ["רפואי"], rules: { contextIn: ["בית חולים", "מרפאה"] } },
  { key: "חום", label: "למדוד חום", icon: "Thermometer", categories: ["רפואי"], rules: { contextIn: ["בית חולים", "מרפאה"] } },
  { key: "לחץ דם", label: "לחץ דם", icon: "Gauge", categories: ["רפואי"], rules: { contextIn: ["בית חולים", "מרפאה"] } },
  { key: "תרופה", label: "תרופה", icon: "Pill", categories: ["רפואי"], rules: { ageMax: 130 } },
  // דתי / תרבותי
  { key: "תפילה", label: "תפילה", icon: "StarOfDavid", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"], genderNot: "אישה", ageMin: 9 } },
  { key: "ברכה", label: "ברכה", icon: "ScrollText", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"] } },
  { key: "שבת", label: "שמירת שבת", icon: "MoonStar", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי"] } },
  { key: "צניעות", label: "צניעות", icon: "Shield", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"], gender: "אישה", ageMin: 12 } },
  // גילאי / תפקידים
  { key: "ליווי", label: "אני צריך ליווי", icon: "HandPlatter", categories: ["רגשות ושיתוף"], rules: { ageMin: 65 } },
  { key: "רופא", label: "רופא/ה", icon: "HeartPulse", categories: ["רפואי"], rules: { contextIn: ["בית חולים", "מרפאה"] } },
  { key: "תרומת צדקה", label: "לתת צדקה", icon: "HandCoins", categories: ["דת"], rules: { sectorIn: ["חרדי", "דתי", "מוסלמי"] } },
  { key: "סיגריה", label: "סיגריה", icon: "Cigarette", categories: ["יומיומי"], rules: { ageMin: 18, ageMax: 130 } },
  // ילדים / נוער
  { key: "הורה", label: "אבא/אמא", icon: "PersonStanding", categories: ["רגשות ושיתוף"], rules: { ageMax: 18 } },
  { key: "ללמוד", label: "ללמוד", icon: "BookOpen", categories: ["יומיומי"], rules: { ageMin: 6, ageMax: 18 } },
  { key: "חדר כושר", label: "להתאמן", icon: "Activity", categories: ["יומיומי"], rules: { ageMin: 13 } },
  // ארוחות
  { key: "ארוחת בוקר", label: "ארוחת בוקר", icon: "Coffee", categories: ["צרכים בסיסיים"], rules: {} },
  { key: "לחם", label: "לחם", icon: "Wheat", categories: ["צרכים בסיסיים"], rules: {} },
];

// ──────────────────────────────────────────────────────────────────────────────
//                     טעינת נתונים חיצוניים (אופציונלי)
//  אם רוצים להזין JSON חיצוני, הנח את הקבצים ב-public: /category_styles.json ו-/tile_library.json
//  כאן אנו משתמשים ב-fetch בזמן ריצה; אם 404/שגיאה—נשארים עם ברירת המחדל. אין dynamic import.
//  כמו כן, אם window.__BOARD_DATA__ קיים – יקבל עדיפות.
// ──────────────────────────────────────────────────────────────────────────────

function useDataLoader() {
  const [categoryStyles, setCategoryStyles] = useState<Record<string, string>>(CATEGORY_STYLES_DEFAULT);
  const [tileLibrary, setTileLibrary] = useState<TileItem[]>(TILE_LIBRARY_DEFAULT);

  useEffect(() => {
    // 1) נתונים שמוזרמים דרך חלון
    const winData = (typeof window !== "undefined" && (window as any).__BOARD_DATA__) || null;
    if (winData?.categoryStyles && typeof winData.categoryStyles === "object") {
      setCategoryStyles(winData.categoryStyles);
    }
    if (winData?.tileLibrary && Array.isArray(winData.tileLibrary)) {
      setTileLibrary(winData.tileLibrary);
    }

    // 2) ניסיון לקרוא JSON סטטי מתוך /public
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
//                            לוגיקת יצירת הלוח
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

  // קיבוץ לפי קטגוריה
  const byCat: Record<string, TileItem[]> = {};
  for (const tile of allowed) {
    for (const c of tile.categories) {
      (byCat[c] ||= []).push(tile);
    }
  }

  // איזון בין קטגוריות + דטרמיניזם
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
//                                UI
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

// ──────────────────────────────────────────────────────────────────────────────
//                                בדיקות (Diagnostics)
// ──────────────────────────────────────────────────────────────────────────────

function Diagnostics({ tileLibrary, categoryStyles }: { tileLibrary: TileItem[]; categoryStyles: Record<string, string> }) {
  const iconNames = Array.from(new Set(tileLibrary.map((t) => t.icon)));
  const missingIcons = iconNames.filter((n) => !(n in (Lucide as any)));
  const missingCategories = tileLibrary.flatMap((t) => t.categories).filter((c) => !categoryStyles[c]);

  // פרופילים לדוגמה (קיימים)
  const PRESETS = {
    "נער חרדי": { age: 15, gender: "בן", sector: "חרדי", context: "מחלקה" } as Profile,
    "גבר בן 70": { age: 70, gender: "גבר", sector: "חילוני", context: "מחלקה" } as Profile,
    "נער מוסלמי דתי": { age: 15, gender: "בן", sector: "מוסלמי", context: "מחלקה" } as Profile,
  } as const;

  const sampleProfiles: Profile[] = [PRESETS["נער חרדי"], PRESETS["גבר בן 70"], PRESETS["נער מוסלמי דתי"], { age: 12, gender: "בן", sector: "חילוני", context: "בית" }];
  const generationOk = sampleProfiles.every((p) => {
    try {
      const arr = computeTiles(p, 12, tileLibrary, Object.keys(categoryStyles));
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  });

  // ✅ בדיקות נוספות (מוסיפות, לא משנות את הקיימות)
  const hasTile = (key: string, arr: TileItem[]) => arr.some((t) => t.key === key);

  // גיל סף: "חדר כושר" ageMin 13
  const tilesAge12 = computeTiles({ age: 12, gender: "בן", sector: "חילוני", context: "בית" }, 24, tileLibrary, Object.keys(categoryStyles));
  const tilesAge13 = computeTiles({ age: 13, gender: "בן", sector: "חילוני", context: "בית" }, 24, tileLibrary, Object.keys(categoryStyles));
  const ageBoundaryOk = !hasTile("חדר כושר", tilesAge12) && hasTile("חדר כושר", tilesAge13);

  // הקשר: פריטי רפואה דורשים מרפאה/בית חולים
  const tilesHome = computeTiles({ age: 30, gender: "גבר", sector: "חילוני", context: "בית" }, 24, tileLibrary, Object.keys(categoryStyles));
  const tilesClinic = computeTiles({ age: 30, gender: "גבר", sector: "חילוני", context: "מרפאה" }, 24, tileLibrary, Object.keys(categoryStyles));
  const contextFilterOk = !hasTile("בדיקה רפואית", tilesHome) && hasTile("בדיקה רפואית", tilesClinic);

  // מגזר: שבת לא אמורה להופיע למוסלמי
  const tilesMuslim = computeTiles(PRESETS["נער מוסלמי דתי"], 24, tileLibrary, Object.keys(categoryStyles));
  const sectorExclusionOk = !hasTile("שבת", tilesMuslim);

  const allGreen = generationOk && missingIcons.length === 0 && missingCategories.length === 0;

  return (
    <Card>
      <CardContent className="p-4 text-sm">
        <div className="font-medium mb-2">בדיקות דמו</div>
        <ul className="list-disc pr-4 space-y-1">
          <li>יצירת לוח עבור פרופילים לדוגמה: {generationOk ? "עובר" : "נכשל"}</li>
          <li>אייקונים חסרים ב-lucide-react: {missingIcons.length === 0 ? "אין" : missingIcons.join(", ")}</li>
          <li>קטגוריות ללא צבע מוגדר: {missingCategories.length === 0 ? "אין" : missingCategories.join(", ")}</li>
        </ul>
        {allGreen && <div className="mt-2 text-emerald-700">✔ כל הבדיקות הבסיסיות עברו.</div>}

        <div className="mt-4 font-medium">בדיקות נוספות</div>
        <ul className="list-disc pr-4 space-y-1">
          <li>בדיקת גיל סף (12/13) ל"חדר כושר": {ageBoundaryOk ? "עובר" : "נכשל"}</li>
          <li>סינון לפי הקשר (בית/מרפאה) ל"בדיקה רפואית": {contextFilterOk ? "עובר" : "נכשל"}</li>
          <li>אי הכללת "שבת" לפרופיל מוסלמי: {sectorExclusionOk ? "עובר" : "נכשל"}</li>
        </ul>
      </CardContent>
    </Card>
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
//                            קומפוננטת הדמו
// ──────────────────────────────────────────────────────────────────────────────

export default function CommunicationBoardDemo() {
  const [preset, setPreset] = useState<"נער חרדי" | "גבר בן 70" | "נער מוסלמי דתי" | "מותאם">("נער חרדי");
  const [profile, setProfile] = useState<Profile>({ age: 15, gender: "בן", sector: "חרדי", context: "מחלקה" });
  const [limit, setLimit] = useState(16);
  const [selectedCategory, setSelectedCategory] = useState<string>("הכל");
  const boardRef = useRef<HTMLDivElement>(null);

  const { categoryStyles, tileLibrary } = useDataLoader();

  const tiles = useGeneratedTiles(profile, limit, tileLibrary, categoryStyles, selectedCategory);

  const onPreset = (p: typeof preset) => {
    setPreset(p);
    if (p === "נער חרדי") setProfile({ age: 15, gender: "בן", sector: "חרדי", context: "מחלקה" });
    else if (p === "גבר בן 70") setProfile({ age: 70, gender: "גבר", sector: "חילוני", context: "מחלקה" });
    else if (p === "נער מוסלמי דתי") setProfile({ age: 15, gender: "בן", sector: "מוסלמי", context: "מחלקה" });
  };

  const downloadPNG = async () => {
    if (!boardRef.current) return;
    const dataUrl = await htmlToImage.toPng(boardRef.current, { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `לוח-תקשורת_${profile.sector}_${profile.age}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">דמו – לוח תקשורת מותאם אישית</h1>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm">פרופיל מהיר</label>
            <select className="w-full border rounded-md p-2" value={preset} onChange={(e) => onPreset(e.target.value as any)}>
              {(["נער חרדי", "גבר בן 70", "נער מוסלמי דתי", "מותאם"] as const).map((k) => (
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
              {["מחלקה", "בית", "בית חולים", "מרפאה"].map((c) => (
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
            <Button onClick={downloadPNG} className="gap-2">
              <Lucide.Download className="w-4 h-4" /> הורדה כ‑PNG
            </Button>
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

      <Diagnostics tileLibrary={tileLibrary} categoryStyles={categoryStyles} />

      <div className="text-sm text-muted-foreground leading-relaxed">
        * ניתן להכניס קבצי JSON אל public ולהזינם בזמן ריצה (fetch). אם אינם קיימים, נטען ברירות מחדל.
      </div>
    </div>
  );
}
