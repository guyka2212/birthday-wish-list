import { distanceKm, findCity, NEARBY_MIN_SHOPS, NEARBY_RADIUS_KM } from "@bwl/shared";
import type { Executor } from "../db";
import { all, run } from "../db";
import type { CryptoBox } from "../lib/crypto";

export interface NearbyShop {
  id: string;
  distanceKm: number | null;
  /** branches of one shop share this key (blind index of the business ID) */
  chain: string;
}

/** Fill business_id_hash for shops created before chains existed (decrypts the ID once per shop). */
export async function backfillChainKeys(db: Executor, box: CryptoBox) {
  const missing = await all<{ id: string; business_id_enc: string }>(db, "SELECT id, business_id_enc FROM shops WHERE business_id_hash IS NULL");
  for (const s of missing) {
    const id = await box.decryptNullable(s.business_id_enc);
    if (id) await run(db, "UPDATE shops SET business_id_hash = ? WHERE id = ?", [await box.blindIndex(id.replace(/\D/g, "")), s.id]);
  }
}

/**
 * Approved shops near a city, closest first, with only the CLOSEST branch of each chain
 * (branches = same business ID). Within NEARBY_RADIUS_KM, and always at least the NEARBY_MIN_SHOPS closest shops.
 * Without a city: one branch per chain, no distance filter.
 */
export async function nearbyShops(db: Executor, box: CryptoBox, cityId: string | null): Promise<NearbyShop[]> {
  await backfillChainKeys(db, box);
  const shops = await all<{ id: string; city: string; chain: string | null }>(
    db,
    "SELECT id, city, business_id_hash AS chain FROM shops WHERE status = 'approved'",
  );
  const home = findCity(cityId);
  const withDist = shops
    .map((s) => {
      const c = findCity(s.city);
      return { id: s.id, chain: s.chain ?? s.id, distanceKm: home && c ? Math.round(distanceKm(home, c)) : null };
    })
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  // keep only the closest branch of each chain
  const seen = new Set<string>();
  const onePerChain = withDist.filter((s) => (seen.has(s.chain) ? false : (seen.add(s.chain), true)));
  if (!home) return onePerChain;
  return onePerChain.filter((s, i) => i < NEARBY_MIN_SHOPS || (s.distanceKm != null && s.distanceKm <= NEARBY_RADIUS_KM));
}
