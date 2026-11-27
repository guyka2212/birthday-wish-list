import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters: m=19 MiB, t=2, p=1.
const OPTS = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** A real hash to compare against when the account doesn't exist, so timing doesn't leak which emails are registered. */
let dummy: Promise<string> | null = null;
export async function dummyVerify(password: string): Promise<false> {
  dummy ??= hashPassword("not-a-real-password-1");
  await verifyPassword(await dummy, password);
  return false;
}
