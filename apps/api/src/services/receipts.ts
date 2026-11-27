import type { OrderStatus, ReceiptView } from "@bwl/shared";
import type { Deps } from "../context";
import { all, one } from "../db";
import { maskEmail } from "../lib/crypto";
import { notFound } from "../lib/errors";

export async function buildReceipt(deps: Deps, receiptId: string): Promise<ReceiptView> {
  const { db, box } = deps;
  const r = await one<{
    id: string;
    number: string;
    created_at: number;
    kid_first_name: string;
    list_name: string;
    buyer_name: string;
    buyer_email_enc: string;
    greeting: string | null;
    delivery_method: "pickup" | "delivery";
    delivery_address_enc: string | null;
    subtotal_agorot: number;
    vat_agorot: number;
    total_agorot: number;
    vat_rate_bp: number;
  }>(
    db,
    `SELECT r.*, l.name AS list_name FROM receipts r JOIN lists l ON l.id = r.list_id WHERE r.id = ?`,
    [receiptId],
  );
  if (!r) throw notFound("receipt");
  const pay = await one<{ provider: string; provider_ref: string; status: string }>(
    db,
    "SELECT provider, provider_ref, status FROM payments WHERE receipt_id = ? ORDER BY created_at DESC LIMIT 1",
    [receiptId],
  );
  const orders = await all<{
    id: string;
    number: string;
    status: OrderStatus;
    total_agorot: number;
    shop_name: string;
    city: string;
    address_enc: string;
    phone_enc: string;
    pickup_info: string | null;
  }>(
    db,
    `SELECT o.id, o.number, o.status, o.total_agorot, sh.name AS shop_name, sh.city, sh.address_enc, sh.phone_enc, sh.pickup_info
     FROM orders o JOIN shops sh ON sh.id = o.shop_id WHERE o.receipt_id = ? ORDER BY o.number`,
    [receiptId],
  );
  const items = await all<{ order_id: string; title_snapshot: string; price_agorot: number; quantity: number }>(
    db,
    `SELECT oi.order_id, oi.title_snapshot, oi.price_agorot, oi.quantity FROM order_items oi
     JOIN orders o ON o.id = oi.order_id WHERE o.receipt_id = ?`,
    [receiptId],
  );
  const buyerEmail = await box.decrypt(r.buyer_email_enc);
  return {
    id: r.id,
    number: r.number,
    createdAt: Number(r.created_at),
    kidFirstName: r.kid_first_name,
    listName: r.list_name,
    buyerName: r.buyer_name,
    buyerEmailMasked: maskEmail(buyerEmail),
    greeting: r.greeting,
    deliveryMethod: r.delivery_method,
    deliveryAddress: await box.decryptNullable(r.delivery_address_enc),
    subtotalAgorot: Number(r.subtotal_agorot),
    vatAgorot: Number(r.vat_agorot),
    totalAgorot: Number(r.total_agorot),
    vatRateBp: Number(r.vat_rate_bp),
    payment: { provider: pay?.provider ?? "fake", reference: pay?.provider_ref ?? "", status: pay?.status ?? "succeeded" },
    orders: await Promise.all(
      orders.map(async (o) => ({
        number: o.number,
        status: o.status,
        totalAgorot: Number(o.total_agorot),
        shop: {
          name: o.shop_name,
          city: o.city,
          address: await box.decrypt(o.address_enc),
          phone: await box.decrypt(o.phone_enc),
          pickupInfo: o.pickup_info,
        },
        items: items
          .filter((i) => i.order_id === o.id)
          .map((i) => ({ title: i.title_snapshot, priceAgorot: Number(i.price_agorot), quantity: Number(i.quantity) })),
      })),
    ),
  };
}

export async function receiptBuyerEmail(deps: Deps, receiptId: string) {
  const r = await one<{ buyer_email_enc: string }>(deps.db, "SELECT buyer_email_enc FROM receipts WHERE id = ?", [receiptId]);
  return r ? deps.box.decrypt(r.buyer_email_enc) : null;
}
