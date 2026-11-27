import { distanceKm, findCity, NEARBY_MIN_SHOPS, NEARBY_RADIUS_KM } from "@bwl/shared";
import type { Executor } from "../db";
import { all } from "../db";

export interface NearbyShop {
  id: string;
  distanceKm: number | null;
}

/**
 * Approved shops sorted by distance from a city. With a known city, returns the shops within
 * NEARBY_RADIUS_KM — and always at least the NEARBY_MIN_SHOPS closest. Without a city, returns all shops.
 */
export async function nearbyShops(db: Executor, cityId: string | null): Promise<NearbyShop[]> {
  const shops = await all<{ id: string; city: string }>(db, "SELECT id, city FROM shops WHERE status = 'approved'");
  const home = findCity(cityId);
  if (!home) return shops.map((s) => ({ id: s.id, distanceKm: null }));
  const withDist = shops
    .map((s) => {
      const c = findCity(s.city);
      return { id: s.id, distanceKm: c ? Math.round(distanceKm(home, c)) : null };
    })
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return withDist.filter((s, i) => i < NEARBY_MIN_SHOPS || (s.distanceKm != null && s.distanceKm <= NEARBY_RADIUS_KM));
}
