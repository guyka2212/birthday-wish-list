-- 0008 shop chains: branches that share a business ID (ח.פ) are one chain.
-- Kids see only the closest branch of each chain; buyers can get the same product (same SKU) at their closest branch.

-- HMAC blind index of the business ID (the ID itself stays AES-encrypted in business_id_enc).
-- Filled at sign-up; older rows are back-filled by the API on first use.
ALTER TABLE shops ADD COLUMN business_id_hash TEXT;
CREATE INDEX idx_shops_business_hash ON shops(business_id_hash);

-- The branch product the buyer chose for this hold (null = the product on the kid's list).
ALTER TABLE reservations ADD COLUMN product_id TEXT REFERENCES products(id);
