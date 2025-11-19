'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const LANGUAGES = ['Türkçe', 'İngilizce', 'Felemenkçe']
const TONES = ['Profesyonel', 'Samimi', 'Kısa', 'Detaylı']

interface Business {
  id: string
  name: string
  address: string
  rating: number
  total_reviews: number
  place_id: string
  last_sync_at?: string | null
  default_language?: string | null
  default_tone?: string | null
  custom_instructions?: string | null
}

interface Profile {
  full_name: string
  email: string
  onboarding_completed: boolean
}

interface Review {
  id: string
  author_name: string
  author_photo_url: string | null
  rating: number
  text: string | null
  review_created_at: string
  has_reply: boolean
  reply_text: string | null
  replied_at: string | null
}

interface Template {
  id: string
  business_id: string
  name: string
  description: string | null
  tone_type: string
  language: string
  instructions: string
  example_response: string | null
}

interface Competitor {
  id: string
  business_id: string
  competitor_place_id: string
  competitor_name: string
  address: string | null
  rating: number | null
  total_reviews: number
  last_sync_at: string | null
}

type CategoryKey = 'service' | 'price' | 'quality' | 'staff' | 'cleanliness' | 'speed' | 'other'

interface TimeSeriesPoint {
  date: string
  review_count: number
  avg_rating: number | null
}

interface CompetitorSeries {
  id: string
  name: string
  data: TimeSeriesPoint[]
}

interface CompetitorMetrics {
  business: {
    id: string
    name: string
    time_series: TimeSeriesPoint[]
  }
  competitor_rankings: {
    id: string
    name: string
    rating: number | null
    total_reviews: number
    last_sync_at: string | null
  }[]
  competitor_series: CompetitorSeries[]
}

interface CategorySummary {
  positive: number
  negative: number
  neutral: number
}

type CategoryInsights = Record<CategoryKey, CategorySummary>

interface CategoriesResponse {
  own_categories: CategoryInsights
  competitor_categories: {
    id: string
    name: string
    categories: CategoryInsights
  }[]
}

const buildLinePath = (points: TimeSeriesPoint[] = [], width: number, height: number) => {
  if (!points || points.length === 0) {
    return ''
  }

  const maxValue = 5
  const len = points.length

  return points
    .map((point, index) => {
      const value = point.avg_rating ?? 0
      const x = len === 1 ? width / 2 : (index / (len - 1)) * width
      const y = height - (value / maxValue) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

const CATEGORY_LABELS: Record<CategoryKey, { tr: string; en: string; nl: string }> = {
  service: { tr: 'Hizmet', en: 'Service', nl: 'Service' },
  price: { tr: 'Fiyat', en: 'Price', nl: 'Prijs' },
  quality: { tr: 'Ürün/Kalite', en: 'Product/Quality', nl: 'Product/Kwaliteit' },
  staff: { tr: 'Personel', en: 'Staff', nl: 'Personeel' },
  cleanliness: { tr: 'Temizlik', en: 'Cleanliness', nl: 'Hygiëne' },
  speed: { tr: 'Hız', en: 'Speed', nl: 'Snelheid' },
  other: { tr: 'Diğer', en: 'Other', nl: 'Overig' },
}

const COMPETITOR_TEXTS = {
  tr: {
    tabTitle: 'Rakip Analizi',
    tabDescription: 'Rakiplerinizi ekleyin ve performanslarını karşılaştırın',
    searchPlaceholder: 'Rakip işletme adı veya adresi ara...',
    addButton: 'Ekle',
    addButtonLoading: 'Ekleniyor...',
    performanceTitle: 'Performans Özeti',
    performanceSubtitle: 'Son 30 günde siz ve rakiplerinizin puan ve yorum değişimleri',
    refresh: 'Verileri Yenile',
    refreshing: 'Yenileniyor...',
    metricsLoading: 'Metrikler yükleniyor...',
    metricsEmpty: 'Henüz rakip metrikleri bulunamadı.',
    cards: {
      avg: 'Ortalama Puanınız',
      top: 'En güçlü rakip',
      volume: 'Yorum hacmi (30g)',
      competitor: 'En yakın rakip',
      noData: 'Veri yok',
    },
    chart: {
      title: 'Ortalama Puan Trendi',
      subtitle: 'Siz vs. en güçlü rakip',
      legendYou: 'Siz',
      legendCompetitor: 'Rakip',
    },
    rankingTitle: 'Rakip Sıralaması',
    rankingHeaders: { competitor: 'Rakip', rating: 'Puan', reviews: 'Yorum', sync: 'Son Senkron' },
    categoriesTitle: 'Kategori Bazlı İçgörüler',
    categoriesSubtitle: 'Son 30 günde kullanıcıların en çok konuştuğu konular',
    categoriesLoading: 'Güncelleniyor...',
    categoryOwn: 'Siz',
    categoryCompetitor: 'Rakip',
    categoryPositive: 'Pozitif',
    categoryNegative: 'Negatif',
    categoryNeutral: 'Nötr',
  },
  en: {
    tabTitle: 'Competitor Analysis',
    tabDescription: 'Add competitors and compare performance metrics',
    searchPlaceholder: 'Search competitor name or address...',
    addButton: 'Add',
    addButtonLoading: 'Adding...',
    performanceTitle: 'Performance Overview',
    performanceSubtitle: 'Rating and review changes in the last 30 days',
    refresh: 'Refresh Data',
    refreshing: 'Refreshing...',
    metricsLoading: 'Loading metrics...',
    metricsEmpty: 'No competitor metrics yet.',
    cards: {
      avg: 'Your Average Rating',
      top: 'Top Competitor',
      volume: 'Review Volume (30d)',
      competitor: 'Nearest competitor',
      noData: 'No data',
    },
    chart: {
      title: 'Average Rating Trend',
      subtitle: 'You vs. top competitor',
      legendYou: 'You',
      legendCompetitor: 'Competitor',
    },
    rankingTitle: 'Competitor Ranking',
    rankingHeaders: { competitor: 'Competitor', rating: 'Rating', reviews: 'Reviews', sync: 'Last Sync' },
    categoriesTitle: 'Category Insights',
    categoriesSubtitle: 'Top topics mentioned in the last 30 days',
    categoriesLoading: 'Updating...',
    categoryOwn: 'You',
    categoryCompetitor: 'Competitor',
    categoryPositive: 'Positive',
    categoryNegative: 'Negative',
    categoryNeutral: 'Neutral',
  },
  nl: {
    tabTitle: 'Concurrentie Analyse',
    tabDescription: 'Voeg concurrenten toe en vergelijk prestaties',
    searchPlaceholder: 'Zoek bedrijfsnaam of adres...',
    addButton: 'Toevoegen',
    addButtonLoading: 'Toevoegen...',
    performanceTitle: 'Prestatieoverzicht',
    performanceSubtitle: 'Score- en reviewveranderingen in de laatste 30 dagen',
    refresh: 'Data vernieuwen',
    refreshing: 'Bezig met vernieuwen...',
    metricsLoading: 'Bezig met laden...',
    metricsEmpty: 'Nog geen concurrentgegevens.',
    cards: {
      avg: 'Jouw gemiddelde score',
      top: 'Sterkste concurrent',
      volume: 'Aantal reviews (30d)',
      competitor: 'Dichtste concurrent',
      noData: 'Geen data',
    },
    chart: {
      title: 'Gemiddelde scoretrend',
      subtitle: 'Jij vs. sterkste concurrent',
      legendYou: 'Jij',
      legendCompetitor: 'Concurrent',
    },
    rankingTitle: 'Concurrenten ranglijst',
    rankingHeaders: { competitor: 'Concurrent', rating: 'Score', reviews: 'Reviews', sync: 'Laatste sync' },
    categoriesTitle: 'Categorie-inzichten',
    categoriesSubtitle: 'Meest genoemde onderwerpen in de laatste 30 dagen',
    categoriesLoading: 'Bezig met bijwerken...',
    categoryOwn: 'Jij',
    categoryCompetitor: 'Concurrent',
    categoryPositive: 'Positief',
    categoryNegative: 'Negatief',
    categoryNeutral: 'Neutraal',
  },
}

interface CompetitorReview {
  id: string
  competitor_id: string
  author_name: string
  rating: number
  text: string | null
  review_created_at: string
}

type TabType = 'overview' | 'reviews' | 'templates' | 'analytics' | 'competitors' | 'settings'

export default function Dashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Business & Profile
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')
  const [replyFilter, setReplyFilter] = useState<'all' | 'replied' | 'unreplied'>('all')
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Templates
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateTone, setTemplateTone] = useState('positive')
  const [templateLanguage, setTemplateLanguage] = useState('Türkçe')
  const [templateInstructions, setTemplateInstructions] = useState('')
  const [templateExample, setTemplateExample] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateGenerating, setTemplateGenerating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  // Settings
  const [settingsLanguage, setSettingsLanguage] = useState('Türkçe')
  const [settingsTone, setSettingsTone] = useState('Profesyonel')
  const [settingsInstructions, setSettingsInstructions] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [aiLanguage, setAiLanguage] = useState('Türkçe')
  const [aiTone, setAiTone] = useState('Profesyonel')
  const [generatingAi, setGeneratingAi] = useState(false)
  const [generatedReply, setGeneratedReply] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)

  // Analytics
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState<7 | 30 | 90>(30)

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [competitorsLoading, setCompetitorsLoading] = useState(false)
  const [metricsRefreshing, setMetricsRefreshing] = useState(false)
  const [categoryInsights, setCategoryInsights] = useState<CategoriesResponse | null>(null)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [competitorMetrics, setCompetitorMetrics] = useState<CompetitorMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)
const [competitorLocale, setCompetitorLocale] = useState<'tr' | 'en' | 'nl'>('tr')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [addingCompetitor, setAddingCompetitor] = useState(false)
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)
  const [competitorReviews, setCompetitorReviews] = useState<CompetitorReview[]>([])

  // Status
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

const router = useRouter()
const searchParams = useSearchParams()
const supabase = createClient()

const currentBusiness = businesses.find((b) => b.id === selectedBusiness)
const competitorText = COMPETITOR_TEXTS[competitorLocale]
const competitorDateLocale = competitorLocale === 'tr' ? 'tr-TR' : competitorLocale === 'en' ? 'en-US' : 'nl-NL'

  const loadReviews = useCallback(
    async (businessId: string) => {
      setReviewsLoading(true)
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('business_id', businessId)
          .order('review_created_at', { ascending: false })

        if (error) throw error
        setReviews(data || [])
      } catch (error) {
        console.error('Reviews load error:', error)
        setSyncStatus({ type: 'error', text: 'Yorumlar yüklenemedi.' })
      } finally {
        setReviewsLoading(false)
      }
    },
    [supabase]
  )

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const response = await fetch('/api/templates', { credentials: 'include' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Şablonlar yüklenemedi')
      }

      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Templates load error:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  const loadCompetitors = useCallback(
    async (businessId: string) => {
      setCompetitorsLoading(true)
      try {
        const response = await fetch(`/api/competitors?businessId=${businessId}`)
        const data = await response.json()

        if (data.success) {
          setCompetitors(data.competitors || [])
        }
      } catch (error) {
        console.error('Competitors load error:', error)
      } finally {
        setCompetitorsLoading(false)
      }
    },
    []
  )

  const loadCompetitorMetrics = useCallback(async (businessId: string) => {
    setMetricsLoading(true)
    setMetricsError(null)
    try {
      const response = await fetch(`/api/competitors/metrics?businessId=${businessId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Rakip metrikleri alınamadı')
      }

      setCompetitorMetrics({
        business: data.business,
        competitor_rankings: data.competitor_rankings,
        competitor_series: data.competitor_series,
      })
    } catch (error: any) {
      console.error('Competitor metrics error:', error)
      setMetricsError(error.message || 'Metrikler alınamadı')
    } finally {
      setMetricsLoading(false)
      setMetricsRefreshing(false)
    }
  }, [])

  const loadCategoryInsights = useCallback(async (businessId: string) => {
    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/competitors/categories?businessId=${businessId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Kategori içgörüleri alınamadı')
      }

      setCategoryInsights(data)
    } catch (error) {
      console.error('Category insights error:', error)
    } finally {
      setCategoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (selectedBusiness && activeTab === 'competitors') {
      loadCompetitors(selectedBusiness)
      loadCompetitorMetrics(selectedBusiness)
      loadCategoryInsights(selectedBusiness)
    }
  }, [selectedBusiness, activeTab, loadCompetitors, loadCompetitorMetrics, loadCategoryInsights])

  const clearOAuthParams = useCallback(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.delete('google')
    params.delete('google_error')
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [])

  useEffect(() => {
    if (searchParams.get('google') === 'success') {
      setGoogleConnected(true)
      setSyncStatus({ type: 'success', text: 'Google hesabınız başarıyla bağlandı!' })
      clearOAuthParams()
    } else if (searchParams.get('google_error')) {
      setSyncStatus({ type: 'error', text: 'Google bağlantısı başarısız oldu.' })
      clearOAuthParams()
    }
  }, [searchParams, clearOAuthParams])

  useEffect(() => {
    if (selectedBusiness) {
      loadReviews(selectedBusiness)
    } else {
      setReviews([])
    }
  }, [selectedBusiness, loadReviews])

  useEffect(() => {
    if (!selectedBusiness) {
      setSettingsInstructions('')
      return
    }

    const current = businesses.find((business) => business.id === selectedBusiness)
    if (current) {
      setSettingsLanguage(current.default_language || 'Türkçe')
      setSettingsTone(current.default_tone || 'Profesyonel')
      setSettingsInstructions(current.custom_instructions || '')
    }
  }, [selectedBusiness, businesses])

  const loadData = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/auth/login')
        return
      }

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      setProfile(profileData)

      const { data: businessesData } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (businessesData && businessesData.length > 0) {
        setBusinesses(businessesData)
        setSelectedBusiness((prev) => {
          if (prev && businessesData.some((business) => business.id === prev)) {
            return prev
          }
          return businessesData[0].id
        })
      } else {
        setBusinesses([])
        setSelectedBusiness(null)

        if (profileData && !profileData.onboarding_completed) {
          router.push('/onboarding')
          return
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleSyncReviews = async () => {
    if (!selectedBusiness) return

    setSyncing(true)
    setSyncStatus(null)

    try {
      const response = await fetch('/api/reviews/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: selectedBusiness }),
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Yorumlar senkronize edilemedi')
      }

      await loadReviews(selectedBusiness)

      if (data.business) {
        setBusinesses((prev) =>
          prev.map((business) => (business.id === data.business.id ? { ...business, ...data.business } : business))
        )
      }

      const statusType = data.usedPlacesAPI ? 'warning' : 'success'
      setSyncStatus({ type: statusType, text: data.message || 'Yorumlar senkronize edildi.' })
    } catch (error: any) {
      console.error('Sync error:', error)
      setSyncStatus({ type: 'error', text: error.message || 'Yorumlar senkronize edilemedi' })
    } finally {
      setSyncing(false)
    }
  }

  const handleConnectGoogle = () => {
    if (typeof window === 'undefined') return
    window.location.href = '/api/google/authorize'
  }

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Bu işletmeyi ve tüm yorumlarını silmek istediğinizden emin misiniz?'
      )
      if (!confirmed) {
        return
      }
    }

    setDeleting(true)
    setSyncStatus(null)

    try {
      const response = await fetch(`/api/business/${selectedBusiness}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'İşletme silinemedi')
      }

      await loadData()

      setSyncStatus({ type: 'success', text: 'İşletme silindi.' })
    } catch (error: any) {
      console.error('Delete business error:', error)
      setSyncStatus({ type: 'error', text: error.message || 'İşletme silinemedi' })
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenAiModal = (review: Review) => {
    setSelectedReview(review)
    setGeneratedReply('')
    setAiError(null)
    setAiModalOpen(true)
  }

  const handleSaveSettings = async () => {
    if (!selectedBusiness) return
    setSettingsSaving(true)
    setSyncStatus(null)

    try {
      const response = await fetch(`/api/business/${selectedBusiness}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_language: settingsLanguage,
          default_tone: settingsTone,
          custom_instructions: settingsInstructions || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ayarlar kaydedilemedi')
      }

      if (data.business) {
        setBusinesses((prev) =>
          prev.map((business) => (business.id === data.business.id ? data.business : business))
        )
      }

      setSyncStatus({ type: 'success', text: 'İşletme ayarları kaydedildi.' })
    } catch (error: any) {
      console.error('Settings save error:', error)
      setSyncStatus({ type: 'error', text: error.message || 'Ayarlar kaydedilemedi' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedBusiness) return

    if (!templateName.trim() || !templateInstructions.trim()) {
      setSyncStatus({ type: 'error', text: 'Şablon adı ve içerik zorunludur.' })
      return
    }

    setTemplateSaving(true)
    setSyncStatus(null)

    try {
      const payload = {
        business_id: selectedBusiness,
        name: templateName.trim(),
        description: templateDescription.trim(),
        tone_type: templateTone,
        language: templateLanguage,
        instructions: templateInstructions.trim(),
        example_response: templateExample.trim() || null,
      }

      const response = await fetch(
        editingTemplate ? `/api/templates/${editingTemplate.id}` : '/api/templates',
        {
          method: editingTemplate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Şablon kaydedilemedi')
      }

      setTemplates((prev) =>
        editingTemplate
          ? prev.map((item) => (item.id === data.template.id ? data.template : item))
          : [data.template, ...prev]
      )
      setTemplateModalOpen(false)
      setTemplateName('')
      setTemplateDescription('')
      setTemplateInstructions('')
      setTemplateExample('')
      setEditingTemplate(null)
      setSyncStatus({ type: 'success', text: 'Şablon kaydedildi.' })
    } catch (error: any) {
      console.error('Template save error:', error)
      setSyncStatus({ type: 'error', text: error.message || 'Şablon kaydedilemedi' })
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleGenerateTemplate = async () => {
    setTemplateGenerating(true)
    setSyncStatus(null)

    try {
      const sampleReview =
        templateTone === 'negative'
          ? 'Servis çok yavaştı ve siparişim beklentilerimi karşılamadı.'
          : templateTone === 'neutral'
          ? 'Deneyim fena değildi ama emin değilim tekrar gelir miyim.'
          : 'Harika bir hizmet aldım, tüm ekip çok ilgiliydi.'

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: sampleReview,
          language: templateLanguage,
          tone: settingsTone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'AI şablon üretemedi')
      }

      setTemplateInstructions(data.reply)
    } catch (error: any) {
      console.error('Template AI error:', error)
      setSyncStatus({ type: 'error', text: error.message || 'AI şablon üretemedi' })
    } finally {
      setTemplateGenerating(false)
    }
  }

  const handleCloseAiModal = () => {
    setAiModalOpen(false)
    setSelectedReview(null)
    setGeneratedReply('')
    setAiError(null)
  }

  const handleGenerateAiReply = async () => {
    if (!selectedReview?.text) {
      setAiError('Yorum metni bulunamadı.')
      return
    }

    setGeneratingAi(true)
    setAiError(null)
    setGeneratedReply('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: selectedReview.text,
          language: aiLanguage,
          tone: aiTone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'AI cevap üretilemedi')
      }

      setGeneratedReply(data.reply)
    } catch (error: any) {
      console.error('AI generation error:', error)
      setAiError(error.message || 'Bir hata oluştu')
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleCopyReply = () => {
    if (generatedReply) {
      navigator.clipboard.writeText(generatedReply)
      const originalText = generatedReply
      setGeneratedReply('✓ Kopyalandı!')
      setTimeout(() => setGeneratedReply(originalText), 1000)
    }
  }

  const formatDate = (value?: string | null) => {
    if (!value) return '-'
    try {
      return new Date(value).toLocaleDateString('tr-TR', { dateStyle: 'medium' })
    } catch {
      return value
    }
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-'
    try {
      return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return value
    }
  }

  const filteredReviews = reviews.filter((review) => {
    if (searchTerm && !review.text?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (ratingFilter !== 'all' && review.rating !== ratingFilter) {
      return false
    }
    if (replyFilter === 'replied' && !review.has_reply) {
      return false
    }
    if (replyFilter === 'unreplied' && review.has_reply) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (businesses.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">İşletme bulunamadı</h2>
          <p className="text-gray-600 mb-6">Başlamak için bir işletme eklemeniz gerekiyor.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            İşletme Ekle
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Genel Bakış', icon: '📊' },
    { id: 'reviews' as TabType, label: 'Yorumlar', icon: '⭐' },
    { id: 'templates' as TabType, label: 'Şablonlar', icon: '📝' },
    { id: 'analytics' as TabType, label: 'Analiz', icon: '📈' },
    { id: 'competitors' as TabType, label: competitorText.tabTitle, icon: '🎯' },
    { id: 'settings' as TabType, label: 'Ayarlar', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">ReplyMate</h1>
              {businesses.length > 1 && (
                <select
                  value={selectedBusiness || ''}
                  onChange={(e) => setSelectedBusiness(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/onboarding')}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + İşletme Ekle
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700">{profile?.full_name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Çıkış
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-4 flex gap-2 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {syncStatus && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              syncStatus.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : syncStatus.type === 'warning'
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {syncStatus.text}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && currentBusiness && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{currentBusiness.name}</h2>
              <p className="text-sm text-gray-600 mb-4">{currentBusiness.address}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Puan</p>
                  <p className="text-3xl font-bold text-gray-900">{currentBusiness.rating?.toFixed(1) || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Toplam Yorum</p>
                  <p className="text-3xl font-bold text-gray-900">{currentBusiness.total_reviews || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Cevaplanan</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {reviews.filter((r) => r.has_reply).length}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSyncReviews}
                  disabled={syncing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {syncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Senkronize ediliyor...
                    </>
                  ) : (
                    'Yorumları Senkronize Et'
                  )}
                </button>
                {!googleConnected && (
                  <button
                    onClick={handleConnectGoogle}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Google Hesabını Bağla
                  </button>
                )}
                <button
                  onClick={handleDeleteBusiness}
                  disabled={deleting}
                  className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 disabled:opacity-60"
                >
                  {deleting ? 'Siliniyor...' : 'İşletmeyi Sil'}
                </button>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Son Yorumlar</h3>
              {reviewsLoading ? (
                <p className="text-sm text-gray-500">Yorumlar yükleniyor...</p>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-gray-500">Henüz yorum yok. Yukarıdaki butonu kullanarak senkronize edin.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                          {review.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{review.author_name}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(review.review_created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{review.text}</p>
                      {!review.has_reply && (
                        <button
                          onClick={() => handleOpenAiModal(review)}
                          className="mt-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          AI Cevap Üret
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Yorumlar</h2>
              <button
                onClick={handleSyncReviews}
                disabled={syncing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {syncing ? 'Senkronize ediliyor...' : 'Yenile'}
              </button>
            </div>

            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Yorumlarda ara..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Puanlar</option>
                <option value="5">5 Yıldız</option>
                <option value="4">4 Yıldız</option>
                <option value="3">3 Yıldız</option>
                <option value="2">2 Yıldız</option>
                <option value="1">1 Yıldız</option>
              </select>
              <select
                value={replyFilter}
                onChange={(e) => setReplyFilter(e.target.value as 'all' | 'replied' | 'unreplied')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Yorumlar</option>
                <option value="unreplied">Cevaplanmamış</option>
                <option value="replied">Cevaplandı</option>
              </select>
            </div>

            {/* Reviews List */}
            {reviewsLoading ? (
              <p className="text-sm text-gray-500">Yorumlar yükleniyor...</p>
            ) : filteredReviews.length === 0 ? (
              <p className="text-sm text-gray-500">Yorum bulunamadı.</p>
            ) : (
              <div className="space-y-4">
                {filteredReviews.map((review) => (
                  <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                        {review.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{review.author_name}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span
                                    key={i}
                                    className={`text-lg ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">{formatDate(review.review_created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{review.text}</p>

                        {review.has_reply && review.reply_text && (
                          <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">İşletme Yanıtı</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{review.reply_text}</p>
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenAiModal(review)}
                          className="mt-3 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          AI Cevap Üret
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hazır Yanıt Şablonları</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pozitif/negatif yorumlar için sık kullandığınız cevapları kaydedin.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setTemplateName('')
                  setTemplateDescription('')
                  setTemplateTone('positive')
                  setTemplateLanguage('Türkçe')
                  setTemplateInstructions('')
                  setTemplateExample('')
                  setTemplateModalOpen(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Yeni Şablon
              </button>
            </div>

            {templatesLoading ? (
              <p className="text-sm text-gray-500">Şablonlar yükleniyor...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500">Henüz şablon yok. İlk şablonunuzu ekleyin.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500">
                          {template.language} • {template.tone_type}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingTemplate(template)
                            setTemplateName(template.name)
                            setTemplateDescription(template.description || '')
                            setTemplateTone(template.tone_type)
                            setTemplateLanguage(template.language)
                            setTemplateInstructions(template.instructions)
                            setTemplateExample(template.example_response || '')
                            setTemplateModalOpen(true)
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/templates/${template.id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              })
                              if (!response.ok) {
                                const data = await response.json()
                                throw new Error(data.error || 'Şablon silinemedi')
                              }
                              setTemplates((prev) => prev.filter((item) => item.id !== template.id))
                              setSyncStatus({ type: 'success', text: 'Şablon silindi.' })
                            } catch (error) {
                              console.error('Template delete error:', error)
                              setSyncStatus({ type: 'error', text: 'Şablon silinemedi' })
                            }
                          }}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-line">{template.instructions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && currentBusiness && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">İşletme Analizleri</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Yorumlarınızın detaylı analizi ve performans metrikleri
                  </p>
                </div>
                <div className="flex gap-2">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setAnalyticsTimeFilter(days as 7 | 30 | 90)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        analyticsTimeFilter === days
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Son {days} Gün
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Basic Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-1">Toplam Yorum</p>
                  <p className="text-3xl font-bold text-blue-900">{reviews.length}</p>
                  <p className="text-xs text-blue-600 mt-2">
                    Son {analyticsTimeFilter} günde{' '}
                    {
                      reviews.filter(
                        (r) =>
                          new Date(r.review_created_at) >
                          new Date(Date.now() - analyticsTimeFilter * 24 * 60 * 60 * 1000)
                      ).length
                    }{' '}
                    yeni
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">Ortalama Puan</p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {reviews.length > 0
                      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                      : '-'}
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">5 üzerinden</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-700 font-medium mb-1">Yanıt Oranı</p>
                  <p className="text-3xl font-bold text-green-900">
                    {reviews.length > 0
                      ? Math.round((reviews.filter((r) => r.has_reply).length / reviews.length) * 100)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {reviews.filter((r) => r.has_reply).length} / {reviews.length} cevaplandı
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium mb-1">Pozitif Oran</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {reviews.length > 0
                      ? Math.round((reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-purple-600 mt-2">4-5 yıldızlı yorumlar</p>
                </div>
              </div>
            </div>

            {/* 2. Star Rating Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Yıldız Dağılımı</h3>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length
                  const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-sm font-medium text-gray-700">{star}</span>
                        <span className="text-yellow-400">★</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            star === 5
                              ? 'bg-gradient-to-r from-green-500 to-green-600'
                              : star === 4
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                              : star === 3
                              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                              : star === 2
                              ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                              : 'bg-gradient-to-r from-red-500 to-red-600'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                          {count} yorum ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. Time-based Analysis */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Zaman Bazlı Analiz</h3>
              <div className="space-y-6">
                {/* Daily Review Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-4">Günlük Yorum Sayısı</p>
                  <div className="flex items-end justify-between gap-2 h-48">
                    {Array.from({ length: Math.min(analyticsTimeFilter, 30) }).map((_, index) => {
                      const daysAgo = Math.min(analyticsTimeFilter, 30) - index - 1
                      const targetDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
                      const dayReviews = reviews.filter((r) => {
                        const reviewDate = new Date(r.review_created_at)
                        return (
                          reviewDate.toDateString() === targetDate.toDateString() &&
                          reviewDate > new Date(Date.now() - analyticsTimeFilter * 24 * 60 * 60 * 1000)
                        )
                      })
                      const maxReviews = Math.max(
                        1,
                        ...Array.from({ length: Math.min(analyticsTimeFilter, 30) }).map((_, i) => {
                          const d = Math.min(analyticsTimeFilter, 30) - i - 1
                          const td = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
                          return reviews.filter((r) => {
                            const rd = new Date(r.review_created_at)
                            return (
                              rd.toDateString() === td.toDateString() &&
                              rd > new Date(Date.now() - analyticsTimeFilter * 24 * 60 * 60 * 1000)
                            )
                          }).length
                        })
                      )
                      const height = (dayReviews.length / maxReviews) * 100
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center group relative">
                          <div
                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-700 hover:to-blue-500"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <div className="absolute -top-8 hidden group-hover:flex items-center justify-center bg-gray-900 text-white text-xs px-2 py-1 rounded">
                            {dayReviews.length}
                          </div>
                          {index % Math.floor(Math.min(analyticsTimeFilter, 30) / 7) === 0 && (
                            <span className="text-[10px] text-gray-500 mt-1">
                              {targetDate.getDate()}/{targetDate.getMonth() + 1}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rating Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-4">Ortalama Puan Trendi</p>
                  <div className="relative h-32">
                    <div className="absolute inset-0 flex items-end justify-between gap-2">
                      {Array.from({ length: 10 }).map((_, index) => {
                        const weeksAgo = 10 - index - 1
                        const startDate = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000)
                        const endDate = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000)
                        const weekReviews = reviews.filter((r) => {
                          const reviewDate = new Date(r.review_created_at)
                          return reviewDate >= startDate && reviewDate < endDate
                        })
                        const avgRating =
                          weekReviews.length > 0
                            ? weekReviews.reduce((acc, r) => acc + r.rating, 0) / weekReviews.length
                            : 0
                        const height = (avgRating / 5) * 100
                        return (
                          <div key={index} className="flex-1 flex items-end justify-center">
                            <div
                              className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300 rounded-t"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="absolute left-0 top-0 text-xs text-gray-500">5.0</div>
                    <div className="absolute left-0 bottom-0 text-xs text-gray-500">0.0</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 4. Word Analysis */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Kelime Analizi</h3>
                <div className="space-y-6">
                  {/* Positive Words */}
                  <div>
                    <p className="text-sm font-semibold text-green-700 mb-3">Pozitif Yorumlarda Sık Kelimeler</p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const positiveReviews = reviews.filter((r) => r.rating >= 4 && r.text)
                        const words = positiveReviews
                          .flatMap((r) => r.text?.toLowerCase().split(/\s+/) || [])
                          .filter((word) => word.length > 3)
                        const wordCounts: Record<string, number> = {}
                        words.forEach((word) => {
                          wordCounts[word] = (wordCounts[word] || 0) + 1
                        })
                        return Object.entries(wordCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 10)
                          .map(([word, count]) => (
                            <span
                              key={word}
                              className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                              style={{
                                fontSize: `${Math.min(0.875 + count * 0.05, 1.2)}rem`,
                              }}
                            >
                              {word} ({count})
                            </span>
                          ))
                      })()}
                    </div>
                  </div>

                  {/* Negative Words */}
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-3">Negatif Yorumlarda Sık Kelimeler</p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const negativeReviews = reviews.filter((r) => r.rating <= 2 && r.text)
                        const words = negativeReviews
                          .flatMap((r) => r.text?.toLowerCase().split(/\s+/) || [])
                          .filter((word) => word.length > 3)
                        const wordCounts: Record<string, number> = {}
                        words.forEach((word) => {
                          wordCounts[word] = (wordCounts[word] || 0) + 1
                        })
                        return Object.entries(wordCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 10)
                          .map(([word, count]) => (
                            <span
                              key={word}
                              className="px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                              style={{
                                fontSize: `${Math.min(0.875 + count * 0.05, 1.2)}rem`,
                              }}
                            >
                              {word} ({count})
                            </span>
                          ))
                      })()}
                      {reviews.filter((r) => r.rating <= 2).length === 0 && (
                        <p className="text-sm text-gray-500">Negatif yorum bulunmuyor</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Response Performance */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Yanıt Performansı</h3>
                <div className="space-y-6">
                  {/* Reply Status */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-4">Yanıt Durumu</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-green-700 font-medium">Cevaplanan</p>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {reviews.filter((r) => r.has_reply).length}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <p className="text-sm text-red-700 font-medium">Cevaplanmamış</p>
                        <p className="text-2xl font-bold text-red-900 mt-1">
                          {reviews.filter((r) => !r.has_reply).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Average Response Time */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Ortalama Yanıt Süresi</p>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-3xl font-bold text-gray-900">
                        {(() => {
                          const repliedReviews = reviews.filter((r) => r.has_reply && r.replied_at)
                          if (repliedReviews.length === 0) return '-'
                          const avgDays =
                            repliedReviews.reduce((acc, r) => {
                              const reviewDate = new Date(r.review_created_at).getTime()
                              const replyDate = new Date(r.replied_at!).getTime()
                              return acc + (replyDate - reviewDate) / (1000 * 60 * 60 * 24)
                            }, 0) / repliedReviews.length
                          return avgDays < 1
                            ? `${Math.round(avgDays * 24)} saat`
                            : `${avgDays.toFixed(1)} gün`
                        })()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">İlk yanıt süresi</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Risky Reviews */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Dikkat Gereken Yorumlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-red-700 font-medium mb-1">Düşük Puanlı</p>
                  <p className="text-3xl font-bold text-red-900">
                    {reviews.filter((r) => r.rating <= 2).length}
                  </p>
                  <p className="text-xs text-red-600 mt-2">1-2 yıldızlı yorumlar</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-700 font-medium mb-1">Cevaplanmamış Negatif</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {reviews.filter((r) => r.rating <= 2 && !r.has_reply).length}
                  </p>
                  <p className="text-xs text-orange-600 mt-2">Acil yanıt gerekli</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">Son 7 Gün</p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {
                      reviews.filter(
                        (r) =>
                          r.rating <= 2 &&
                          new Date(r.review_created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length
                    }
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">Yeni düşük puanlı</p>
                </div>
              </div>

              {/* List of Risky Reviews */}
              {reviews.filter((r) => r.rating <= 2 && !r.has_reply).length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Cevaplanmamış Negatif Yorumlar (En Yeni)
                  </p>
                  <div className="space-y-3">
                    {reviews
                      .filter((r) => r.rating <= 2 && !r.has_reply)
                      .slice(0, 3)
                      .map((review) => (
                        <div
                          key={review.id}
                          className="border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-xs font-semibold text-red-700">
                                {review.author_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{review.author_name}</p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span
                                      key={i}
                                      className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(review.review_created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{review.text?.slice(0, 150)}...</p>
                          <button
                            onClick={() => {
                              setActiveTab('reviews')
                              handleOpenAiModal(review)
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Hemen Yanıtla →
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Harika! Tüm negatif yorumlar yanıtlanmış.</p>
                  <p className="text-xs text-gray-500 mt-1">Müşteri memnuniyetini koruduğunuz için tebrikler!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competitors Tab */}
        {activeTab === 'competitors' && currentBusiness && (
          <div className="space-y-6">
            {/* Metrics Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{competitorText.performanceTitle}</h2>
                  <p className="text-sm text-gray-500">{competitorText.performanceSubtitle}</p>
                </div>
                <button
                  onClick={() => {
                    if (!currentBusiness) return
                    setMetricsRefreshing(true)
                    loadCompetitorMetrics(currentBusiness.id)
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  disabled={metricsLoading || metricsRefreshing}
                >
                  {metricsRefreshing ? competitorText.refreshing : competitorText.refresh}
                </button>
              </div>

              {metricsLoading ? (
                <p className="text-sm text-gray-500">{competitorText.metricsLoading}</p>
              ) : metricsError ? (
                <p className="text-sm text-rose-500">{metricsError}</p>
              ) : competitorMetrics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const latestPoint = competitorMetrics.business.time_series.at(-1)
                      const ownRating = currentBusiness.rating ?? latestPoint?.avg_rating ?? 0
                      const topCompetitor = competitorMetrics.competitor_rankings[0]
                      const competitorRating = topCompetitor?.rating ?? 0
                      const reviewSum = competitorMetrics.business.time_series.reduce(
                        (sum, point) => sum + point.review_count,
                        0
                      )
                      const competitorReviewSum = competitorMetrics.competitor_series[0]?.data.reduce(
                        (sum, point) => sum + point.review_count,
                        0
                      )

                      return (
                        <>
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{competitorText.cards.avg}</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">
                              {ownRating ? ownRating.toFixed(2) : '—'}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Son veri: {latestPoint ? latestPoint.date : '—'}
                            </p>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{competitorText.cards.top}</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">
                              {topCompetitor ? topCompetitor.name : '—'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {topCompetitor?.rating
                                ? topCompetitor.rating.toFixed(2)
                                : competitorText.cards.noData}
                            </p>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{competitorText.cards.volume}</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{reviewSum}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {competitorText.cards.competitor}: {competitorReviewSum ?? 0}
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Line Chart */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{competitorText.chart.title}</p>
                        <p className="text-xs text-gray-500">{competitorText.chart.subtitle}</p>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          {competitorText.chart.legendYou}
                        </div>
                        {competitorMetrics.competitor_rankings[0] && (
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                            {`${competitorText.chart.legendCompetitor}: ${competitorMetrics.competitor_rankings[0]?.name ?? ''}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full overflow-x-auto">
                      <svg width={600} height={200} className="min-w-full">
                        <path
                          d={buildLinePath(competitorMetrics.business.time_series, 600, 180)}
                          stroke="url(#ownLineGradient)"
                          strokeWidth={3}
                          fill="none"
                        />
                        {competitorMetrics.competitor_series[0] && (
                          <path
                            d={buildLinePath(competitorMetrics.competitor_series[0]?.data || [], 600, 180)}
                            stroke="url(#competitorLineGradient)"
                            strokeWidth={3}
                            fill="none"
                          />
                        )}
                        <defs>
                          <linearGradient id="ownLineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#38bdf8" />
                          </linearGradient>
                          <linearGradient id="competitorLineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f43f5e" />
                            <stop offset="100%" stopColor="#fb7185" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>

                  {/* Ranking Table */}
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-3">{competitorText.rankingTitle}</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-2">{competitorText.rankingHeaders.competitor}</th>
                            <th className="py-2">{competitorText.rankingHeaders.rating}</th>
                            <th className="py-2">{competitorText.rankingHeaders.reviews}</th>
                            <th className="py-2">{competitorText.rankingHeaders.sync}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {competitorMetrics.competitor_rankings.map((item) => (
                            <tr key={item.id} className="border-t text-gray-800">
                              <td className="py-2 font-medium">{item.name}</td>
                              <td className="py-2">{item.rating?.toFixed(2) ?? '—'}</td>
                              <td className="py-2">{item.total_reviews}</td>
                              <td className="py-2 text-xs text-gray-500">
                                {item.last_sync_at
                                  ? new Date(item.last_sync_at).toLocaleDateString(competitorDateLocale)
                                  : '—'}
                              </td>
                          </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{competitorText.metricsEmpty}</p>
              )}
            </div>

            {/* Header with Add Competitor */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{competitorText.tabTitle}</h2>
                  <p className="text-sm text-gray-500 mt-1">{competitorText.tabDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(['tr', 'en', 'nl'] as const).map((locale) => (
                    <button
                      key={locale}
                      onClick={() => setCompetitorLocale(locale)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        competitorLocale === locale
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-600'
                      }`}
                    >
                      {locale === 'tr' ? 'TR' : locale === 'en' ? 'EN' : 'NL'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search and Add Competitor */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={competitorText.searchPlaceholder}
                    value={searchQuery}
                    onChange={async (e) => {
                      const query = e.target.value
                      setSearchQuery(query)

                      if (query.length >= 3) {
                        setSearching(true)
                        try {
                          const response = await fetch(`/api/competitors/search?query=${encodeURIComponent(query)}`)
                          const data = await response.json()
                          if (data.success) {
                            setSearchResults(data.results || [])
                          }
                        } catch (error) {
                          console.error('Search error:', error)
                        } finally {
                          setSearching(false)
                        }
                      } else {
                        setSearchResults([])
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searching && (
                    <div className="flex items-center">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.place_id}
                        className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{result.name}</h4>
                          <p className="text-sm text-gray-600">{result.address}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-400">★</span>
                              <span className="text-sm font-medium text-gray-700">
                                {result.rating?.toFixed(1) || 'N/A'}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {result.total_reviews} yorum
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setAddingCompetitor(true)
                            try {
                              const response = await fetch('/api/competitors', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  businessId: currentBusiness.id,
                                  placeId: result.place_id,
                                }),
                              })
                              const data = await response.json()
                              if (data.success) {
                                setCompetitors([...competitors, data.competitor])
                                setSearchQuery('')
                                setSearchResults([])
                                setSyncStatus({ type: 'success', text: 'Rakip başarıyla eklendi!' })
                                setTimeout(() => setSyncStatus(null), 3000)
                              } else {
                                setSyncStatus({ type: 'error', text: data.error || 'Rakip eklenemedi' })
                                setTimeout(() => setSyncStatus(null), 3000)
                              }
                            } catch (error) {
                              console.error('Add competitor error:', error)
                              setSyncStatus({ type: 'error', text: 'Bir hata oluştu' })
                              setTimeout(() => setSyncStatus(null), 3000)
                            } finally {
                              setAddingCompetitor(false)
                            }
                          }}
                          disabled={addingCompetitor}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {addingCompetitor ? competitorText.addButtonLoading : competitorText.addButton}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category Insights */}
            {categoryInsights && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{competitorText.categoriesTitle}</h3>
                    <p className="text-sm text-gray-500">{competitorText.categoriesSubtitle}</p>
                  </div>
                  {categoryLoading && <span className="text-xs text-gray-500">{competitorText.categoriesLoading}</span>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(CATEGORY_LABELS).map(([key, labels]) => {
                    const own = categoryInsights.own_categories[key as CategoryKey]
                    if (!own) return null
                    const competitor = categoryInsights.competitor_categories[0]?.categories[key as CategoryKey]

                    const ownTotal = own.positive + own.negative + own.neutral
                    const competitorTotal = competitor
                      ? competitor.positive + competitor.negative + competitor.neutral
                      : 0

                    if (ownTotal === 0 && competitorTotal === 0) {
                      return null
                    }

                    return (
                      <div key={key} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-gray-900">
                            {labels[competitorLocale as 'tr' | 'en' | 'nl']}
                          </p>
                          <p className="text-xs text-gray-500">
                            {ownTotal} {competitorText.categoryOwn} • {competitorTotal} {competitorText.categoryCompetitor}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-green-50 text-green-700">
                            <p className="font-semibold">{competitorText.categoryPositive}</p>
                            <p>
                              {competitorText.categoryOwn}: {own.positive}
                              {competitor ? ` / ${competitorText.categoryCompetitor}: ${competitor.positive}` : ''}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-red-50 text-red-700">
                            <p className="font-semibold">{competitorText.categoryNegative}</p>
                            <p>
                              {competitorText.categoryOwn}: {own.negative}
                              {competitor ? ` / ${competitorText.categoryCompetitor}: ${competitor.negative}` : ''}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                            <p className="font-semibold">{competitorText.categoryNeutral}</p>
                            <p>
                              {competitorText.categoryOwn}: {own.neutral}
                              {competitor ? ` / ${competitorText.categoryCompetitor}: ${competitor.neutral}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Competitors Comparison */}
            {competitors.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Karşılaştırmalı Analiz</h3>

                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">İşletme</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Puan</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Toplam Yorum</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Son Senkronizasyon</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Your Business */}
                      <tr className="border-b border-gray-100 bg-blue-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">SİZ</span>
                            <span className="font-semibold text-gray-900">{currentBusiness.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-yellow-400">★</span>
                            <span className="font-semibold text-gray-900">
                              {currentBusiness.rating?.toFixed(1) || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-semibold text-gray-900">
                          {currentBusiness.total_reviews}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-600">
                          {currentBusiness.last_sync_at
                            ? new Date(currentBusiness.last_sync_at).toLocaleDateString('tr-TR')
                            : 'Henüz yok'}
                        </td>
                        <td className="text-center py-3 px-4">-</td>
                      </tr>

                      {/* Competitors */}
                      {competitors.map((comp) => (
                        <tr key={comp.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{comp.competitor_name}</p>
                              {comp.address && (
                                <p className="text-xs text-gray-500 mt-1">{comp.address}</p>
                              )}
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-yellow-400">★</span>
                              <span className="font-medium text-gray-700">
                                {comp.rating?.toFixed(1) || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4 font-medium text-gray-700">
                            {comp.total_reviews}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-600">
                            {comp.last_sync_at
                              ? new Date(comp.last_sync_at).toLocaleDateString('tr-TR')
                              : 'Henüz yok'}
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={async () => {
                                  setSyncing(true)
                                  try {
                                    const response = await fetch(`/api/competitors/${comp.id}/sync`, {
                                      method: 'POST',
                                    })
                                    const data = await response.json()
                                    if (data.success) {
                                      const updatedCompetitors = competitors.map((c) =>
                                        c.id === comp.id
                                          ? { ...c, ...data.competitor }
                                          : c
                                      )
                                      setCompetitors(updatedCompetitors)
                                      setSyncStatus({ type: 'success', text: 'Rakip verileri güncellendi!' })
                                      setTimeout(() => setSyncStatus(null), 3000)
                                    }
                                  } catch (error) {
                                    console.error('Sync error:', error)
                                  } finally {
                                    setSyncing(false)
                                  }
                                }}
                                disabled={syncing}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                              >
                                Senkronize
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('Bu rakibi silmek istediğinizden emin misiniz?')) {
                                    try {
                                      const response = await fetch(`/api/competitors/${comp.id}`, {
                                        method: 'DELETE',
                                      })
                                      const data = await response.json()
                                      if (data.success) {
                                        setCompetitors(competitors.filter((c) => c.id !== comp.id))
                                        setSyncStatus({ type: 'success', text: 'Rakip silindi!' })
                                        setTimeout(() => setSyncStatus(null), 3000)
                                      }
                                    } catch (error) {
                                      console.error('Delete error:', error)
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual Comparison */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Rating Comparison */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Puan Karşılaştırması</h4>
                    <div className="space-y-3">
                      {[currentBusiness, ...competitors.map(c => ({
                        name: c.competitor_name,
                        rating: c.rating,
                        isYou: false
                      }))].map((item: any, index) => {
                        const rating = item.rating || 0
                        const percentage = (rating / 5) * 100
                        const isYou = index === 0
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {isYou ? `${item.name} (Siz)` : item.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">{rating.toFixed(1)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isYou ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Review Count Comparison */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Yorum Sayısı Karşılaştırması</h4>
                    <div className="space-y-3">
                      {[currentBusiness, ...competitors.map(c => ({
                        name: c.competitor_name,
                        total_reviews: c.total_reviews,
                        isYou: false
                      }))].map((item: any, index) => {
                        const maxReviews = Math.max(
                          currentBusiness.total_reviews,
                          ...competitors.map(c => c.total_reviews)
                        )
                        const percentage = maxReviews > 0 ? (item.total_reviews / maxReviews) * 100 : 0
                        const isYou = index === 0
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {isYou ? `${item.name} (Siz)` : item.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">{item.total_reviews}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isYou ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz rakip eklenmedi</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Rakiplerinizi ekleyerek performanslarını karşılaştırın
                </p>
                <p className="text-xs text-gray-400">
                  Yukarıdaki arama kutusunu kullanarak rakip işletme arayabilir ve ekleyebilirsiniz
                </p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && currentBusiness && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">İşletme Ayarları</h2>
                <p className="text-sm text-gray-500 mt-1">
                  AI cevaplarının dil ve tonu için varsayılan tercihleri belirleyin.
                </p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {settingsSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Varsayılan Yanıt Dili</label>
                <select
                  value={settingsLanguage}
                  onChange={(e) => setSettingsLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Varsayılan Ton</label>
                <select
                  value={settingsTone}
                  onChange={(e) => setSettingsTone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">AI İçin Ek Talimatlar</label>
                <textarea
                  value={settingsInstructions}
                  onChange={(e) => setSettingsInstructions(e.target.value)}
                  rows={4}
                  placeholder="Örn: Her cevapta randevu hattımızı paylaş."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Template Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? 'Şablonu Düzenle' : 'Yeni Şablon Oluştur'}
              </h3>
              <button
                onClick={() => setTemplateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şablon Adı</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şablon Tipi</label>
                  <select
                    value={templateTone}
                    onChange={(e) => setTemplateTone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="positive">Olumlu</option>
                    <option value="negative">Olumsuz</option>
                    <option value="neutral">Nötr</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dil</label>
                  <select
                    value={templateLanguage}
                    onChange={(e) => setTemplateLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Yanıt Metni</label>
                  <button
                    onClick={handleGenerateTemplate}
                    type="button"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    disabled={templateGenerating}
                  >
                    {templateGenerating ? 'AI çalışıyor...' : 'AI ile oluştur'}
                  </button>
                </div>
                <textarea
                  value={templateInstructions}
                  onChange={(e) => setTemplateInstructions(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Örnek Cevap (Opsiyonel)</label>
                <textarea
                  value={templateExample}
                  onChange={(e) => setTemplateExample(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setTemplateModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={templateSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {templateSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {aiModalOpen && selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">AI Cevap Üret</h3>
                <button onClick={handleCloseAiModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Original Review */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Müşteri Yorumu</label>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {selectedReview.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{selectedReview.author_name}</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            key={index}
                            className={`text-lg ${index < selectedReview.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selectedReview.text}</p>
                </div>
              </div>

              {/* Language & Tone Selectors */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Dil</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Türkçe', 'İngilizce', 'Felemenkçe'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setAiLanguage(lang)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        aiLanguage === lang
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ton</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Profesyonel', 'Samimi', 'Kısa', 'Detaylı'].map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setAiTone(tone)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        aiTone === tone
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateAiReply}
                disabled={generatingAi}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {generatingAi ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Üretiliyor...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Cevap Üret
                  </>
                )}
              </button>

              {/* Error */}
              {aiError && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {aiError}
                </div>
              )}

              {/* Generated Reply */}
              {generatedReply && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Üretilen Cevap</label>
                    <button
                      onClick={handleCopyReply}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Kopyala
                    </button>
                  </div>
                  <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-line">{generatedReply}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
