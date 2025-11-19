-- Add missing RLS policies for reviews table
-- Run this in Supabase SQL Editor

CREATE POLICY "Users can insert reviews for own businesses"
  ON reviews FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reviews for own businesses"
  ON reviews FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );
