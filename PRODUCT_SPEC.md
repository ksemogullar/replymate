# 🚀 REPLYMATE – Google Yorum Yönetimi & AI Yanıt Asistanı

**Tam Teknik + İşlevsel Doküman**

---

## 📌 AMAÇ

Google'da yorum alan işletmelere & ajanslara:
- Yorumları tek panelde toplamak
- Analiz etmek
- Yapay zekâ ile profesyonel cevap taslakları oluşturmak
- Chrome Extension sayesinde Google'a "tek tıkla doldurmak"
- Yeni yorumları WhatsApp ile bildirmek
- Çoklu işletme yönetimi
- Rakip analizleri
- Özelleştirilebilir ton-profil cevapları

**Değer Önerisi:** Zaman kazandıran, otomasyonu artıran, kullanıcı dostu bir SaaS platformu.

---

## 🧩 PROJENİN ANA BİLEŞENLERİ

### 1) Dashboard (Web SaaS – Next.js)

Kullanıcı giriş yaptıktan sonra işletmesini ekler ve tüm yorumlar + analizler burada gösterilir.

#### 🔹 1.1 İşletme Bağlama (Place ID ile)
- Kullanıcı Google Place ID'sini panelde bir alana girer
- Sistem Google Places API'den işletmenin:
  - Adı
  - Adresi
  - Rating'i
  - Toplam yorum sayısı
  - Tüm yorumları
  - Fotoğrafları getirir ve kaydeder

#### 🔹 1.2 Yorum Akışı (Old + New)
- Tüm yorumlar liste halinde görünür
- Yorum bilgilerinde:
  - Yıldız puanı
  - Yorum metni
  - Tarih
  - Kullanıcı adı
  - Kullanıcı fotoğrafı (varsa)

#### 🔹 1.3 AI Cevap Üretme (Gemini / OpenAI)
- Yorumun yanında "Cevap Üret" butonu
- Dil algılama (TR/EN/NL otomatik)
- Ton seçimi:
  - Profesyonel
  - Samimi
  - Kısa
  - Premium marka tonu
  - Ajans tonu
- Cevap oluşturulur ve kart üzerinde görünür
- "Kopyala" butonu ile manuel alınabilir

#### 🔹 1.4 Chrome Extension Entegrasyonu
- Dashboard ve Extension aynı API'yi kullanır
- Extension yorum ID'si ile dashboard'daki cevabı çekebilir

---

### 2) Chrome Extension (Sistem Kritik Parça)

Google Business Dashboard üzerinde çalışır.

#### 🔹 2.1 Yorum Algılama
Kullanıcı Google Business "Reviews" sayfasına girdiğinde extension DOM'dan:
- Seçilen yorumu
- Yıldız puanını
- Kullanıcı adını
- Review ID'sini okur

#### 🔹 2.2 Mini Side Panel
Google yorum ekranının sağında küçük bir UI açılır:

```
⭐️ Yeni yorum algılandı:
"Çok memnun kaldım..."

[ CEVAP OLUŞTUR ]
```

Tıklandığında:
- Dashboard API → AI Cevabı döner
- Panelde gösterilir:

```
Önerilen Cevap:
"Merhaba, güzel yorumunuz için teşekkür ederiz..."

[ OTOMATİK DOLDUR ]   [ KOPYALA ]
```

#### 🔹 2.3 Otomatik Doldurma
- Extension, Google'ın cevap yazma kutusunu DOM'da bulur
- Yalnızca metni doldurur
- "Gönder" butonuna basmayı kullanıcı yapar (Google ToS uyumlu)

---

### 3) Analitik Sistem (Business Intelligence Modülü)

#### 🔹 3.1 Rating Trend Grafiği
- Son 30 gün yorum grafiği
- Günlük / haftalık trend

#### 🔹 3.2 Sentiment Analizi (AI)
Her yorum:
- Pozitif
- Negatif
- Nötr
olarak sınıflandırılır

#### 🔹 3.3 Review Category AI
AI yorumları kategorilere ayırır:
- Fiyat
- Hizmet kalitesi
- Bekleme süresi
- Çalışan davranışı
- Hijyen
- Ürün kalitesi

Dashboard'da:
> "Son 30 günde müşteriler en çok 'bekleme süresi' hakkında yorum yaptı."

#### 🔹 3.4 Kelime Bulutu
Yorumlarda en çok geçen kelimeler

#### 🔹 3.5 Rakip Analizi (Opsiyonel Ama Güçlü)
- Kullanıcı 1-5 rakip Place ID'si ekleyebilir
- Gösterilir:
  - Rakip rating trendi
  - Rakiplerin toplam yorum sayısı
  - Ortak kelimeler
  - Benchmark grafiği
- **Ajanslar bunu aşırı değerli bulur**

---

### 4) WhatsApp Entegrasyonu (Yeni Yorum Bildirimi)

#### 🔹 4.1 Yeni Yorum Algılama
Her 15 dakikada Places API ile kontrol

#### 🔹 4.2 AI Cevaplı WhatsApp Bildirimi
Örnek mesaj:

```
📣 Yeni Google Yorumu Geldi!
⭐️⭐️⭐️⭐️⭐️ – "Çalışanlar çok ilgiliydi"

🤖 Önerilen Cevap:
"Merhaba, olumlu geri bildiriminiz için çok teşekkür ederiz..."

👉 Google'da cevaplamak için Chrome Extension'ı açın.
```

#### 🔹 4.3 WhatsApp API (Twilio / Meta Cloud API)
Kullanıcı kendi numarasını bağlar, webhook ile mesaj gönderilir

---

### 5) Hesap Yönetimi

#### 🔹 5.1 Kullanıcı kayıt ve login (JWT veya NextAuth)
- Email + şifre
- Google ile giriş

#### 🔹 5.2 İşletme Ekleme
Kullanıcı birden fazla Place ID ekleyebilir (ajans modu)

#### 🔹 5.3 Kullanıcı rolleri
- Admin
- Ajans yetkilisi
- İşletme yöneticisi

#### 🔹 5.4 Faturalandırma (Stripe Subscription)
Planlar:
- **Starter** (tek işletme)
- **Pro** (limitsiz yorum & AI)
- **Agency** (çok işletme + rakip analizi + raporlar)

---

### 6) Ekstralar (Değer Artırıcı Özellikler)

#### 🔹 6.1 Auto-Toxic Filter
AI şu yorumları otomatik işaretler:
- Hakaret / küfür
- Spam
- Rakip sabotajı
- Bot yorum
- Tehdit içeren yorum

Dashboard'da "Riskli yorumlar" bölümü

#### 🔹 6.2 Haftalık PDF Raporu
AI ile özet:
```
Bu hafta 18 yorum aldın
Average rating: 4.7
En çok şikayet edilen konu: "bekleme süresi"
Öneri: "Pazartesi günleri yoğunluk artıyor, randevuları optimize edebilirsin."
```

#### 🔹 6.3 AI-Auto Tone Library
Ton profilleri kaydedilebilir:
- "Marka tonu"
- "Sıcak – arkadaşça"
- "Kurumsal"
- "Lüks müşteri deneyimi"

Her işletme farklı ton seçebilir

---

## 🧱 TEKNİK MİMARİ

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- React Query (veri yönetimi)
- Recharts (analitik grafik)
- Zustand (global state opsiyonu)

### Backend
- Next.js API Routes
- Google Places API (review fetch)
- Gemini 1.5 Flash (AI cevap)
- Supabase / PostgreSQL (veritabanı)
- Cron jobs (Vercel Cron / serverless)

### Chrome Extension
- Manifest v3
- Content script (DOM okumak)
- Background worker (API çağırmak)
- Popup UI

### 3rd Party
- Stripe Subscription
- WhatsApp Cloud API
- Cloudflare / Vercel (hosting)

---

## 🎯 KULLANICI YOLCULUĞU

1. Landing Page → CTA: "7 gün ücretsiz dene"
2. Google ile giriş
3. Place ID gir: işletme bağlanır
4. Dashboard açılır → tüm yorumlar görünür
5. Her yorum için:
   - AI cevap oluştur
   - Chrome extension ile tek tıkla doldur
6. WhatsApp'tan bildirim gelir
7. Haftalık PDF raporları otomatik gönderilir
8. Trial biter → Stripe checkout → aboneliğe geçer

---

## 💰 Satın Alma Sebepleri

- ✅ Zaman kazandırır (günde 30 dakika → yılda 180 saat)
- ✅ Profesyonel, tutarlı cevaplar
- ✅ Daha iyi Google görünürlüğü
- ✅ Ajanslar için çoklu işletme yönetimi
- ✅ Rakip analizi
- ✅ WhatsApp ile anlık bildirim
- ✅ Chrome Extension sayesinde Google'da tek tıkla doldurma
- ✅ Yorum analizi → stratejik içgörüler

**Eskiden 1 saatte yapılan iş şimdi 5 dakikada.**

---

## 🟢 TEK CÜMLE ÖZET

Google Places API ile yorumları çeken, AI ile cevap üreten, Chrome Extension ile Google Business'ta tek tıkla dolduran, WhatsApp + analitik + rakip karşılaştırması sunan bir **Review Management SaaS**.

---

## 📅 Sonraki Adımlar

- [ ] MVP özelliklerini belirle
- [ ] Geliştirme takvimi oluştur
- [ ] Veritabanı şeması tasarla
- [ ] Wireframe/Mockup hazırla
- [ ] Domain ve marka adı seç
