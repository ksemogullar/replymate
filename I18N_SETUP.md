# 🌍 Çoklu Dil Sistemi (i18n) Kurulumu

## ✅ Tamamlanan

### 1. Altyapı
- ✅ `/lib/i18n/translations/` - TR, EN, NL çeviri dosyaları oluşturuldu
- ✅ `/lib/i18n/useTranslation.ts` - React hook oluşturuldu
- ✅ `/components/LanguageSwitcher.tsx` - Dil değiştirici component eklendi
- ✅ `/context/LocaleContext.tsx` - Zaten mevcuttu, localStorage ile dil tercihi saklanıyor

### 2. Çevrilmiş Dosyalar
- ✅ **Dashboard** - Ana navigasyon, tab'lar, butonlar
  - Navigation tabs (Genel Bakış, Yorumlar, Şablonlar, vb.)
  - Header butonları (İşletme Ekle, Çıkış)
  - Loading ve empty states
  - Dil değiştirici eklendi

### 3. Çeviri Kategorileri
Tüm çevirilerde şu kategoriler destekleniyor:

- `common` - Genel UI elemanları (kaydet, iptal, sil, yükle, vb.)
- `auth` - Giriş/kayıt sayfaları
- `nav` - Navigasyon menüsü
- `dashboard` - Ana sayfa
- `reviews` - Yorumlar sayfası
- `templates` - Şablonlar sayfası
- `analytics` - Analitik sayfası
- `competitors` - Rakip analizi sayfası
- `settings` - Ayarlar sayfası
- `onboarding` - İlk kurulum
- `errors` - Hata mesajları
- `success` - Başarı mesajları

## 📝 Kullanım

### Hook ile Kullanım
```typescript
import { useTranslation } from '@/lib/i18n/useTranslation'

function MyComponent() {
  const { t, locale } = useTranslation()

  return (
    <div>
      <h1>{t.dashboard.welcome}</h1>
      <button>{t.common.save}</button>
    </div>
  )
}
```

### Dil Değiştirici Ekleme
```typescript
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  )
}
```

## 🔄 Sonraki Adımlar (İsteğe Bağlı)

Dashboard dosyası çok büyük (2610 satır). Temel navigasyon ve önemli bölümler çevrildi.
Kalan işler (isteğe bağlı):

### Dashboard İçindeki Detaylar
- [ ] Yorum kartlarındaki metinler
- [ ] Şablon modal'ındaki form label'ları
- [ ] Analitik grafik başlıkları
- [ ] Settings form label'ları
- [ ] Rakip analizi detayları (COMPETITOR_TEXTS kaldırılabilir)

### Diğer Sayfalar
- [ ] `/app/auth/login/page.tsx`
- [ ] `/app/auth/signup/page.tsx`
- [ ] `/app/onboarding/page.tsx`
- [ ] `/app/page.tsx` (Landing page)

### API Mesajları
- [ ] API hata mesajları (şu an İngilizce/Türkçe karışık)

## 🎯 Mevcut Durum

**Çalışır Durumda:**
- ✅ 3 dil desteği (TR, EN, NL)
- ✅ LocalStorage ile dil tercihi kaydediliyor
- ✅ Dil değiştirici dashboard header'da
- ✅ Ana navigasyon tam çevrilmiş
- ✅ TypeScript tip güvenliği

**Not:** Dashboard'daki bazı bölümlerde hala hardcoded Türkçe metinler var (yorumlar, ayarlar detayları vb.). Bunlar ihtiyaç oldukça güncellenebilir.

## 📦 Çeviri Dosya Yapısı

```
lib/i18n/
├── locales.ts              # Dil tanımları ve sabitler
├── useTranslation.ts       # React hook
└── translations/
    ├── index.ts            # Export ve helper fonksiyonlar
    ├── tr.ts               # Türkçe çeviriler
    ├── en.ts               # İngilizce çeviriler
    └── nl.ts               # Hollandaca çeviriler
```

## 🚀 Yeni Çeviri Ekleme

1. `lib/i18n/translations/tr.ts` dosyasına yeni anahtar ekle
2. Aynı anahtarı `en.ts` ve `nl.ts` dosyalarına da ekle
3. Component'te `t.kategori.anahtar` şeklinde kullan

Örnek:
```typescript
// tr.ts
export const tr = {
  myFeature: {
    title: 'Yeni Özellik',
    description: 'Açıklama'
  }
}

// Component'te
const { t } = useTranslation()
<h1>{t.myFeature.title}</h1>
```
