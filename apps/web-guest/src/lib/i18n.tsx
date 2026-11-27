import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "he" | "en";

const he = {
  loading: "טוען…",
  errorTitle: "אופס! משהו השתבש",
  network: "אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.",
  retry: "לנסות שוב",
  notFoundTitle: "הרשימה לא נמצאה",
  notFoundBody: "ייתכן שהקישור שגוי, שהשיתוף כובה או שהרשימה נמחקה. בקשו קישור חדש.",
  wishlistOf: (n: string) => `רשימת המשאלות של ${n}`,
  daysLeft: (d: number) => (d === 0 ? "היום יום ההולדת! 🎉" : d === 1 ? "מחר יום ההולדת!" : `עוד ${d} ימים ליום ההולדת`),
  emptyList: "עוד אין מתנות ברשימה. חזרו לבדוק בקרוב!",
  buy: "לקנות את המתנה 🎁",
  inCart: "בסל ✓",
  gifted: "כבר נקנתה ✓",
  held: "מישהו אחר קונה עכשיו",
  outOfStock: "אזל מהמלאי",
  cart: "הסל שלי",
  cartEmpty: "הסל ריק",
  holdNote: (m: string) => `שמרנו לך את המתנות ל-${m} דקות`,
  holdExpired: "זמן השמירה נגמר. אפשר לבחור שוב.",
  remove: "הסרה",
  checkout: "לתשלום",
  total: "סה״כ",
  buyerName: "השם שלך",
  buyerEmail: "המייל שלך (לקבלה)",
  greeting: "ברכה ליום ההולדת (לא חובה)",
  greetingPh: "מזל טוב! שתהיה שנה מלאה בהפתעות…",
  delivery: "איך מקבלים את המתנה?",
  pickup: "איסוף מהחנות",
  shipping: "משלוח",
  address: "כתובת למשלוח",
  mockPayment: "זהו תשלום לדוגמה בלבד — לא נדרשים ולא נשמרים פרטי אשראי.",
  pay: (t: string) => `לשלם ${t}`,
  paying: "מעבד…",
  close: "סגירה",
  privacy: "בדף הזה מוצגים רק השם הפרטי, הרשימה והעיצוב. בלי פרטים אישיים.",
  shopBy: (s: string, c: string) => `${s} · ${c}`,
  thanks: "תודה! המתנה נקנתה 🎉",
  receipt: "קבלה",
  orderNo: "מספר הזמנה",
  date: "תאריך",
  forList: "עבור הרשימה של",
  buyer: "שם הקונה",
  item: "פריט",
  shop: "חנות",
  price: "מחיר",
  subtotal: "לפני מע״מ",
  vat: (r: number) => `מע״מ ${r}%`,
  totalPaid: "סה״כ ששולם",
  greetingCard: "כרטיס ברכה",
  pickupAt: "איסוף מ",
  deliveryTo: "משלוח אל",
  payment: "אמצעי תשלום",
  print: "הדפסה",
  downloadPdf: "הורדת PDF",
  emailSent: (e: string) => `עותק נשלח למייל ${e}`,
  invalidReceipt: "הקישור לקבלה לא תקף.",
  orderStatus: { new: "התקבלה", preparing: "בהכנה", ready: "מוכנה לאיסוף", shipped: "נשלחה", done: "הושלמה", cancelled: "בוטלה" } as Record<string, string>,
  landingTitle: "רשימת משאלות ליום הולדת",
  landingBody: "קיבלתם קישור לרשימה? פתחו אותו כדי לבחור מתנה. ילדים יוצרים רשימות באפליקציה, וחנויות מצטרפות דרך פורטל החנויות.",
  forShops: "לחנויות",
  resetTitle: "בחירת סיסמה חדשה",
  newPassword: "סיסמה חדשה",
  passwordRules: "לפחות 8 תווים, אותיות ומספרים",
  save: "לשמור",
  resetDone: "הסיסמה עודכנה! אפשר לחזור לאפליקציה ולהיכנס.",
  required: "שדה חובה",
  invalidEmail: "כתובת מייל לא תקינה",
  conflictTaken: "אוי! מישהו אחר קונה את המתנה הזאת ממש עכשיו.",
  language: "English",
};

export type Dict = typeof he;

const en: Dict = {
  loading: "Loading…",
  errorTitle: "Oops! Something went wrong",
  network: "Can't reach the server. Check your internet and try again.",
  retry: "Try again",
  notFoundTitle: "List not found",
  notFoundBody: "The link may be wrong, sharing may be off, or the list was deleted. Ask for a new link.",
  wishlistOf: (n) => `${n}'s birthday wish list`,
  daysLeft: (d) => (d === 0 ? "It's the birthday today! 🎉" : d === 1 ? "The birthday is tomorrow!" : `${d} days to the birthday`),
  emptyList: "No gifts on the list yet. Check back soon!",
  buy: "Buy this gift 🎁",
  inCart: "In cart ✓",
  gifted: "Already gifted ✓",
  held: "Someone else is buying it",
  outOfStock: "Out of stock",
  cart: "My cart",
  cartEmpty: "Your cart is empty",
  holdNote: (m) => `We're holding your gifts for ${m} minutes`,
  holdExpired: "Your hold expired. You can pick again.",
  remove: "Remove",
  checkout: "Checkout",
  total: "Total",
  buyerName: "Your name",
  buyerEmail: "Your email (for the receipt)",
  greeting: "Birthday greeting (optional)",
  greetingPh: "Happy birthday! Have a year full of surprises…",
  delivery: "How do you want the gift?",
  pickup: "Pick up at the shop",
  shipping: "Delivery",
  address: "Delivery address",
  mockPayment: "This is a demo payment — no card details are asked for or stored.",
  pay: (t) => `Pay ${t}`,
  paying: "Processing…",
  close: "Close",
  privacy: "This page only shows the first name, the list and the theme. No personal details.",
  shopBy: (s, c) => `${s} · ${c}`,
  thanks: "Thank you! The gift is bought 🎉",
  receipt: "Receipt",
  orderNo: "Order number",
  date: "Date",
  forList: "For the list of",
  buyer: "Buyer",
  item: "Item",
  shop: "Shop",
  price: "Price",
  subtotal: "Before VAT",
  vat: (r) => `VAT ${r}%`,
  totalPaid: "Total paid",
  greetingCard: "Greeting card",
  pickupAt: "Pick up from",
  deliveryTo: "Delivery to",
  payment: "Payment",
  print: "Print",
  downloadPdf: "Download PDF",
  emailSent: (e) => `A copy was emailed to ${e}`,
  invalidReceipt: "This receipt link is not valid.",
  orderStatus: { new: "Received", preparing: "Preparing", ready: "Ready for pickup", shipped: "Shipped", done: "Completed", cancelled: "Cancelled" },
  landingTitle: "Birthday Wish List",
  landingBody: "Got a link to a list? Open it to pick a gift. Kids create lists in the app, and shops join through the shop portal.",
  forShops: "For shops",
  resetTitle: "Choose a new password",
  newPassword: "New password",
  passwordRules: "At least 8 characters, letters and numbers",
  save: "Save",
  resetDone: "Password updated! Go back to the app and log in.",
  required: "Required",
  invalidEmail: "Invalid email",
  conflictTaken: "Oh! Someone else is buying this gift right now.",
  language: "עברית",
};

const Ctx = createContext<{ t: Dict; lang: Lang; setLang: (l: Lang) => void }>({ t: he, lang: "he", setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("bwl-lang") as Lang) || "he";
    } catch {
      return "he";
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    try {
      localStorage.setItem("bwl-lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  return <Ctx.Provider value={{ t: lang === "he" ? he : en, lang, setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
