# ReplyMate

**AI-Powered Google Review Management Platform**

---

## 🎯 What is ReplyMate?

ReplyMate is a SaaS platform that helps businesses and agencies manage their Google Business reviews efficiently using AI-powered response generation, Chrome Extension integration, and advanced analytics.

---

## 🚀 Key Features

- **AI Response Generator** - Generate professional responses in multiple languages and tones, store template libraries, and let AI pre-fill review replies.
- **Chrome Extension** - One-click response filling directly in Google Business dashboard
- **WhatsApp Notifications** - Get instant alerts for new reviews with AI-suggested responses
- **Analytics Dashboard** - Sentiment analysis, rating trends, and keyword insights
- **Competitor Analysis** - Benchmark against competitors
- **Multi-Business Management** - Perfect for agencies managing multiple clients
- **Auto-Toxic Filter** - AI flags spam, threats, and inappropriate reviews

---

## 📚 Documentation

- [Product Specification](./PRODUCT_SPEC.md) - Complete feature and technical documentation
- [Database Schema](./DATABASE_SCHEMA.md) - Database structure and relationships (coming soon)
- [Development Roadmap](./ROADMAP.md) - MVP phases and timeline

---

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- Tailwind CSS
- TypeScript
- React Query

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL)
- Google Places API
- Gemini AI

**Chrome Extension:**
- Manifest V3
- TypeScript

**Integrations:**
- Stripe (Payments)
- WhatsApp Cloud API (Notifications)
- Google Places API (Reviews)

---

## 🏃 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Cloud account (Places API)
- Gemini API key

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Environment Variables

```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Places API
GOOGLE_PLACES_API_KEY=your_google_places_key

# Stripe (optional for MVP)
STRIPE_SECRET_KEY=your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_public

# WhatsApp (optional for MVP)
WHATSAPP_API_TOKEN=your_whatsapp_token
```

---

## 🗂️ Project Structure

```
replymate-new/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── auth/              # Authentication pages
│   └── page.tsx           # Landing page
├── components/            # React components
├── lib/                   # Utility functions
├── chrome-extension/      # Chrome extension source (coming soon)
├── PRODUCT_SPEC.md        # Product specification
└── ROADMAP.md             # Development roadmap
```

---

## 🎯 MVP Timeline

**Phase 1 (Week 1-2):** Authentication + Dashboard setup
**Phase 2 (Week 3-4):** Google Places integration + AI responses
**Phase 3 (Week 5-6):** Chrome Extension
**Phase 4 (Week 7-8):** Analytics + WhatsApp notifications

See [ROADMAP.md](./ROADMAP.md) for detailed timeline.

---

## 💳 Pricing Plans (Planned)

- **Starter** ($19/mo) - 1 business, 100 reviews/month
- **Pro** ($49/mo) - Unlimited reviews, analytics, WhatsApp
- **Agency** ($99/mo) - Multiple businesses, competitor analysis, white-label

---

## 📧 Contact

For questions or support, contact: [your-email@example.com]

---

**Built with ❤️ by the ReplyMate Team**
