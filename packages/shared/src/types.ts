// Response DTOs shared by the API and the web apps. (The Android app mirrors these in Kotlin.)
import type { Category, OrderStatus } from "./schemas";
import type { Theme, ThemeId } from "./themes";
import type { QuizAnswers } from "./quiz";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface KidProfile {
  id: string;
  username: string;
  firstName: string;
  email: string;
  avatar: string;
  birthday: string | null;
  locale: "he" | "en";
  consentStatus: "pending" | "verified";
  /** a profile photo was uploaded (fetch it from GET /kid/me/photo) */
  hasPhoto: boolean;
  /** city id (see CITIES) or null if not set yet */
  city: string | null;
}

export interface ShopSummary {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  brandColor: string;
  /** distance from the kid's city, when known */
  distanceKm?: number | null;
}

export interface CatalogProduct {
  id: string;
  title: string;
  description: string;
  category: Category;
  priceAgorot: number;
  imageUrl: string | null;
  ageMin: number | null;
  ageMax: number | null;
  stock: number;
  inStock: boolean;
  shop: ShopSummary;
}

export interface ListSummary {
  id: string;
  name: string;
  description: string;
  birthday: string | null;
  themeId: ThemeId | "custom";
  /** the resolved theme (preset or quiz-generated) */
  theme: Theme;
  quiz: QuizAnswers | null;
  /** the kid's photo is shown on this list's gift shop */
  showPhoto: boolean;
  itemCount: number;
  purchasedCount: number;
  share: { slug: string; enabled: boolean; url: string } | null;
  createdAt: number;
  updatedAt: number;
}

export interface ListItemView {
  id: string;
  status: "available" | "purchased";
  product: CatalogProduct;
}

export interface ListDetail extends ListSummary {
  items: ListItemView[];
}

export interface ActivityItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

export interface HomeSummary {
  profile: KidProfile;
  activeList: ListSummary | null;
  daysToBirthday: number | null;
  trending: CatalogProduct[];
  activity: ActivityItem[];
  unread: number;
}

/** What a guest sees on /l/:slug. Only first name, list and theme. No email, last name, age or address. */
export interface PublicList {
  kidFirstName: string;
  listName: string;
  description: string;
  themeId: ThemeId | "custom";
  /** full theme to render (preset or quiz-generated). Never includes personal data. */
  theme: Theme;
  /** true when the kid chose to show their photo here (load it from /public/l/:slug/photo) */
  kidPhoto: boolean;
  daysToBirthday: number | null;
  items: PublicListItem[];
}

export interface PublicListItem {
  id: string;
  state: "available" | "held" | "held_by_you" | "purchased";
  heldUntil: number | null;
  /** when held by you at another branch: that branch's product id */
  heldProductId: string | null;
  reservationId: string | null;
  product: {
    id: string;
    title: string;
    description: string;
    category: Category;
    priceAgorot: number;
    imageUrl: string | null;
    inStock: boolean;
    shop: { name: string; city: string; logoUrl: string | null };
    /** the same product (same SKU) at other branches of this shop — the buyer can pick the closest */
    branches: Array<{ productId: string; priceAgorot: number; inStock: boolean; shop: { name: string; city: string } }>;
  };
}

export interface ReservationView {
  id: string;
  listItemId: string;
  expiresAt: number;
}

export interface ReceiptView {
  id: string;
  number: string;
  createdAt: number;
  kidFirstName: string;
  listName: string;
  buyerName: string;
  buyerEmailMasked: string;
  greeting: string | null;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string | null;
  subtotalAgorot: number;
  vatAgorot: number;
  totalAgorot: number;
  vatRateBp: number;
  payment: { provider: string; reference: string; status: string };
  orders: Array<{
    number: string;
    status: OrderStatus;
    totalAgorot: number;
    shop: { name: string; city: string; address: string; phone: string; pickupInfo: string | null };
    items: Array<{ title: string; priceAgorot: number; quantity: number }>;
  }>;
}

export interface CheckoutResult {
  receiptId: string;
  receiptNumber: string;
  accessToken: string;
  billPath: string;
}

export interface ShopProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  businessId: string;
  address: string;
  city: string;
  phone: string;
  contactName: string;
  logoUrl: string | null;
  brandColor: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  pickupInfo: string | null;
  offersDelivery: boolean;
  webhookUrl: string | null;
  apiKeyPrefix: string | null;
}

export interface ShopProduct {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: Category;
  priceAgorot: number;
  imageUrl: string | null;
  ageMin: number | null;
  ageMax: number | null;
  active: boolean;
  stock: number;
  updatedAt: number;
}

export interface ShopOrder {
  id: string;
  number: string;
  receiptNumber: string;
  status: OrderStatus;
  totalAgorot: number;
  createdAt: number;
  updatedAt: number;
  buyerName: string;
  kidFirstName: string;
  greeting: string | null;
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string | null;
  items: Array<{ title: string; sku: string; priceAgorot: number; quantity: number }>;
  declineReason: string | null;
  respondedAt: number | null;
  buyerNotifiedAt: number | null;
  buyerNotifiedCount: number;
}

export interface EmailTemplate {
  key: "set_aside" | "unavailable";
  subject: string;
  body: string;
  updatedAt: number;
}

export interface ShopDashboard {
  shop: ShopProfile;
  totals: { salesAgorot: number; orders: number; openOrders: number; productsActive: number; lowStock: number };
  salesByDay: Array<{ day: string; salesAgorot: number }>;
}

export interface AdminShopRow {
  id: string;
  name: string;
  city: string;
  contactName: string;
  email: string;
  status: ShopProfile["status"];
  createdAt: number;
  products: number;
}

export interface OutboxRow {
  id: string;
  toHint: string;
  subject: string;
  kind: string;
  provider: string;
  status: string;
  createdAt: number;
  html: string;
}

export interface AdminShopStats {
  days: number;
  totals: { shops: number; orders: number; salesAgorot: number; cancelled: number; waitingForStock: number; periodOrders: number; periodSalesAgorot: number; avgOrderAgorot: number };
  shops: Array<{
    id: string; name: string; city: string; status: string;
    /** branches of one chain (same business ID) share a number; null = single shop */
    chainNo: number | null;
    products: number; inStock: number; orders: number; salesAgorot: number; cancelled: number; waitingForStock: number; ready: number; done: number;
    lastOrderAt: number | null; periodSalesAgorot: number; periodOrders: number;
  }>;
  byDay: Array<{ day: string; orders: number; salesAgorot: number }>;
  topProducts: Array<{ title: string; shop: string; sold: number; salesAgorot: number }>;
}
