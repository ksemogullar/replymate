-- Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_place_id TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  address TEXT,
  rating NUMERIC(3,2),
  total_reviews INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, competitor_place_id)
);

-- Create competitor_reviews table
CREATE TABLE IF NOT EXISTS competitor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  google_review_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  language TEXT,
  review_created_at TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competitor_id, google_review_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_competitors_business_id ON competitors(business_id);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_competitor_id ON competitor_reviews(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_rating ON competitor_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_competitor_reviews_created_at ON competitor_reviews(review_created_at);

-- Enable RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competitors
CREATE POLICY "Users can view their own competitors"
  ON competitors FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own competitors"
  ON competitors FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own competitors"
  ON competitors FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own competitors"
  ON competitors FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for competitor_reviews
CREATE POLICY "Users can view competitor reviews"
  ON competitor_reviews FOR SELECT
  USING (
    competitor_id IN (
      SELECT c.id FROM competitors c
      INNER JOIN businesses b ON c.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert competitor reviews"
  ON competitor_reviews FOR INSERT
  WITH CHECK (
    competitor_id IN (
      SELECT c.id FROM competitors c
      INNER JOIN businesses b ON c.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update competitor reviews"
  ON competitor_reviews FOR UPDATE
  USING (
    competitor_id IN (
      SELECT c.id FROM competitors c
      INNER JOIN businesses b ON c.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete competitor reviews"
  ON competitor_reviews FOR DELETE
  USING (
    competitor_id IN (
      SELECT c.id FROM competitors c
      INNER JOIN businesses b ON c.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_competitors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for competitors
CREATE TRIGGER trigger_update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW
  EXECUTE FUNCTION update_competitors_updated_at();
