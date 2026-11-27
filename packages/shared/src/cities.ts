// Israeli cities with approximate center coordinates, used to find the shops closest to a kid or a buyer.
// Only a city is ever asked for (never a street address) to keep kids' data minimal.
export interface City {
  id: string;
  he: string;
  en: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { id: "jerusalem", he: "ירושלים", en: "Jerusalem", lat: 31.7683, lng: 35.2137 },
  { id: "tel-aviv", he: "תל אביב", en: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
  { id: "haifa", he: "חיפה", en: "Haifa", lat: 32.794, lng: 34.9896 },
  { id: "rishon-lezion", he: "ראשון לציון", en: "Rishon LeZion", lat: 31.973, lng: 34.7925 },
  { id: "petah-tikva", he: "פתח תקווה", en: "Petah Tikva", lat: 32.084, lng: 34.8878 },
  { id: "ashdod", he: "אשדוד", en: "Ashdod", lat: 31.8014, lng: 34.6435 },
  { id: "netanya", he: "נתניה", en: "Netanya", lat: 32.3215, lng: 34.8532 },
  { id: "beersheba", he: "באר שבע", en: "Beersheba", lat: 31.252, lng: 34.7915 },
  { id: "holon", he: "חולון", en: "Holon", lat: 32.0158, lng: 34.7874 },
  { id: "bnei-brak", he: "בני ברק", en: "Bnei Brak", lat: 32.0807, lng: 34.8338 },
  { id: "ramat-gan", he: "רמת גן", en: "Ramat Gan", lat: 32.0684, lng: 34.8248 },
  { id: "givatayim", he: "גבעתיים", en: "Givatayim", lat: 32.0722, lng: 34.8125 },
  { id: "rehovot", he: "רחובות", en: "Rehovot", lat: 31.8928, lng: 34.8113 },
  { id: "bat-yam", he: "בת ים", en: "Bat Yam", lat: 32.0132, lng: 34.748 },
  { id: "ashkelon", he: "אשקלון", en: "Ashkelon", lat: 31.6688, lng: 34.5743 },
  { id: "kfar-saba", he: "כפר סבא", en: "Kfar Saba", lat: 32.175, lng: 34.9069 },
  { id: "raanana", he: "רעננה", en: "Ra'anana", lat: 32.1848, lng: 34.8713 },
  { id: "herzliya", he: "הרצליה", en: "Herzliya", lat: 32.1624, lng: 34.8447 },
  { id: "hod-hasharon", he: "הוד השרון", en: "Hod HaSharon", lat: 32.15, lng: 34.888 },
  { id: "rosh-haayin", he: "ראש העין", en: "Rosh HaAyin", lat: 32.0956, lng: 34.9566 },
  { id: "kiryat-ono", he: "קריית אונו", en: "Kiryat Ono", lat: 32.0636, lng: 34.8553 },
  { id: "hadera", he: "חדרה", en: "Hadera", lat: 32.434, lng: 34.9196 },
  { id: "modiin", he: "מודיעין", en: "Modi'in", lat: 31.898, lng: 35.0104 },
  { id: "shoham", he: "שוהם", en: "Shoham", lat: 31.999, lng: 34.946 },
  { id: "lod", he: "לוד", en: "Lod", lat: 31.951, lng: 34.8881 },
  { id: "ramla", he: "רמלה", en: "Ramla", lat: 31.9279, lng: 34.8625 },
  { id: "yavne", he: "יבנה", en: "Yavne", lat: 31.8781, lng: 34.7378 },
  { id: "ness-ziona", he: "נס ציונה", en: "Ness Ziona", lat: 31.9293, lng: 34.7987 },
  { id: "kiryat-gat", he: "קריית גת", en: "Kiryat Gat", lat: 31.61, lng: 34.7642 },
  { id: "sderot", he: "שדרות", en: "Sderot", lat: 31.525, lng: 34.5967 },
  { id: "dimona", he: "דימונה", en: "Dimona", lat: 31.07, lng: 35.0333 },
  { id: "eilat", he: "אילת", en: "Eilat", lat: 29.5577, lng: 34.9519 },
  { id: "beit-shemesh", he: "בית שמש", en: "Beit Shemesh", lat: 31.747, lng: 34.9881 },
  { id: "maale-adumim", he: "מעלה אדומים", en: "Ma'ale Adumim", lat: 31.777, lng: 35.298 },
  { id: "ariel", he: "אריאל", en: "Ariel", lat: 32.106, lng: 35.173 },
  { id: "zichron-yaakov", he: "זכרון יעקב", en: "Zichron Ya'akov", lat: 32.5714, lng: 34.952 },
  { id: "yokneam", he: "יקנעם", en: "Yokneam", lat: 32.6592, lng: 35.1094 },
  { id: "tirat-carmel", he: "טירת כרמל", en: "Tirat Carmel", lat: 32.76, lng: 34.97 },
  { id: "nesher", he: "נשר", en: "Nesher", lat: 32.766, lng: 35.044 },
  { id: "kiryat-ata", he: "קריית אתא", en: "Kiryat Ata", lat: 32.809, lng: 35.1066 },
  { id: "kiryat-bialik", he: "קריית ביאליק", en: "Kiryat Bialik", lat: 32.8333, lng: 35.0833 },
  { id: "kiryat-motzkin", he: "קריית מוצקין", en: "Kiryat Motzkin", lat: 32.8375, lng: 35.0775 },
  { id: "akko", he: "עכו", en: "Akko", lat: 32.9281, lng: 35.0818 },
  { id: "nahariya", he: "נהריה", en: "Nahariya", lat: 33.0059, lng: 35.0941 },
  { id: "karmiel", he: "כרמיאל", en: "Karmiel", lat: 32.9171, lng: 35.305 },
  { id: "nazareth", he: "נצרת", en: "Nazareth", lat: 32.6996, lng: 35.3035 },
  { id: "afula", he: "עפולה", en: "Afula", lat: 32.6078, lng: 35.2897 },
  { id: "umm-al-fahm", he: "אום אל-פחם", en: "Umm al-Fahm", lat: 32.519, lng: 35.153 },
  { id: "tiberias", he: "טבריה", en: "Tiberias", lat: 32.7959, lng: 35.53 },
  { id: "safed", he: "צפת", en: "Safed", lat: 32.9646, lng: 35.496 },
  { id: "kiryat-shmona", he: "קריית שמונה", en: "Kiryat Shmona", lat: 33.2073, lng: 35.5711 },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-'׳"״]+/g, "").replace(/קרית/g, "קריית");

/** Find a city by id, Hebrew or English name (forgiving about spaces, dashes and קרית/קריית). */
export function findCity(nameOrId: string | null | undefined): City | undefined {
  if (!nameOrId) return undefined;
  const n = norm(nameOrId);
  return CITIES.find((c) => c.id === nameOrId || norm(c.he) === n || norm(c.en) === n);
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance between two city names/ids, rounded to whole km (null if either is unknown). */
export function cityDistanceKm(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = findCity(from);
  const b = findCity(to);
  return a && b ? Math.round(distanceKm(a, b)) : null;
}

/** A kid sees shops within this radius — and always at least the NEAREST_MIN closest ones. */
export const NEARBY_RADIUS_KM = 30;
export const NEARBY_MIN_SHOPS = 2;

export const cityIdSchemaValues = CITIES.map((c) => c.id) as [string, ...string[]];
