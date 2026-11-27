import type {
  AdminShopRow,
  AdminShopStats,
  AuthTokens,
  EmailTemplate,
  OutboxRow,
  ShopDashboard,
  ShopOrder,
  ShopProduct,
  ShopProfile,
} from "@bwl/shared";

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Role = "shop" | "admin";

/** Tokens live in sessionStorage (cleared when the tab closes); never in cookies or localStorage. */
const store = {
  get(role: Role): AuthTokens | null {
    try {
      const raw = sessionStorage.getItem(`bwl-${role}`);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  },
  set(role: Role, t: AuthTokens | null) {
    try {
      if (t) sessionStorage.setItem(`bwl-${role}`, JSON.stringify(t));
      else sessionStorage.removeItem(`bwl-${role}`);
    } catch {
      /* ignore */
    }
  },
};

export const isLoggedIn = (role: Role) => store.get(role) != null;
let onExpired: (role: Role) => void = () => {};
export const setOnExpired = (fn: (role: Role) => void) => (onExpired = fn);

async function raw(path: string, init: RequestInit, token?: string) {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "omit",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "network", "network error");
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: { error?: { code?: string; message?: string; details?: unknown } } | null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(0, "network", "unexpected response from server");
  }
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "http_error", json?.error?.message ?? res.statusText, json?.error?.details);
  return json as T;
}

const refreshing: Partial<Record<Role, Promise<boolean>>> = {};
async function refresh(role: Role): Promise<boolean> {
  refreshing[role] ??= (async () => {
    const t = store.get(role);
    if (!t) return false;
    const res = await raw(`/auth/${role}/refresh`, { method: "POST", body: JSON.stringify({ refreshToken: t.refreshToken }) });
    if (!res.ok) {
      store.set(role, null);
      onExpired(role);
      return false;
    }
    store.set(role, await res.json());
    return true;
  })().finally(() => delete refreshing[role]);
  return refreshing[role]!;
}

async function call<T>(role: Role | null, path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init, role ? store.get(role)?.accessToken : undefined);
  if (role && res.status === 401 && (await refresh(role))) res = await raw(path, init, store.get(role)?.accessToken);
  return parse<T>(res);
}

const body = (b: unknown) => ({ body: JSON.stringify(b) });

export const auth = {
  async login(role: Role, email: string, password: string) {
    store.set(role, await call<AuthTokens>(null, `/auth/${role}/login`, { method: "POST", ...body({ email, password }) }));
  },
  async signup(input: Record<string, unknown>) {
    store.set("shop", await call<AuthTokens>(null, "/auth/shop/signup", { method: "POST", ...body(input) }));
  },
  async logout(role: Role) {
    const t = store.get(role);
    store.set(role, null);
    if (t) await call(null, `/auth/${role}/logout`, { method: "POST", ...body({ refreshToken: t.refreshToken }) }).catch(() => {});
  },
  forgot: (email: string) => call(null, "/auth/shop/forgot", { method: "POST", ...body({ email }) }),
  reset: (token: string, password: string) => call(null, "/auth/shop/reset", { method: "POST", ...body({ token, password }) }),
};

export const shopApi = {
  me: () => call<ShopProfile>("shop", "/shop/me"),
  updateMe: (patch: Record<string, unknown>) => call<ShopProfile & { webhookSecret?: string }>("shop", "/shop/me", { method: "PATCH", ...body(patch) }),
  dashboard: () => call<ShopDashboard>("shop", "/shop/dashboard"),
  products: () => call<{ items: ShopProduct[] }>("shop", "/shop/products").then((r) => r.items),
  createProduct: (p: Record<string, unknown>) => call<ShopProduct>("shop", "/shop/products", { method: "POST", ...body(p) }),
  updateProduct: (id: string, p: Record<string, unknown>) => call<ShopProduct>("shop", `/shop/products/${id}`, { method: "PATCH", ...body(p) }),
  deleteProduct: (id: string) => call("shop", `/shop/products/${id}`, { method: "DELETE" }),
  orders: (status?: string) => call<{ items: ShopOrder[] }>("shop", `/shop/orders${status ? `?status=${status}` : ""}`).then((r) => r.items),
  setOrderStatus: (id: string, status: string) => call<ShopOrder>("shop", `/shop/orders/${id}`, { method: "PATCH", ...body({ status }) }),
  answerStock: (id: string, inStock: boolean) => call<ShopOrder>("shop", `/shop/orders/${id}/stock`, { method: "POST", ...body({ inStock }) }),
  emailPreview: (id: string) => call<{ template: string; subject: string; text: string }>("shop", `/shop/orders/${id}/email-preview`),
  notifyBuyer: (id: string) => call<ShopOrder>("shop", `/shop/orders/${id}/notify-buyer`, { method: "POST" }),
  rotateKey: () => call<{ apiKey: string; prefix: string }>("shop", "/shop/api-key/rotate", { method: "POST" }),
};

export const adminApi = {
  me: () => call<{ id: string; name: string }>("admin", "/admin/me"),
  shops: (status?: string) => call<{ items: AdminShopRow[] }>("admin", `/admin/shops${status ? `?status=${status}` : ""}`).then((r) => r.items),
  decide: (id: string, decision: "approve" | "reject" | "suspend") => call("admin", `/admin/shops/${id}/decision`, { method: "POST", ...body({ decision }) }),
  outbox: () => call<{ items: OutboxRow[] }>("admin", "/admin/outbox").then((r) => r.items),
  stats: () => call<Record<string, number>>("admin", "/admin/stats"),
  shopStats: (days: number) => call<AdminShopStats>("admin", `/admin/shop-stats?days=${days}`),
  templates: () => call<{ items: EmailTemplate[]; placeholders: string[] }>("admin", "/admin/templates"),
  saveTemplate: (key: string, t: { subject: string; body: string }) => call<EmailTemplate>("admin", `/admin/templates/${key}`, { method: "PUT", ...body(t) }),
  previewTemplate: (t: { subject: string; body: string }) => call<{ subject: string; html: string }>("admin", "/admin/templates/preview", { method: "POST", ...body(t) }),
};

export const openApi = () => call<Record<string, unknown>>(null, "/openapi.json");
