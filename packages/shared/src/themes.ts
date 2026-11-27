// Guest-shop themes. Mirrors the `themes` table seeded in db/migrations/0003_lists.sql.
export const THEME_IDS = ["space", "unicorn", "football", "dinosaurs", "ocean", "gaming"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface Theme {
  /** a preset id, or "custom" for a theme generated from the quiz */
  id: ThemeId | "custom";
  nameHe: string;
  nameEn: string;
  emoji: string;
  /** main brand color of the theme */
  primary: string;
  /** contrasting accent (buttons, highlights) */
  accent: string;
  /** page background */
  bg: string;
  /** text color on `bg` */
  text: string;
  /** text color on `primary` */
  onPrimary: string;
  /** text color on `accent` */
  onAccent: string;
  /** whether the background is dark */
  dark: boolean;
  /** emoji sprinkled in the header art */
  confetti: string[];
  /** headline shown above the list */
  taglineHe: string;
  taglineEn: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  space: {
    id: "space",
    nameHe: "חלל",
    nameEn: "Space",
    emoji: "🚀",
    primary: "#4C3BCF",
    accent: "#FFD23F",
    bg: "#0F0C29",
    text: "#F4F1FF",
    onPrimary: "#FFFFFF",
    onAccent: "#1A1446",
    dark: true,
    confetti: ["🚀", "🪐", "⭐", "🌙", "👽", "☄️"],
    taglineHe: "משימה לחלל: מתנה ליום ההולדת!",
    taglineEn: "Mission to space: a birthday gift!",
  },
  unicorn: {
    id: "unicorn",
    nameHe: "חד-קרן",
    nameEn: "Unicorn",
    emoji: "🦄",
    primary: "#B530D6",
    accent: "#7FE7DC",
    bg: "#FFF0FB",
    text: "#3B1145",
    onPrimary: "#FFFFFF",
    onAccent: "#123B38",
    dark: false,
    confetti: ["🦄", "🌈", "✨", "💖", "⭐", "🧁"],
    taglineHe: "קסם של יום הולדת מחכה לך",
    taglineEn: "Birthday magic is waiting",
  },
  football: {
    id: "football",
    nameHe: "כדורגל",
    nameEn: "Football",
    emoji: "⚽",
    primary: "#167A3B",
    accent: "#FFFFFF",
    bg: "#E9F9EE",
    text: "#0D3B1E",
    onPrimary: "#FFFFFF",
    onAccent: "#0D3B1E",
    dark: false,
    confetti: ["⚽", "🥅", "🏆", "👟", "🎽", "📣"],
    taglineHe: "גוללל! בחרו מתנה ליום ההולדת",
    taglineEn: "Goal! Pick a birthday gift",
  },
  dinosaurs: {
    id: "dinosaurs",
    nameHe: "דינוזאורים",
    nameEn: "Dinosaurs",
    emoji: "🦖",
    primary: "#4E7D17",
    accent: "#FF8C42",
    bg: "#F3FBE6",
    text: "#26400A",
    onPrimary: "#FFFFFF",
    onAccent: "#3A1A00",
    dark: false,
    confetti: ["🦖", "🦕", "🌋", "🥚", "🌿", "🦴"],
    taglineHe: "רוווארר! מתנות בגודל של דינוזאור",
    taglineEn: "Roar! Dino-sized gifts",
  },
  ocean: {
    id: "ocean",
    nameHe: "אוקיינוס",
    nameEn: "Ocean",
    emoji: "🌊",
    primary: "#0069A3",
    accent: "#00F5D4",
    bg: "#E6F7FF",
    text: "#06324D",
    onPrimary: "#FFFFFF",
    onAccent: "#003D35",
    dark: false,
    confetti: ["🌊", "🐠", "🐙", "🐬", "🐚", "🦀"],
    taglineHe: "צוללים לים של מתנות",
    taglineEn: "Dive into a sea of gifts",
  },
  gaming: {
    id: "gaming",
    nameHe: "גיימינג",
    nameEn: "Gaming",
    emoji: "🎮",
    primary: "#7B2FF7",
    accent: "#00E5FF",
    bg: "#14101F",
    text: "#EDE7FF",
    onPrimary: "#FFFFFF",
    onAccent: "#00262B",
    dark: true,
    confetti: ["🎮", "👾", "🕹️", "🏆", "⚡", "💎"],
    taglineHe: "Level up! בחרו מתנה ליום ההולדת",
    taglineEn: "Level up! Choose a birthday gift",
  },
};

export function getTheme(id: string | null | undefined): Theme {
  return (id && (THEMES as Record<string, Theme>)[id]) || THEMES.unicorn;
}
