-- Remove duplicate reviews that share the same Google review and business pair
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY business_id, google_review_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM reviews
  ) ranked
  WHERE rn > 1
)
DELETE FROM reviews
WHERE id IN (SELECT id FROM duplicates);

-- Enforce uniqueness so future syncs cannot insert duplicates
DO $$
BEGIN
  ALTER TABLE reviews
  ADD CONSTRAINT reviews_business_google_unique
  UNIQUE (business_id, google_review_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
