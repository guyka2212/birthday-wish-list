import type { CheckoutInput, CheckoutResult, PublicList, ReceiptView, ReservationView } from "@bwl/shared";

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError(0, "network", "network error");
  }
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

export const api = {
  list: (slug: string, session: string) => request<PublicList>(`/public/l/${encodeURIComponent(slug)}?session=${encodeURIComponent(session)}`),
  reserve: (slug: string, listItemId: string, guestSession: string) =>
    request<ReservationView>("/public/reservations", { method: "POST", body: JSON.stringify({ slug, listItemId, guestSession }) }),
  release: (reservationId: string, guestSession: string) =>
    request<{ ok: true }>("/public/reservations/release", { method: "POST", body: JSON.stringify({ reservationId, guestSession }) }),
  checkout: (input: CheckoutInput) => request<CheckoutResult>("/public/checkout", { method: "POST", body: JSON.stringify(input) }),
  receipt: (id: string, token: string) => request<ReceiptView>(`/public/receipts/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`),
  resetPassword: (type: "kid" | "shop", token: string, password: string) =>
    request<{ ok: true }>(`/auth/${type}/reset`, { method: "POST", body: JSON.stringify({ token, password }) }),
};

/** Random guest session id (kept for this browser tab only — no sign-up, no cookies). */
export function guestSession(): string {
  const key = "bwl-guest-session";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
  } catch {
    /* storage blocked */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* storage blocked */
  }
  return id;
}
