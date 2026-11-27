// Demo catalog. Images are OpenMoji illustrations (CC BY-SA 4.0, https://openmoji.org).
import type { Category } from "@bwl/shared";

export const img = (codepoint: string) => `https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/${codepoint}.svg`;

export interface SeedProduct {
  sku: string;
  title: string;
  description: string;
  category: Category;
  price: number; // ₪, VAT included
  emoji: string; // OpenMoji codepoint
  stock: number;
  ageMin?: number;
  ageMax?: number;
}

export interface SeedShop {
  key: string;
  name: string;
  businessId: string;
  address: string;
  city: string;
  phone: string;
  contactName: string;
  emailLocal: string;
  brandColor: string;
  logoEmoji: string;
  pickupInfo: string;
  offersDelivery: boolean;
  products: SeedProduct[];
}

export const SHOPS: SeedShop[] = [
  {
    key: "carmel",
    name: "צעצועי הכרמל",
    businessId: "514839201",
    address: "רחוב הנביאים 12",
    city: "חיפה",
    phone: "04-8123456",
    contactName: "דנה לוי",
    emailLocal: "carmel-toys",
    brandColor: "#FF6B6B",
    logoEmoji: "1F9F8",
    pickupInfo: "א׳–ה׳ 10:00–19:00, ו׳ 9:00–14:00",
    offersDelivery: true,
    products: [
      { sku: "CT-TEDDY-L", title: "דובי פרוותי ענק", description: "דובון רך וחמוד בגובה 60 ס״מ, מושלם לחיבוקים.", category: "toys", price: 129, emoji: "1F9F8", stock: 6, ageMin: 2 },
      { sku: "CT-ROBOT-RC", title: "רובוט על שלט רחוק", description: "רובוט שרוקד, מדבר ויורה קצף. כולל סוללה נטענת.", category: "toys", price: 219, emoji: "1F916", stock: 4, ageMin: 6 },
      { sku: "CT-KITE", title: "עפיפון קשת בענן", description: "עפיפון צבעוני וקל להרכבה, כולל חוט 30 מ׳.", category: "toys", price: 59, emoji: "1FA81", stock: 12, ageMin: 5 },
      { sku: "CT-YOYO", title: "יו-יו מקצועי מואר", description: "יו-יו מתכת עם אורות LED וטריקים.", category: "toys", price: 39, emoji: "1FA80", stock: 20, ageMin: 7 },
      { sku: "CT-UNICORN", title: "חד-קרן מנצנץ", description: "בובת חד-קרן עם רעמה בצבעי הקשת.", category: "toys", price: 89, emoji: "1F984", stock: 0, ageMin: 3 },
      { sku: "CT-TREX", title: "טי-רקס שואג", description: "דינוזאור עם קולות שאגה ועיניים מאירות.", category: "toys", price: 149, emoji: "1F996", stock: 5, ageMin: 4 },
      { sku: "CT-WAND", title: "שרביט קסמים", description: "שרביט עם אורות וצלילים קסומים.", category: "toys", price: 49, emoji: "1FA84", stock: 15, ageMin: 4 },
      { sku: "CT-PUZZLE-1000", title: "פאזל 1000 חלקים – מפת העולם", description: "פאזל מאתגר לכל המשפחה.", category: "games", price: 79, emoji: "1F30D", stock: 8, ageMin: 9 },
      { sku: "CT-DICE-GAME", title: "משחק קופסה – מירוץ הקוביות", description: "משחק משפחתי מצחיק ל-2–6 שחקנים.", category: "games", price: 119, emoji: "1F3B2", stock: 7, ageMin: 6 },
      { sku: "CT-CHESS", title: "סט שחמט מעץ", description: "לוח מתקפל וכלים מעץ מלא.", category: "games", price: 139, emoji: "265F", stock: 3, ageMin: 7 },
      { sku: "CT-SCIENCE", title: "ערכת ניסויים מדעיים", description: "20 ניסויים בטוחים: הרי געש, קריסטלים ועוד.", category: "toys", price: 159, emoji: "1F9EA", stock: 6, ageMin: 8 },
    ],
  },
  {
    key: "books",
    name: "ספרים ועוד",
    businessId: "515002318",
    address: "שדרות רוטשילד 40",
    city: "תל אביב",
    phone: "03-5667788",
    contactName: "יוסי כהן",
    emailLocal: "sfarim-veod",
    brandColor: "#4D96FF",
    logoEmoji: "1F4DA",
    pickupInfo: "כל יום 9:00–21:00",
    offersDelivery: true,
    products: [
      { sku: "SV-HP-SET", title: "סדרת הארי פוטר – 7 ספרים", description: "המארז המלא בכריכה רכה.", category: "books", price: 349, emoji: "1F4DA", stock: 3, ageMin: 9 },
      { sku: "SV-DINO-ENC", title: "האנציקלופדיה הגדולה של הדינוזאורים", description: "מאות איורים ועובדות מדהימות.", category: "books", price: 98, emoji: "1F4D6", stock: 9, ageMin: 6 },
      { sku: "SV-COMIC", title: "חוברת קומיקס – גיבורי העל", description: "הרפתקאות מצוירות בעברית.", category: "books", price: 45, emoji: "1F4D5", stock: 14, ageMin: 7 },
      { sku: "SV-NATURE", title: "מדריך הטבע לילדים", description: "צמחים, חרקים ובעלי חיים בישראל.", category: "books", price: 69, emoji: "1F4D7", stock: 6, ageMin: 6 },
      { sku: "SV-SPACE-BOOK", title: "מסע אל הכוכבים", description: "ספר חלל עם דפים זוהרים בחושך.", category: "books", price: 79, emoji: "1F4D8", stock: 0, ageMin: 5 },
      { sku: "SV-TELESCOPE", title: "טלסקופ לילדים", description: "טלסקופ ראשון עם חצובה ואפליקציית כוכבים.", category: "toys", price: 249, emoji: "1F52D", stock: 2, ageMin: 8 },
      { sku: "SV-CRAYONS", title: "ערכת צבעי שעווה 64", description: "64 צבעים עם מחדד מובנה.", category: "art", price: 35, emoji: "1F58D", stock: 25, ageMin: 3 },
      { sku: "SV-PAINT", title: "ערכת ציור בצבעי מים", description: "24 צבעים, מכחולים ובלוק ציור.", category: "art", price: 89, emoji: "1F3A8", stock: 10, ageMin: 5 },
      { sku: "SV-PENCILS", title: "עפרונות צבעוניים מקצועיים", description: "48 עפרונות במארז מתכת.", category: "art", price: 59, emoji: "270F", stock: 11, ageMin: 6 },
      { sku: "SV-CRAFT", title: "ערכת יצירה – גזור והדבק", description: "מספריים בטוחים, דבק, נצנצים ומדבקות.", category: "art", price: 65, emoji: "2702", stock: 9, ageMin: 4 },
      { sku: "SV-BRUSHES", title: "סט מכחולים לאמנים צעירים", description: "12 מכחולים בגדלים שונים.", category: "art", price: 42, emoji: "1F58C", stock: 7, ageMin: 6 },
    ],
  },
  {
    key: "sport",
    name: "ספורט טופ",
    businessId: "516447709",
    address: "דרך חברון 101",
    city: "ירושלים",
    phone: "02-6543210",
    contactName: "אבי מזרחי",
    emailLocal: "sport-top",
    brandColor: "#2EC4B6",
    logoEmoji: "26BD",
    pickupInfo: "א׳–ה׳ 9:30–20:00",
    offersDelivery: false,
    products: [
      { sku: "ST-BALL-5", title: "כדורגל מקצועי מידה 5", description: "כדור תפור ביד, מתאים לדשא ולאספלט.", category: "sports", price: 119, emoji: "26BD", stock: 10, ageMin: 6 },
      { sku: "ST-BASKET", title: "כדורסל גומי", description: "אחיזה מעולה, מידה 5 לילדים.", category: "sports", price: 89, emoji: "1F3C0", stock: 8, ageMin: 6 },
      { sku: "ST-SKATE", title: "סקייטבורד מואר", description: "גלגלים זוהרים ומיסבים מהירים.", category: "sports", price: 199, emoji: "1F6F9", stock: 4, ageMin: 7 },
      { sku: "ST-BIKE-20", title: "אופני BMX 20 אינץ׳", description: "שלדת פלדה, בלמי V וכן תמיכה.", category: "sports", price: 899, emoji: "1F6B2", stock: 2, ageMin: 8 },
      { sku: "ST-GOAL", title: "שער כדורגל מתקפל", description: "שער לחצר בגודל 120x80 ס״מ.", category: "sports", price: 179, emoji: "1F945", stock: 0, ageMin: 5 },
      { sku: "ST-PINGPONG", title: "סט טניס שולחן", description: "2 מחבטים, 3 כדורים ורשת נשלפת.", category: "sports", price: 79, emoji: "1F3D3", stock: 6, ageMin: 7 },
      { sku: "ST-ROLLER", title: "רולרבליידס מתכווננים", description: "מתאים למידות 33–37, כולל מגנים.", category: "sports", price: 299, emoji: "1F6FC", stock: 3, ageMin: 7 },
      { sku: "ST-GUITAR", title: "גיטרה קלאסית לילדים", description: "גיטרה בגודל 3/4 עם תיק נשיאה.", category: "other", price: 349, emoji: "1F3B8", stock: 2, ageMin: 7 },
      { sku: "ST-LEGO-CASTLE", title: "לגו – טירת האבירים", description: "1,200 חלקים, 6 דמויות ודרקון.", category: "lego", price: 449, emoji: "1F3F0", stock: 3, ageMin: 9 },
      { sku: "ST-LEGO-ROCKET", title: "לגו – חללית משימה", description: "חללית עם רכב ירח ואסטרונאוטים.", category: "lego", price: 329, emoji: "1F680", stock: 5, ageMin: 8 },
      { sku: "ST-LEGO-FIRE", title: "לגו – כבאית ותחנה", description: "סולם מסתובב ותחנת כיבוי.", category: "lego", price: 259, emoji: "1F692", stock: 4, ageMin: 6 },
      { sku: "ST-LEGO-TRAIN", title: "לגו – רכבת נוסעים", description: "רכבת עם מסילה ומנוע.", category: "lego", price: 499, emoji: "1F682", stock: 1, ageMin: 7 },
      { sku: "ST-LEGO-BRICKS", title: "לגו – קופסת לבנים יצירתית", description: "900 לבנים בצבעים שונים.", category: "lego", price: 199, emoji: "1F9F1", stock: 9, ageMin: 4 },
    ],
  },
];
