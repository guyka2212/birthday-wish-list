import { z } from "zod";
import type { Theme } from "./themes";

/**
 * "Build my shop" quiz. The kid answers fun questions and we generate a one-of-a-kind guest-shop theme
 * (colors, emojis, name, tagline). The server is the single source of truth: the app fetches the questions
 * from GET /kid/quiz and previews themes with POST /kid/themes/preview.
 */

type Opt = { id: string; he: string; en: string; emoji: string; swatch?: string };
type Question = { id: QuizKey; he: string; en: string; emoji: string; options: Opt[] };

export const QUIZ_KEYS = ["color", "animal", "music", "hobby", "place", "treat"] as const;
export type QuizKey = (typeof QUIZ_KEYS)[number];

export const QUIZ: Question[] = [
  {
    id: "color",
    he: "מה הצבע האהוב עליך?",
    en: "What's your favorite color?",
    emoji: "🎨",
    options: [
      { id: "red", he: "אדום", en: "Red", emoji: "❤️", swatch: "#E63946" },
      { id: "orange", he: "כתום", en: "Orange", emoji: "🧡", swatch: "#F3722C" },
      { id: "yellow", he: "צהוב", en: "Yellow", emoji: "💛", swatch: "#F6C000" },
      { id: "green", he: "ירוק", en: "Green", emoji: "💚", swatch: "#2A9D3F" },
      { id: "blue", he: "כחול", en: "Blue", emoji: "💙", swatch: "#1E6FD9" },
      { id: "purple", he: "סגול", en: "Purple", emoji: "💜", swatch: "#7B2FF7" },
      { id: "pink", he: "ורוד", en: "Pink", emoji: "🩷", swatch: "#E0479E" },
      { id: "black", he: "שחור", en: "Black", emoji: "🖤", swatch: "#222831" },
    ],
  },
  {
    id: "animal",
    he: "איזו חיה הכי אהובה עליך?",
    en: "What's your favorite animal?",
    emoji: "🐾",
    options: [
      { id: "dog", he: "כלב", en: "Dog", emoji: "🐶" },
      { id: "cat", he: "חתול", en: "Cat", emoji: "🐱" },
      { id: "unicorn", he: "חד-קרן", en: "Unicorn", emoji: "🦄" },
      { id: "dinosaur", he: "דינוזאור", en: "Dinosaur", emoji: "🦖" },
      { id: "lion", he: "אריה", en: "Lion", emoji: "🦁" },
      { id: "dolphin", he: "דולפין", en: "Dolphin", emoji: "🐬" },
      { id: "panda", he: "פנדה", en: "Panda", emoji: "🐼" },
      { id: "butterfly", he: "פרפר", en: "Butterfly", emoji: "🦋" },
      { id: "horse", he: "סוס", en: "Horse", emoji: "🐴" },
    ],
  },
  {
    id: "music",
    he: "איזו מוזיקה את/ה הכי אוהב/ת?",
    en: "What music do you love most?",
    emoji: "🎵",
    options: [
      { id: "pop", he: "פופ", en: "Pop", emoji: "🎤" },
      { id: "rock", he: "רוק", en: "Rock", emoji: "🎸" },
      { id: "hiphop", he: "היפ-הופ", en: "Hip-hop", emoji: "🎧" },
      { id: "classical", he: "קלאסית", en: "Classical", emoji: "🎻" },
      { id: "electronic", he: "אלקטרונית", en: "Electronic", emoji: "🎛️" },
      { id: "israeli", he: "מוזיקה ישראלית", en: "Israeli", emoji: "🥁" },
      { id: "kpop", he: "קיי-פופ", en: "K-pop", emoji: "💜" },
    ],
  },
  {
    id: "hobby",
    he: "מה הכי כיף לך לעשות?",
    en: "What do you love doing?",
    emoji: "⭐",
    options: [
      { id: "football", he: "כדורגל", en: "Football", emoji: "⚽" },
      { id: "basketball", he: "כדורסל", en: "Basketball", emoji: "🏀" },
      { id: "drawing", he: "לצייר", en: "Drawing", emoji: "🖍️" },
      { id: "reading", he: "לקרוא", en: "Reading", emoji: "📚" },
      { id: "gaming", he: "משחקי מחשב", en: "Gaming", emoji: "🎮" },
      { id: "dancing", he: "לרקוד", en: "Dancing", emoji: "💃" },
      { id: "science", he: "מדע וניסויים", en: "Science", emoji: "🔬" },
      { id: "building", he: "לבנות", en: "Building", emoji: "🧱" },
      { id: "cooking", he: "לאפות ולבשל", en: "Baking", emoji: "🧁" },
    ],
  },
  {
    id: "place",
    he: "לאן היית רוצה לטוס?",
    en: "Where would you love to go?",
    emoji: "🗺️",
    options: [
      { id: "space", he: "לחלל", en: "Space", emoji: "🚀" },
      { id: "sea", he: "לעומק הים", en: "Under the sea", emoji: "🌊" },
      { id: "forest", he: "ליער קסום", en: "Magic forest", emoji: "🌲" },
      { id: "castle", he: "לטירה", en: "A castle", emoji: "🏰" },
      { id: "beach", he: "לחוף", en: "The beach", emoji: "🏖️" },
      { id: "city", he: "לעיר גדולה", en: "A big city", emoji: "🏙️" },
      { id: "mountains", he: "להרים מושלגים", en: "Snowy mountains", emoji: "🏔️" },
    ],
  },
  {
    id: "treat",
    he: "מה הפינוק הכי טעים?",
    en: "What's the yummiest treat?",
    emoji: "🍭",
    options: [
      { id: "pizza", he: "פיצה", en: "Pizza", emoji: "🍕" },
      { id: "icecream", he: "גלידה", en: "Ice cream", emoji: "🍦" },
      { id: "chocolate", he: "שוקולד", en: "Chocolate", emoji: "🍫" },
      { id: "cake", he: "עוגה", en: "Cake", emoji: "🎂" },
      { id: "fruit", he: "פירות", en: "Fruit", emoji: "🍓" },
      { id: "popcorn", he: "פופקורן", en: "Popcorn", emoji: "🍿" },
      { id: "candy", he: "סוכריות", en: "Candy", emoji: "🍭" },
    ],
  },
];

const ids = (k: QuizKey) => QUIZ.find((q) => q.id === k)!.options.map((o) => o.id) as [string, ...string[]];

export const quizAnswersSchema = z.object({
  color: z.enum(ids("color")),
  animal: z.enum(ids("animal")),
  music: z.enum(ids("music")),
  hobby: z.enum(ids("hobby")),
  place: z.enum(ids("place")),
  treat: z.enum(ids("treat")),
});
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

const opt = (k: QuizKey, id: string) => QUIZ.find((q) => q.id === k)!.options.find((o) => o.id === id)!;

const PALETTES: Record<string, { primary: string; accent: string; light: string; dark: string }> = {
  red: { primary: "#D62839", accent: "#FFD166", light: "#FFF0F0", dark: "#22080C" },
  orange: { primary: "#E8601C", accent: "#2EC4B6", light: "#FFF4EB", dark: "#241105" },
  yellow: { primary: "#F6C000", accent: "#7B2FF7", light: "#FFFBE6", dark: "#1F1A00" },
  green: { primary: "#23893A", accent: "#FFC93C", light: "#EFFBEF", dark: "#08200D" },
  blue: { primary: "#1E6FD9", accent: "#FFC93C", light: "#EAF4FF", dark: "#08122B" },
  purple: { primary: "#7B2FF7", accent: "#00E5FF", light: "#F4EEFF", dark: "#130E22" },
  pink: { primary: "#D63B92", accent: "#7FE7DC", light: "#FFF0F8", dark: "#24081A" },
  black: { primary: "#2B3240", accent: "#FFD23F", light: "#F1F2F4", dark: "#0C0D10" },
};

const ANIMAL_EXTRAS: Record<string, string[]> = {
  dog: ["🦴", "🐾"],
  cat: ["🧶", "🐾"],
  unicorn: ["🌈", "✨"],
  dinosaur: ["🦕", "🌋"],
  lion: ["👑", "🌿"],
  dolphin: ["🐚", "💧"],
  panda: ["🎋", "🍃"],
  butterfly: ["🌸", "🌼"],
  horse: ["🌾", "🍀"],
};
const MUSIC_EXTRAS: Record<string, string> = { pop: "🎶", rock: "⚡", hiphop: "🔥", classical: "🎼", electronic: "💿", israeli: "🎶", kpop: "✨" };
const PLACE_EXTRAS: Record<string, string> = { space: "🪐", sea: "🐠", forest: "🍄", castle: "👑", beach: "☀️", city: "🚕", mountains: "❄️" };

// he: plural/noun forms that read naturally in the tagline
const ANIMAL_PLURAL: Record<string, { he: string; en: string }> = {
  dog: { he: "כלבלבים", en: "Puppies" },
  cat: { he: "חתולים", en: "Cats" },
  unicorn: { he: "חדי-קרן", en: "Unicorns" },
  dinosaur: { he: "דינוזאורים", en: "Dinosaurs" },
  lion: { he: "אריות", en: "Lions" },
  dolphin: { he: "דולפינים", en: "Dolphins" },
  panda: { he: "פנדות", en: "Pandas" },
  butterfly: { he: "פרפרים", en: "Butterflies" },
  horse: { he: "סוסים", en: "Horses" },
};
const MUSIC_NAME: Record<string, { he: string; en: string }> = {
  pop: { he: "פופ", en: "pop" },
  rock: { he: "רוק", en: "rock" },
  hiphop: { he: "היפ-הופ", en: "hip-hop" },
  classical: { he: "מוזיקה קלאסית", en: "classical music" },
  electronic: { he: "מוזיקה אלקטרונית", en: "electronic beats" },
  israeli: { he: "שירים ישראליים", en: "Israeli songs" },
  kpop: { he: "קיי-פופ", en: "K-pop" },
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Readable text color (near-black or white) for a background, by WCAG contrast. */
function onColor(bg: string) {
  const l = luminance(bg);
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / (0.02 + 0.05)) ? "#FFFFFF" : "#1A1A2E";
}
function mix(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return "#" + ca.map((v, i) => Math.round(v + (cb[i]! - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Deterministic: the same answers always produce the same theme. */
export function generateTheme(a: QuizAnswers, kidFirstName: string): Theme {
  const p = PALETTES[a.color]!;
  // dark, moody shops for rock / hip-hop / electronic or a trip to space; everything else is bright
  const dark = ["rock", "hiphop", "electronic"].includes(a.music) || a.place === "space";
  // classical softens the palette into pastels, electronic makes the accent neon
  const primary = a.music === "classical" ? mix(p.primary, "#FFFFFF", 0.15) : p.primary;
  const accent = a.music === "electronic" ? "#00F5D4" : p.accent;
  const bg = dark ? p.dark : a.music === "classical" ? mix(p.light, "#FFFFFF", 0.4) : p.light;
  const text = dark ? "#F4F1FF" : mix(p.dark, "#1D2B4F", 0.5);
  const animal = opt("animal", a.animal);
  const confetti = [
    animal.emoji,
    ...(ANIMAL_EXTRAS[a.animal] ?? []),
    opt("hobby", a.hobby).emoji,
    opt("music", a.music).emoji,
    MUSIC_EXTRAS[a.music]!,
    opt("place", a.place).emoji,
    PLACE_EXTRAS[a.place]!,
    opt("treat", a.treat).emoji,
  ].filter((e, i, arr) => arr.indexOf(e) === i);
  const name = (kidFirstName || "").trim().slice(0, 30);
  const hobby = opt("hobby", a.hobby);
  return {
    id: "custom",
    nameHe: name ? `העולם של ${name}` : "העולם שלי",
    nameEn: name ? `${name}'s World` : "My World",
    emoji: animal.emoji,
    primary,
    accent,
    bg,
    text,
    onPrimary: onColor(primary),
    onAccent: onColor(accent),
    dark,
    confetti,
    taglineHe: `${ANIMAL_PLURAL[a.animal]!.he}, ${hobby.he} ו${MUSIC_NAME[a.music]!.he} ${opt("treat", a.treat).emoji} ברוכים הבאים לחנות של ${name || "יום ההולדת"}!`,
    taglineEn: `${ANIMAL_PLURAL[a.animal]!.en}, ${hobby.en.toLowerCase()} & ${MUSIC_NAME[a.music]!.en} ${opt("treat", a.treat).emoji} welcome to ${name ? `${name}'s` : "the birthday"} shop!`,
  };
}
