-- Proof-of-payment uploads for NGN top-ups.
--
-- Members now attach a screenshot of the completed bank transfer (uploaded to
-- the ASSETS_BUCKET R2 bucket via POST /api/v1/topups/proof). The transfer
-- reference stays in place as an optional fallback, so this migration is purely
-- additive — existing rows and the NOT NULL transfer_reference column are
-- untouched. New columns:
--   * proof_image_path  — R2 object key for the receipt (NULL when the member
--     only quoted a transfer reference).
--   * proof_image_name  — the member's original file name, for the admin UI.
--   * proof_image_type  — MIME type (jpeg/png/webp), for correct rendering.
--
-- Apply to production with:
--   wrangler d1 execute creatorloop-db --remote --file=workers/api/migrations/027_topup_proof_image.sql

ALTER TABLE topup_requests ADD COLUMN proof_image_path TEXT;
ALTER TABLE topup_requests ADD COLUMN proof_image_name TEXT;
ALTER TABLE topup_requests ADD COLUMN proof_image_type TEXT;
