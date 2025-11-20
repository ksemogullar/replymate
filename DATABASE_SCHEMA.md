# 🗄️ ReplyMate Database Schema

**PostgreSQL / Supabase**

---

## 📊 Schema Diagram (Visual Overview)

```
┌─────────────┐
│   users     │──────────┐
│ (Supabase)  │          │
└─────────────┘          │
                         │
                         ↓
┌─────────────┐    ┌─────────────┐
│  profiles   │    │ businesses  │
│             │    │             │
└─────────────┘    └─────────────┘
                         │
                         │ has many
                         ↓
                   ┌─────────────┐
                   │   reviews   │
                   │             │
                   └─────────────┘
                         │
                         │ has many
                         ↓
                   ┌─────────────┐
                   │ai_responses │
                   │             │
                   └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│tone_templates│   │ competitors │    │subscriptions│
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 📋 Tables

### 1. **users** (Managed by Supabase Auth)
Supabase Auth automatically creates this table. We'll extend it with `profiles`.

```sql
-- This is managed by Supabase, we don't create it
```

---

### 2. **profiles**
User profile information and preferences.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  whatsapp_number TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'agency', 'admin')),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
```

---

### 3. **businesses**
Google Business locations connected by users.

```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Google Business Info
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  category TEXT,

  -- Ratings
  rating DECIMAL(2,1),
  total_reviews INTEGER DEFAULT 0,

  -- AI Settings
  default_tone TEXT DEFAULT 'professional',
  default_language TEXT DEFAULT 'tr',
  custom_instructions TEXT,

  -- WhatsApp Notifications
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_number TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses"
  ON businesses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses"
  ON businesses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own businesses"
  ON businesses FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_businesses_user_id ON businesses(user_id);
CREATE INDEX idx_businesses_place_id ON businesses(place_id);
CREATE INDEX idx_businesses_is_active ON businesses(is_active);
```

---

### 4. **reviews**
Google reviews fetched from Places API.

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Google Review Data
  google_review_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  language TEXT,

  -- AI Analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  category TEXT, -- e.g., 'service', 'price', 'quality'
  keywords TEXT[], -- Array of extracted keywords
  is_toxic BOOLEAN DEFAULT false,
  toxic_reason TEXT,

  -- Reply Status
  has_reply BOOLEAN DEFAULT false,
  reply_text TEXT,
  reply_author TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  review_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (business_id, google_review_id)
);

-- RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews of own businesses"
  ON reviews FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_google_review_id ON reviews(google_review_id);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_has_reply ON reviews(has_reply);
CREATE INDEX idx_reviews_created_at ON reviews(review_created_at DESC);
```

---

### 5. **ai_responses**
AI-generated responses for reviews.

```sql
CREATE TABLE ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Response Content
  response_text TEXT NOT NULL,
  tone TEXT NOT NULL,
  language TEXT NOT NULL,

  -- Usage
  was_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,

  -- AI Model Info
  model_name TEXT DEFAULT 'gemini-2.5-flash',
  tokens_used INTEGER,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view responses for own businesses"
  ON ai_responses FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert responses for own businesses"
  ON ai_responses FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_ai_responses_review_id ON ai_responses(review_id);
CREATE INDEX idx_ai_responses_business_id ON ai_responses(business_id);
CREATE INDEX idx_ai_responses_created_at ON ai_responses(created_at DESC);
```

---

### 6. **tone_templates**
Saved tone profiles for businesses.

```sql
CREATE TABLE tone_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  tone_type TEXT NOT NULL, -- 'professional', 'friendly', 'luxury', etc.

  -- Custom Instructions
  instructions TEXT NOT NULL,
  example_response TEXT,

  -- Usage
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE tone_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage templates for own businesses"
  ON tone_templates FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_tone_templates_business_id ON tone_templates(business_id);
```

---

### 7. **competitors**
Competitor businesses for analysis.

```sql
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Competitor Info
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rating DECIMAL(2,1),
  total_reviews INTEGER,

  -- Analysis Data (cached)
  avg_rating_30d DECIMAL(2,1),
  review_volume_30d INTEGER,
  common_keywords TEXT[],

  -- Metadata
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(business_id, place_id)
);

-- RLS Policies
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage competitors for own businesses"
  ON competitors FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_competitors_business_id ON competitors(business_id);
```

---

### 8. **subscriptions**
Stripe subscription management.

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Stripe Info
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Plan Info
  plan_name TEXT NOT NULL CHECK (plan_name IN ('starter', 'pro', 'agency')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),

  -- Limits
  max_businesses INTEGER NOT NULL DEFAULT 1,
  max_reviews_per_month INTEGER NOT NULL DEFAULT 100,

  -- Billing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Trial
  trial_ends_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

---

### 9. **usage_tracking**
Track API usage for billing.

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,

  -- Usage Type
  action_type TEXT NOT NULL CHECK (action_type IN ('review_fetch', 'ai_response', 'whatsapp_notification')),

  -- Metadata
  month TEXT NOT NULL, -- Format: '2025-01'
  count INTEGER DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_usage_tracking_user_id_month ON usage_tracking(user_id, month);
CREATE INDEX idx_usage_tracking_business_id ON usage_tracking(business_id);
```

---

### 10. **whatsapp_notifications**
WhatsApp notification log.

```sql
CREATE TABLE whatsapp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,

  -- Message Info
  recipient_number TEXT NOT NULL,
  message_text TEXT NOT NULL,

  -- Delivery Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  external_id TEXT, -- Twilio message SID
  error_message TEXT,

  -- Metadata
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications for own businesses"
  ON whatsapp_notifications FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_whatsapp_notifications_business_id ON whatsapp_notifications(business_id);
CREATE INDEX idx_whatsapp_notifications_status ON whatsapp_notifications(status);
```

---

## 🔄 Functions & Triggers

### Auto-update `updated_at` timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tone_templates_updated_at
  BEFORE UPDATE ON tone_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Auto-create profile on user signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## 📊 Sample Queries

### Get all reviews for a business with AI responses

```sql
SELECT
  r.*,
  ar.response_text,
  ar.tone,
  ar.was_used
FROM reviews r
LEFT JOIN ai_responses ar ON ar.review_id = r.id
WHERE r.business_id = 'your-business-uuid'
ORDER BY r.review_created_at DESC;
```

### Get sentiment distribution

```sql
SELECT
  sentiment,
  COUNT(*) as count,
  ROUND(AVG(rating), 2) as avg_rating
FROM reviews
WHERE business_id = 'your-business-uuid'
  AND review_created_at >= NOW() - INTERVAL '30 days'
GROUP BY sentiment;
```

### Get competitor comparison

```sql
SELECT
  c.name,
  c.rating,
  c.total_reviews,
  c.avg_rating_30d,
  c.review_volume_30d
FROM competitors c
WHERE c.business_id = 'your-business-uuid'
ORDER BY c.rating DESC;
```

---

## 🚀 Migration Scripts

All tables can be created by running the SQL in order from this document in Supabase SQL Editor.

**Recommended order:**
1. Create tables (profiles → businesses → reviews → ai_responses → etc.)
2. Create functions and triggers
3. Enable RLS policies
4. Create indexes

---

## 📝 Notes

- All UUIDs use `gen_random_uuid()` for better performance
- RLS (Row Level Security) is enabled on all tables for security
- Indexes are created on frequently queried columns
- Foreign keys have `ON DELETE CASCADE` where appropriate
- Timestamps use `TIMESTAMP WITH TIME ZONE` for global users

---

**Last Updated:** 2025-01-17
**Version:** 1.0
