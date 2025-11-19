"use client";

import { useMemo, useState } from 'react'
import { localeLabels, Locale, SUPPORTED_LOCALES } from '@/lib/i18n/locales'
import { useLocale } from '@/context/LocaleContext'
import { useTranslation } from '@/lib/i18n/useTranslation'

const demoLanguages = ['Türkçe', 'İngilizce', 'Felemenkçe']
const tones = ['Profesyonel', 'Samimi', 'Kısa', 'Detaylı']

const translations: Record<Locale, {
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  ctaPrimary: string
  ctaSecondary: string
  stats: { label: string; value: string }[]
  featuresTitle: string
  features: { title: string; desc: string }[]
  workflowEyebrow: string
  workflowTitle: string
  workflowSteps: { title: string; desc: string }[]
  demoEyebrow: string
  demoTitle: string
  demoDescription: string
  demoTextarea: string
  demoButton: string
  demoError: string
  demoCopy: string
  pricingEyebrow: string
  pricingTitle: string
  pricingSubtitle: string
  plans: { name: string; price: string; note: string; features: string[]; cta: string; contact?: boolean }[]
  betaEyebrow: string
  betaTitle: string
  betaSubtitle: string
  betaPrimary: string
  betaSecondary: string
  faq: { question: string; answer: string }[]
}> = {
  tr: {
    heroEyebrow: 'Review Automation',
    heroTitle: 'ReplyMate',
    heroSubtitle:
      'Google yorumlarını tek tıkla toplayan ve markanızın tonunda cevaplayan otomasyon platformu. Ajanslar için tasarlandı, küçük işletmeler için ideal.',
    ctaPrimary: 'Ücretsiz Başla',
    ctaSecondary: 'Demo İncele',
    stats: [
      { label: 'İzlenen yorum', value: '12K+' },
      { label: 'AI cevap', value: '8.4K' },
      { label: 'Ortalama yanıt süresi', value: '47sn' },
      { label: 'Mutlu işletme', value: '120+' },
    ],
    featuresTitle: 'Özellik',
    features: [
      {
        title: 'Google Business entegrasyonu',
        desc: 'Tüm mağazalarınızın yorumlarını tek panelde görün, yeni gelenleri anlık takip edin.',
      },
      {
        title: 'AI destekli cevaplar',
        desc: 'Marka tonu ve tercih ettiğiniz dillerle saniyeler içinde yanıt taslakları üretin.',
      },
      {
        title: 'Ajans modu',
        desc: 'Çoklu işletme yönetimi, ekip yetkilendirmesi ve otomatik raporlar tek panelde.',
      },
    ],
    workflowEyebrow: 'Çalışma Akışı',
    workflowTitle: '3 adımda otomatik yanıt',
    workflowSteps: [
      {
        title: '1. İşletmeni bağla',
        desc: 'Google Business hesabını 30 saniyede yetkilendir, tüm lokasyonları içeri aktar.',
      },
      {
        title: '2. Yorumları senkronize et',
        desc: 'ReplyMate dakikada bir yeni yorumları yakalar ve analiz eder.',
      },
      {
        title: '3. AI cevaplarını gönder',
        desc: 'Tek tıkla yayınla ya da Chrome eklentisiyle Google Business panelinde otomatik doldur.',
      },
    ],
    demoEyebrow: 'Canlı Demo',
    demoTitle: 'AI cevabı nasıl çalışır?',
    demoDescription: 'Müşteri yorumunu gir, dil ve ton seç, saniyeler içinde hazır yanıt al.',
    demoTextarea: 'Google yorumunu buraya yapıştır...',
    demoButton: 'AI Cevap Üret',
    demoError: 'Sunucuya bağlanırken bir sorun oluştu.',
    demoCopy: 'Oluşturulan Cevap',
    pricingEyebrow: 'Fiyatlandırma',
    pricingTitle: 'Şeffaf paketler, net limitler',
    pricingSubtitle:
      'İşletme ya da ajans ölçeğiniz fark etmez; büyüdükçe plana geçebilir veya dilediğiniz an iptal edebilirsiniz.',
    plans: [
      {
        name: 'Starter',
        price: '₺990',
        note: 'aylık',
        features: ['1 işletme', 'Aylık 300 yorum', 'AI yanıt üretici', 'Chrome eklentisi'],
        cta: 'Hemen Başla',
      },
      {
        name: 'Pro',
        price: '₺2.490',
        note: 'aylık',
        features: ['5 işletme', 'Aylık 1.500 yorum', 'WhatsApp bildirimleri', 'Öncelikli destek'],
        cta: 'Hemen Başla',
      },
      {
        name: 'Agency',
        price: 'Sizinle konuşalım',
        note: 'Özel plan',
        features: ['Limitsiz işletme', 'API erişimi', 'Beyaz etiket', 'Özel SLA'],
        cta: 'Satışla Görüş',
        contact: true,
      },
    ],
    betaEyebrow: 'Beta erişimi',
    betaTitle: 'İlk 50 işletmeye ömür boyu %40 indirim',
    betaSubtitle: 'ReplyMate’i ücretsiz deneyin, memnun kalırsanız daha fazla mağaza ekleyin. İstediğiniz an iptal edin.',
    betaPrimary: 'Hemen Başla',
    betaSecondary: 'Satışla Görüş',
    faq: [
      {
        question: 'Google doğrulaması olmadan kullanabilir miyim?',
        answer: 'Evet, test kullanıcılarınıza erişim vererek başlayabilirsiniz. Canlıya çıktığınızda Google doğrulama süreci için destek sunuyoruz.',
      },
      {
        question: 'Tokenlar nerede saklanıyor?',
        answer: 'Google OAuth tokenları Supabase’de şifrelenmiş şekilde tutulur ve sadece senkronizasyon fonksiyonları tarafından kullanılır.',
      },
      {
        question: 'Otomatik cevapları göndermek mümkün mü?',
        answer: 'AI yanıtlarını Google Business’tan otomatik göndermek için Chrome eklentimiz veya API’miz üzerinden tek tıkla paylaşabilirsiniz.',
      },
      {
        question: 'Kota limitlerine takılırsam ne oluyor?',
        answer: 'Google’dan quota artışı talep etmenize yardımcı oluyoruz; ReplyMate çağrıları throttle edip sınır içinde kalmanızı sağlar.',
      },
    ],
  },
  en: {
    heroEyebrow: 'Review Automation',
    heroTitle: 'ReplyMate',
    heroSubtitle:
      'All your Google reviews in one place, answered with your brand voice. Built for agencies, perfect for local businesses.',
    ctaPrimary: 'Start for Free',
    ctaSecondary: 'See the Demo',
    stats: [
      { label: 'Reviews monitored', value: '12K+' },
      { label: 'AI replies generated', value: '8.4K' },
      { label: 'Avg. response time', value: '47s' },
      { label: 'Happy businesses', value: '120+' },
    ],
    featuresTitle: 'Feature',
    features: [
      {
        title: 'Google Business integration',
        desc: 'See every location and review in one dashboard with live sync.',
      },
      {
        title: 'AI-powered replies',
        desc: 'Generate ready-to-send answers in your tone and language.',
      },
      {
        title: 'Agency mode',
        desc: 'Manage clients, assign teammates and export reports effortlessly.',
      },
    ],
    workflowEyebrow: 'Workflow',
    workflowTitle: '3-step automation',
    workflowSteps: [
      {
        title: '1. Connect your business',
        desc: 'Authorize Google Business in seconds and import locations.',
      },
      {
        title: '2. Sync every review',
        desc: 'ReplyMate tracks new feedback and highlights risky reviews.',
      },
      {
        title: '3. Publish AI replies',
        desc: 'Copy, edit or auto-fill Google Business via our Chrome extension.',
      },
    ],
    demoEyebrow: 'Live Demo',
    demoTitle: 'See AI replies in action',
    demoDescription: 'Paste any review, pick tone & language, get a polished answer instantly.',
    demoTextarea: 'Paste the Google review here...',
    demoButton: 'Generate Reply',
    demoError: 'Something went wrong while contacting the server.',
    demoCopy: 'Generated Reply',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Transparent plans for growing teams',
    pricingSubtitle: 'Choose the plan that fits today, scale later or cancel anytime.',
    plans: [
      {
        name: 'Starter',
        price: '$39',
        note: 'per month',
        features: ['1 location', '300 reviews / month', 'AI reply builder', 'Chrome extension'],
        cta: 'Start Now',
      },
      {
        name: 'Pro',
        price: '$99',
        note: 'per month',
        features: ['5 locations', '1,500 reviews / month', 'WhatsApp alerts', 'Priority support'],
        cta: 'Start Now',
      },
      {
        name: 'Agency',
        price: 'Custom pricing',
        note: 'Let’s talk',
        features: ['Unlimited locations', 'API access', 'White-label', 'Dedicated SLA'],
        cta: 'Talk to Sales',
        contact: true,
      },
    ],
    betaEyebrow: 'Beta Access',
    betaTitle: 'Lifetime 40% off for the first 50 accounts',
    betaSubtitle: 'Try ReplyMate for free and upgrade when you’re ready. Cancel anytime.',
    betaPrimary: 'Join Beta',
    betaSecondary: 'Talk to Sales',
    faq: [
      {
        question: 'Can I use ReplyMate without Google verification?',
        answer: 'Yes. Start with test users while your verification is pending. We provide guidance for production approval.',
      },
      {
        question: 'Where are tokens stored?',
        answer: 'OAuth tokens live in Supabase with row-level security and are only accessed by the sync service.',
      },
      {
        question: 'Do you auto-publish replies?',
        answer: 'You can copy, edit or push replies directly via our Chrome extension and API.',
      },
      {
        question: 'What happens if I hit Google quotas?',
        answer: 'We help you request higher quotas and throttle requests on our side to respect limits.',
      },
    ],
  },
  nl: {
    heroEyebrow: 'Review Automatisering',
    heroTitle: 'ReplyMate',
    heroSubtitle:
      'Alle Google-recensies op één plek, automatisch beantwoord in jouw merkstem. Perfect voor bureaus en lokale ondernemers.',
    ctaPrimary: 'Gratis starten',
    ctaSecondary: 'Demo bekijken',
    stats: [
      { label: 'Beheerde reviews', value: '12K+' },
      { label: 'AI-antwoorden', value: '8.4K' },
      { label: 'Gem. reactietijd', value: '47s' },
      { label: 'Tevreden klanten', value: '120+' },
    ],
    featuresTitle: 'Feature',
    features: [
      {
        title: 'Google Business integratie',
        desc: 'Bekijk al je locaties en reviews realtime in één dashboard.',
      },
      {
        title: 'AI-gestuurde reacties',
        desc: 'Genereer binnen seconden antwoorden in jouw toon en taal.',
      },
      {
        title: 'Agency modus',
        desc: 'Beheer meerdere klanten, wijs teamleden toe en exporteer rapporten.',
      },
    ],
    workflowEyebrow: 'Workflow',
    workflowTitle: 'Automatisering in 3 stappen',
    workflowSteps: [
      {
        title: '1. Koppel je bedrijf',
        desc: 'Autoriseer Google Business en importeer direct je locaties.',
      },
      {
        title: '2. Synchroniseer reviews',
        desc: 'ReplyMate detecteert nieuwe reviews en waarschuwt bij risico’s.',
      },
      {
        title: '3. Publiceer AI-antwoorden',
        desc: 'Kopieer, bewerk of vul automatisch in via onze Chrome-extensie.',
      },
    ],
    demoEyebrow: 'Live Demo',
    demoTitle: 'Zo werkt het',
    demoDescription: 'Plak een review, kies toon en taal, ontvang direct een professioneel antwoord.',
    demoTextarea: 'Plak hier de Google-review...',
    demoButton: 'Antwoord genereren',
    demoError: 'Er ging iets mis bij het verbinden met de server.',
    demoCopy: 'Gegenereerd antwoord',
    pricingEyebrow: 'Prijzen',
    pricingTitle: 'Transparante pakketten, duidelijke limieten',
    pricingSubtitle: 'Upgrade wanneer je groeit of annuleer op elk moment.',
    plans: [
      {
        name: 'Starter',
        price: '€39',
        note: 'per maand',
        features: ['1 locatie', '300 reviews / maand', 'AI-antwoordtool', 'Chrome-extensie'],
        cta: 'Start nu',
      },
      {
        name: 'Pro',
        price: '€99',
        note: 'per maand',
        features: ['5 locaties', '1.500 reviews / maand', 'WhatsApp meldingen', 'Priority support'],
        cta: 'Start nu',
      },
      {
        name: 'Agency',
        price: 'Op maat',
        note: 'Laten we praten',
        features: ['Onbeperkte locaties', 'API-toegang', 'White-label', 'Dedicated SLA'],
        cta: 'Contact verkoop',
        contact: true,
      },
    ],
    betaEyebrow: 'Beta toegang',
    betaTitle: 'Levenslang 40% korting voor de eerste 50 klanten',
    betaSubtitle: 'Test ReplyMate gratis en upgrade wanneer je wilt. Altijd opzegbaar.',
    betaPrimary: 'Doe mee',
    betaSecondary: 'Contact verkoop',
    faq: [
      {
        question: 'Kan ik starten zonder Google-verificatie?',
        answer: 'Ja. Begin met testgebruikers terwijl de verificatie loopt. We helpen bij het live-goedkeuringsproces.',
      },
      {
        question: 'Waar worden tokens opgeslagen?',
        answer: 'OAuth-tokens staan veilig in Supabase en worden alleen door de synchronisatieservice gelezen.',
      },
      {
        question: 'Publiceren jullie de antwoorden automatisch?',
        answer: 'Met de Chrome-extensie en API kun je antwoorden met één klik plaatsen.',
      },
      {
        question: 'Wat als ik tegen quota aanloop?',
        answer: 'We helpen bij het aanvragen van hogere quota en beperken verzoeken zodat je binnen de limieten blijft.',
      },
    ],
  },
}

export default function Home() {
  const { locale, setLocale } = useLocale()
  const { t: tMain } = useTranslation()
  const [review, setReview] = useState('')
  const [language, setLanguage] = useState(demoLanguages[0])
  const [tone, setTone] = useState(tones[0])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const t = useMemo(() => translations[locale], [locale])

  const handleGenerate = async () => {
    setErrorMsg('')
    setReply('')

    if (!review.trim()) {
      setErrorMsg(tMain.landing.enterReviewFirst)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ review, language, tone }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || tMain.landing.genericError)
        return
      }

      const data = await res.json()
      setReply(data.reply || '')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(tMain.landing.connectionError)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!reply) return
    try {
      await navigator.clipboard.writeText(reply)
      alert(tMain.landing.copiedToClipboard)
    } catch {
      alert(tMain.landing.copyFailed)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-20 border-b border-slate-900/60 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm text-slate-100">
          <div className="font-semibold">ReplyMate</div>
          <nav className="hidden gap-6 md:flex">
            <a href="#features" className="text-slate-400 hover:text-white">
              {tMain.landing.features}
            </a>
            <a href="#workflow" className="text-slate-400 hover:text-white">
              {tMain.landing.workflow}
            </a>
            <a href="#pricing" className="text-slate-400 hover:text-white">
              {tMain.landing.pricing}
            </a>
            <a href="#demo" className="text-slate-400 hover:text-white">
              {tMain.landing.demo}
            </a>
          </nav>
          <a
            href="/auth/login"
            className="rounded-full border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
          >
            {tMain.landing.login}
          </a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-24">
        <div className="flex justify-end">
          <div className="flex gap-2 rounded-full border border-slate-800 bg-slate-900/60 p-1 text-xs font-semibold text-slate-300">
            {SUPPORTED_LOCALES.map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`rounded-full px-3 py-1 transition ${
                  locale === lang ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                {localeLabels[lang]}
              </button>
            ))}
          </div>
        </div>
        <header className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t.heroEyebrow}</p>
            <h1 className="text-4xl sm:text-5xl font-bold mt-2">{t.heroTitle}</h1>
            <p className="text-slate-400 mt-3 max-w-2xl">{t.heroSubtitle}</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href="/auth/signup"
                className="px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-500 text-white"
              >
                {t.ctaPrimary}
              </a>
              <a
                href="/auth/login"
                className="px-6 py-3 rounded-full text-sm font-semibold border border-slate-700 text-slate-200"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="flex-1">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Google Reviews</span>
                  <span className="text-slate-500">Live</span>
                </div>
                <div className="mt-3 space-y-4 text-sm text-slate-300">
                  {['Olumlu (5★)', 'Nötr (3★)', 'Riskli (1★)'].map((status, idx) => (
                    <div key={status} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between">
                        <p>{status}</p>
                        <p className="text-slate-500">{idx === 0 ? 'AI cevap hazır' : idx === 1 ? 'İncele' : 'Öncelikli'}</p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        “Güler yüzünüz için teşekkürler...”
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                {t.stats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section id="features" className="grid gap-6 md:grid-cols-3">
          {t.features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="text-sm uppercase tracking-wide text-sky-300">{t.featuresTitle}</p>
              <h3 className="mt-3 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{tMain.landing.useCaseLabel}</p>
            <h3 className="mt-3 text-2xl font-semibold">Tattoo stüdyosu 2 ayda 320 yorumu yönetti</h3>
            <p className="mt-3 text-sm text-slate-200">
              ReplyMate ile Up Ink Tattoo Amsterdam tüm Google yorumlarını tek panelde topladı ve ortalama yanıt süresini 4 saate düşürdü.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center text-sm">
              {[
                { label: 'Yanıt oranı', value: '92%' },
                { label: 'Pozitif skor', value: '+1.2⭐️' },
                { label: 'AI cevap', value: '420' },
                { label: 'Tasarruf', value: '18 saat/hafta' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-4 py-3">
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{tMain.landing.screenshotLabel}</p>
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-inner">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>replymate-dashboard.dev</span>
                <span>•••</span>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Sinem K.</p>
                      <p className="text-xs text-yellow-300">★★★★★</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      “Stüdyo inanılmaz steril ve ekip çok ilgiliydi. Kesinlikle tavsiye ederim.”
                    </p>
                    <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-400">
                      <p>AI Yanıt Taslağı</p>
                      <p className="mt-1 text-slate-300">
                        "Güzel yorumunuz için teşekkürler Sinem, tekrar bekleriz!"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{t.workflowEyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold">{t.workflowTitle}</h2>
            <div className="mt-8 space-y-6">
              {t.workflowSteps.map((item, index) => (
                <div key={item.title} className="flex gap-4">
                  <span className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-900 text-sky-300 font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div id="demo" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
            <p className="text-sm font-semibold text-slate-400">{t.demoEyebrow}</p>
            <h3 className="mt-1 text-2xl font-semibold">{t.demoTitle}</h3>
            <p className="mt-2 text-sm text-slate-400">{t.demoDescription}</p>

            <label className="mt-6 block text-sm font-medium text-slate-200">{tMain.landing.customerReviewLabel}</label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={5}
              placeholder={t.demoTextarea}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-200">{tMain.landing.languageLabel}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                >
                  {demoLanguages.map((lang) => (
                    <option key={lang} value={lang} className="bg-slate-900">
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-200">{tMain.landing.toneLabel}</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
                >
                  {tones.map((tn) => (
                    <option key={tn} value={tn} className="bg-slate-900">
                      {tn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? tMain.landing.generating : t.demoButton}
            </button>

            {errorMsg && <p className="mt-3 text-sm text-rose-300">{t.demoError}</p>}

            {reply && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200">{t.demoCopy}</p>
                  <button
                    onClick={handleCopy}
                    className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                  >
                    {tMain.landing.copy}
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{reply}</p>
              </div>
            )}
          </div>
        </section>

        <section id="pricing" className="rounded-3xl border border-slate-800 bg-slate-900/70 px-8 py-12">
          <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-400">{t.pricingEyebrow}</p>
          <h3 className="mt-4 text-center text-3xl font-semibold">{t.pricingTitle}</h3>
          <p className="mt-3 text-center text-slate-400">{t.pricingSubtitle}</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {t.plans.map((plan, index) => (
              <div
                key={plan.name}
                className={`rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center ${
                  index === 1 ? 'ring-2 ring-sky-400' : ''
                }`}
              >
                <p className="text-sm font-semibold text-slate-400">{plan.name}</p>
                <p className="mt-3 text-3xl font-bold">{plan.price}</p>
                <p className="text-xs uppercase tracking-widest text-slate-500">{plan.note}</p>
                <ul className="mt-6 space-y-2 text-sm text-slate-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center justify-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.contact ? 'mailto:hello@replymate.ai' : '/auth/signup'}
                  className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold ${
                    index === 1
                      ? 'bg-gradient-to-r from-sky-400 via-indigo-400 to-pink-500 text-white'
                      : 'border border-slate-700 text-slate-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-8 py-12">
          <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-400">FAQ</p>
          <h3 className="mt-4 text-center text-3xl font-semibold">{tMain.landing.faqTitle}</h3>
          <div className="mt-8 space-y-4">
            {t.faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <summary className="flex cursor-pointer items-center justify-between text-left text-lg font-semibold text-slate-100">
                  {item.question}
                  <span className="text-sm text-slate-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 px-8 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">{t.betaEyebrow}</p>
          <h3 className="mt-4 text-3xl font-semibold">{t.betaTitle}</h3>
          <p className="mt-3 text-slate-400">{t.betaSubtitle}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="/auth/signup"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900"
            >
              {t.betaPrimary}
            </a>
            <a
              href="mailto:hello@replymate.ai"
              className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200"
            >
              {t.betaSecondary}
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
