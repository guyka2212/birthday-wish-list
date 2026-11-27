// Application-level encryption for sensitive columns (AES-256-GCM) and blind indexes (HMAC-SHA256).
// Uses WebCrypto so it runs on Node, Vercel and edge runtimes alike.
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  encode: (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url"),
  decode: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
};

export interface CryptoBox {
  encrypt(plain: string): Promise<string>;
  decrypt(cipher: string): Promise<string>;
  encryptNullable(plain: string | null | undefined): Promise<string | null>;
  decryptNullable(cipher: string | null | undefined): Promise<string | null>;
  blindIndex(value: string): Promise<string>;
}

export async function createCryptoBox(encryptionKeyB64: string, blindIndexKeyB64: string): Promise<CryptoBox> {
  const aesKey = await crypto.subtle.importKey("raw", Buffer.from(encryptionKeyB64, "base64"), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(blindIndexKeyB64, "base64"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  async function encrypt(plain: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(plain));
    return `v1:${b64.encode(iv)}:${b64.encode(ct)}`;
  }

  async function decrypt(cipher: string): Promise<string> {
    const [v, ivS, ctS] = cipher.split(":");
    if (v !== "v1" || !ivS || !ctS) throw new Error("bad ciphertext format");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.decode(ivS) }, aesKey, b64.decode(ctS));
    return dec.decode(pt);
  }

  return {
    encrypt,
    decrypt,
    encryptNullable: async (p) => (p == null || p === "" ? null : encrypt(p)),
    decryptNullable: async (c) => (c ? decrypt(c) : null),
    async blindIndex(value: string) {
      const sig = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(value.trim().toLowerCase()));
      return Buffer.from(sig).toString("hex");
    },
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Buffer.from(d).toString("hex");
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Buffer.from(sig).toString("hex");
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Cryptographically random base62 string (rejection sampling, no modulo bias). */
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < 248) out += BASE62[b % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function randomToken(): string {
  return randomBase62(43); // ~256 bits
}

/** Mask an email for display: noa@gmail.com → n***@g***.com */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}
