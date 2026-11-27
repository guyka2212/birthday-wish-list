import { z } from "zod";
import { THEME_IDS } from "./themes";
import { quizAnswersSchema } from "./quiz";
import { cityIdSchemaValues, findCity } from "./cities";

export const cityIdSchema = z.enum(cityIdSchemaValues);

// ---------- primitives ----------
export const CATEGORIES = ["toys", "books", "lego", "sports", "art", "games", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, { he: string; en: string; emoji: string }> = {
  toys: { he: "צעצועים", en: "Toys", emoji: "🧸" },
  books: { he: "ספרים", en: "Books", emoji: "📚" },
  lego: { he: "לגו", en: "Lego", emoji: "🧱" },
  sports: { he: "ספורט", en: "Sports", emoji: "⚽" },
  art: { he: "יצירה", en: "Art", emoji: "🎨" },
  games: { he: "משחקים", en: "Games", emoji: "🎲" },
  other: { he: "אחר", en: "Other", emoji: "🎁" },
};

export const ORDER_STATUSES = ["new", "preparing", "ready", "shipped", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));
export const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128)
  .refine((p) => /[A-Za-z֐-׿]/.test(p) && /\d/.test(p), "password needs letters and digits");
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
export const themeIdSchema = z.enum(THEME_IDS);
export const idSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const slugSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);
export const avatarSchema = z.string().min(1).max(16);

// ---------- kid auth ----------
export const kidSignupSchema = z.object({
  username: trimmed(2, 30),
  firstName: trimmed(1, 30),
  email: emailSchema,
  password: passwordSchema,
  parentEmail: emailSchema,
  birthday: dateSchema.optional(),
  avatar: avatarSchema.optional(),
  locale: z.enum(["he", "en"]).optional(),
  /** the kid's city — the app shows only shops near it */
  city: cityIdSchema,
});
export type KidSignupInput = z.infer<typeof kidSignupSchema>;

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

/** Profile photo: a base64 JPEG/PNG/WebP, already resized by the app (max ~300 KB). */
export const photoUploadSchema = z.object({
  photo: z
    .string()
    .max(400_000)
    .regex(/^[A-Za-z0-9+/=]+$/, "photo must be base64"),
});

export const profileUpdateSchema = z
  .object({
    username: trimmed(2, 30).optional(),
    firstName: trimmed(1, 30).optional(),
    email: emailSchema.optional(),
    avatar: avatarSchema.optional(),
    birthday: dateSchema.nullable().optional(),
    locale: z.enum(["he", "en"]).optional(),
    city: cityIdSchema.optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: "currentPassword is required to set a new password",
    path: ["currentPassword"],
  });

// ---------- lists ----------
export const listCreateSchema = z.object({
  name: trimmed(1, 60),
  description: z.string().trim().max(300).default(""),
  birthday: dateSchema.nullable().optional(),
  themeId: themeIdSchema.default("unicorn"),
  /** quiz answers: when present the server generates a custom theme and ignores themeId */
  quiz: quizAnswersSchema.optional(),
});
export const listUpdateSchema = z.object({
  name: trimmed(1, 60).optional(),
  description: z.string().trim().max(300).optional(),
  birthday: dateSchema.nullable().optional(),
  themeId: themeIdSchema.optional(),
  quiz: quizAnswersSchema.optional(),
});
export const listItemAddSchema = z.object({ productId: idSchema });

// ---------- catalog ----------
export const catalogQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  shopIds: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean).slice(0, 20) : undefined)),
  categories: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s ? s.split(",").filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c)) : undefined)),
  minPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  inStockOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(60),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

// ---------- guest ----------
export const guestSessionSchema = z.string().regex(/^[A-Za-z0-9_-]{24,64}$/);
export const reserveSchema = z.object({ slug: slugSchema, listItemId: idSchema, guestSession: guestSessionSchema });
export const releaseSchema = z.object({ reservationId: idSchema, guestSession: guestSessionSchema });
export const checkoutSchema = z
  .object({
    slug: slugSchema,
    guestSession: guestSessionSchema,
    reservationIds: z.array(idSchema).min(1).max(20),
    buyerName: trimmed(2, 60),
    buyerEmail: emailSchema,
    greeting: z.string().trim().max(500).optional(),
    deliveryMethod: z.enum(["pickup", "delivery"]).default("pickup"),
    deliveryAddress: z.string().trim().min(5).max(200).optional(),
  })
  .refine((v) => v.deliveryMethod === "pickup" || !!v.deliveryAddress, {
    message: "deliveryAddress is required for delivery",
    path: ["deliveryAddress"],
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------- shops ----------
const knownCity = trimmed(2, 40).refine((c) => !!findCity(c), "pick a city from the list");

export const shopSignupSchema = z.object({
  name: trimmed(2, 60),
  businessId: z.string().trim().regex(/^\d{8,9}$/, "business ID must be 8–9 digits"),
  address: trimmed(5, 200),
  /** must be a known city so kids and buyers can see how close the shop is */
  city: knownCity,
  phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, "invalid phone"),
  contactName: trimmed(2, 60),
  email: emailSchema,
  password: passwordSchema,
  logoUrl: z.url().max(500).optional().or(z.literal("").transform(() => undefined)),
  pickupInfo: z.string().trim().max(200).optional(),
  offersDelivery: z.boolean().optional(),
});

export const shopUpdateSchema = z.object({
  name: trimmed(2, 60).optional(),
  address: trimmed(5, 200).optional(),
  city: knownCity.optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/).optional(),
  contactName: trimmed(2, 60).optional(),
  logoUrl: z.url().max(500).nullable().optional(),
  pickupInfo: z.string().trim().max(200).nullable().optional(),
  offersDelivery: z.boolean().optional(),
  webhookUrl: z
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), "webhook must be https")
    .nullable()
    .optional(),
});

export const productInputSchema = z.object({
  sku: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/, "sku: letters, digits, . _ - only"),
  title: trimmed(1, 120),
  description: z.string().trim().max(1000).default(""),
  category: z.enum(CATEGORIES),
  priceAgorot: z.number().int().min(0).max(10_000_000),
  imageUrl: z.url().max(1000).nullable().optional(),
  ageMin: z.number().int().min(0).max(18).nullable().optional(),
  ageMax: z.number().int().min(0).max(18).nullable().optional(),
  active: z.boolean().default(true),
  stock: z.number().int().min(0).max(1_000_000).optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;
export const productBulkSchema = z.object({ products: z.array(productInputSchema).min(1).max(500) });
export const productPatchSchema = productInputSchema.partial().omit({ sku: true });

export const stockSyncSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().trim().min(1).max(64), quantity: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(1000),
});

export const orderStatusUpdateSchema = z.object({ status: z.enum(ORDER_STATUSES) });
/** Shop answers a stock check: set the gift aside for the buyer, or say it is not in stock. */
export const stockResponseSchema = z.object({ inStock: z.boolean() });

export const TEMPLATE_KEYS = ["set_aside", "unavailable"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export const TEMPLATE_PLACEHOLDERS = [
  "orderNumber", "buyerName", "kidName", "shopName", "shopAddress", "shopPhone", "pickupInfo", "items", "total", "date", "receiptLink", "listLink",
] as const;
export const templateUpdateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});
export const shopDecisionSchema = z.object({ decision: z.enum(["approve", "reject", "suspend"]) });
