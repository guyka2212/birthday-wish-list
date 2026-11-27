import type { Config } from "./config";
import { createDb, type Db } from "./db";
import { createCryptoBox, type CryptoBox } from "./lib/crypto";
import { Mailer, OutboxOnlyProvider, ResendProvider } from "./email/EmailProvider";
import { FakePaymentProvider, type PaymentProvider } from "./payments/PaymentProvider";

export interface Deps {
  config: Config;
  db: Db;
  box: CryptoBox;
  mailer: Mailer;
  payments: PaymentProvider;
  now: () => number;
  /** outbound HTTP (webhooks); injectable for tests */
  fetch: typeof fetch;
}

export type AppEnv = {
  Variables: {
    deps: Deps;
    subjectId: string;
  };
};

export async function createDeps(config: Config, overrides: Partial<Deps> = {}): Promise<Deps> {
  const box = overrides.box ?? (await createCryptoBox(config.ENCRYPTION_KEY, config.BLIND_INDEX_KEY));
  const provider = config.RESEND_API_KEY ? new ResendProvider(config.RESEND_API_KEY, config.EMAIL_FROM) : new OutboxOnlyProvider();
  return {
    config,
    db: overrides.db ?? createDb(config),
    box,
    mailer: overrides.mailer ?? new Mailer(provider, box),
    payments: overrides.payments ?? new FakePaymentProvider(),
    now: overrides.now ?? Date.now,
    fetch: overrides.fetch ?? fetch,
  };
}
