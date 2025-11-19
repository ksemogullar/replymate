# ReplyMate Chrome Extension API Documentation

Bu dokümantasyon, ReplyMate Chrome Extension için hazırlanmış API endpoint'lerini açıklar.

## Base URL

```
Production: https://your-domain.com/api/extension
Development: http://localhost:3000/api/extension
```

## Authentication

Tüm endpoint'ler Supabase authentication kullanır. İsteklerde `Authorization` header'ı ile Bearer token gönderilmelidir:

```
Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN
```

---

## Endpoints

### 1. POST /api/extension/auth

Kullanıcının kimliğini doğrular ve işletme listesini getirir.

**Request Body:**
```json
{
  "apiKey": "user_supabase_access_token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  },
  "businesses": [
    {
      "id": "business-uuid",
      "name": "My Business",
      "place_id": "ChIJ...",
      "rating": 4.5,
      "total_reviews": 128,
      "default_language": "Türkçe",
      "default_tone": "Profesyonel",
      "custom_instructions": "Always mention our 24/7 support"
    }
  ],
  "hasGoogleConnection": true
}
```

**Error Responses:**
- `400`: API key eksik
- `401`: Geçersiz API key
- `500`: Server hatası

---

### 2. POST /api/extension/reviews

Bir işletmeye ait yorumları getirir.

**Request Body:**
```json
{
  "businessId": "business-uuid",
  "limit": 50,
  "offset": 0,
  "filterByReplied": "not_replied"  // "replied", "not_replied", veya null
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "business": {
    "id": "business-uuid",
    "name": "My Business",
    "place_id": "ChIJ...",
    "rating": 4.5,
    "total_reviews": 128
  },
  "reviews": [
    {
      "id": "review-uuid",
      "business_id": "business-uuid",
      "google_review_id": "ChIR...",
      "author_name": "John Doe",
      "author_photo_url": "https://...",
      "rating": 5,
      "text": "Great service!",
      "language": "en",
      "sentiment": "positive",
      "has_reply": false,
      "reply_text": null,
      "reply_author": null,
      "replied_at": null,
      "review_created_at": "2025-01-15T10:30:00Z",
      "fetched_at": "2025-01-15T12:00:00Z"
    }
  ],
  "total": 128,
  "limit": 50,
  "offset": 0
}
```

**Error Responses:**
- `400`: Business ID eksik
- `401`: Unauthorized
- `404`: İşletme bulunamadı
- `500`: Server hatası

---

### 3. POST /api/extension/generate

İşletme ayarlarını kullanarak AI ile otomatik yanıt üretir.

**Request Body:**
```json
{
  "businessId": "business-uuid",
  "reviewText": "Great service, loved the food!",
  "authorName": "John Doe",  // opsiyonel
  "rating": 5  // opsiyonel
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "reply": "Merhaba John! Harika geri bildiriminiz için çok teşekkür ederiz. Yemeğimizi beğenmeniz bizim için çok önemli. Sizi tekrar aramızda görmek için sabırsızlanıyoruz!",
  "business": {
    "name": "My Restaurant",
    "language": "Türkçe",
    "tone": "Samimi"
  }
}
```

**Features:**
- İşletmenin kayıtlı dil ve ton ayarlarını kullanır
- Custom instructions varsa prompt'a ekler
- Tone template'leri varsa onları da kullanır
- Rating ve yazar adını prompt'a ekleyerek daha kişiselleştirilmiş yanıtlar üretir

**Error Responses:**
- `400`: Eksik parametreler
- `401`: Unauthorized
- `404`: İşletme bulunamadı
- `500`: Server hatası veya Gemini API hatası

---

### 4. POST /api/extension/post-reply

Üretilen yanıtı Google My Business'a gönderir ve veritabanını günceller.

**Request Body:**
```json
{
  "businessId": "business-uuid",
  "reviewId": "ChIR...",  // google_review_id
  "replyText": "Teşekkür ederiz!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Reply posted successfully",
  "replied_at": "2025-01-15T14:30:00Z"
}
```

**Important Notes:**
- Kullanıcının Google Business hesabını bağlamış olması gerekir
- Token'ın süresi dolmuşsa otomatik olarak yenilenir
- Google My Business API'ye gerçek reply gönderir
- Başarılı olursa veritabanındaki review kaydını günceller

**Error Responses:**
- `400`: Eksik parametreler
- `401`: Token süresi dolmuş ve refresh token yok
- `403`: Google Business hesabı bağlanmamış
- `404`: İşletme veya location bulunamadı
- `500`: Server hatası veya Google API hatası

---

## Chrome Extension Kullanım Akışı

### 1. Kullanıcı Girişi
```javascript
// Extension popup'ında kullanıcı login olur ve Supabase token alır
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

const accessToken = data.session.access_token

// Token'ı extension storage'da sakla
chrome.storage.local.set({ accessToken })
```

### 2. İşletme Listesini Getirme
```javascript
const response = await fetch('http://localhost:3000/api/extension/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ apiKey: accessToken })
})

const { businesses, hasGoogleConnection } = await response.json()
```

### 3. Yorumları Listeleme
```javascript
const response = await fetch('http://localhost:3000/api/extension/reviews', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    businessId: selectedBusinessId,
    filterByReplied: 'not_replied',
    limit: 20
  })
})

const { reviews } = await response.json()
```

### 4. AI Yanıt Üretme
```javascript
const response = await fetch('http://localhost:3000/api/extension/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    businessId: selectedBusinessId,
    reviewText: review.text,
    authorName: review.author_name,
    rating: review.rating
  })
})

const { reply } = await response.json()
```

### 5. Yanıtı Google'a Gönderme
```javascript
const response = await fetch('http://localhost:3000/api/extension/post-reply', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    businessId: selectedBusinessId,
    reviewId: review.google_review_id,
    replyText: generatedReply
  })
})

const { success } = await response.json()
```

---

## Error Handling

Tüm endpoint'ler hata durumunda şu formatta yanıt döner:

```json
{
  "error": "Error message here"
}
```

HTTP status code'ları:
- `200`: Başarılı
- `400`: Geçersiz istek (eksik parametreler)
- `401`: Kimlik doğrulama hatası
- `403`: Yetki hatası (örn: Google hesabı bağlı değil)
- `404`: Kaynak bulunamadı
- `500`: Server hatası

---

## Rate Limiting

Google My Business API'nin rate limitleri vardır:
- Requests per minute: ~60
- Requests per day: ~10,000

Extension, rate limit hatalarını yakalamalı ve kullanıcıya uygun mesaj göstermelidir.

---

## Security Best Practices

1. **Token Storage**: Supabase access token'ı güvenli şekilde chrome.storage.local'de saklanmalı
2. **HTTPS**: Production'da mutlaka HTTPS kullanılmalı
3. **Token Refresh**: Token süresi dolduğunda Supabase auth.refreshSession() kullanılmalı
4. **Error Messages**: Kullanıcıya detaylı hata mesajları göstermeden önce sanitize edilmeli
5. **Input Validation**: Extension tarafında da input validation yapılmalı

---

## Örnek Chrome Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "ReplyMate",
  "version": "1.0.0",
  "description": "AI-powered Google Review Response Manager",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://your-domain.com/*",
    "https://maps.google.com/*",
    "https://www.google.com/maps/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.google.com/maps/*",
        "https://maps.google.com/*"
      ],
      "js": ["content.js"]
    }
  ]
}
```

---

## Testing

Test için curl komutları:

```bash
# Auth test
curl -X POST http://localhost:3000/api/extension/auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"apiKey":"YOUR_TOKEN"}'

# Reviews test
curl -X POST http://localhost:3000/api/extension/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"businessId":"BUSINESS_UUID","limit":10}'

# Generate test
curl -X POST http://localhost:3000/api/extension/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"businessId":"BUSINESS_UUID","reviewText":"Great service!","rating":5}'
```

---

## Support

Sorular için: support@replymate.com
