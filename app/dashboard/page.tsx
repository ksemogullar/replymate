"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import ReviewReplyForm from "@/components/dashboard/ReviewReplyForm";

interface Business {
  id: string;
  name: string;
  address: string;
  rating: number;
  total_reviews: number;
  place_id: string;
  last_sync_at?: string | null;
  default_language?: string | null;
  default_tone?: string | null;
  custom_instructions?: string | null;
}

interface Profile {
  full_name: string;
  email: string;
  onboarding_completed: boolean;
}

interface Review {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  google_review_id: string | null;
  business_id: string;
  review_created_at: string;
  has_reply: boolean;
  reply_text: string | null;
  replied_at: string | null;
}

interface Template {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  tone_type: string;
  language: string;
  instructions: string;
  example_response: string | null;
}

interface Competitor {
  id: string;
  business_id: string;
  competitor_place_id: string;
  competitor_name: string;
  address: string | null;
  rating: number | null;
  total_reviews: number;
  last_sync_at: string | null;
}

type CategoryKey =
  | "service"
  | "price"
  | "quality"
  | "staff"
  | "cleanliness"
  | "speed"
  | "other";

interface TimeSeriesPoint {
  date: string;
  review_count: number;
  avg_rating: number | null;
}

interface CompetitorSeries {
  id: string;
  name: string;
  data: TimeSeriesPoint[];
}

interface CompetitorMetrics {
  business: {
    id: string;
    name: string;
    time_series: TimeSeriesPoint[];
  };
  competitor_rankings: {
    id: string;
    name: string;
    rating: number | null;
    total_reviews: number;
    last_sync_at: string | null;
  }[];
  competitor_series: CompetitorSeries[];
}

interface CategorySummary {
  positive: number;
  negative: number;
  neutral: number;
}

type CategoryInsights = Record<CategoryKey, CategorySummary>;

interface CategoriesResponse {
  own_categories: CategoryInsights;
  competitor_categories: {
    id: string;
    name: string;
    categories: CategoryInsights;
  }[];
}

const buildLinePath = (
  points: TimeSeriesPoint[] = [],
  width: number,
  height: number
) => {
  if (!points || points.length === 0) {
    return "";
  }

  const maxValue = 5;
  const len = points.length;

  return points
    .map((point, index) => {
      const value = point.avg_rating ?? 0;
      const x = len === 1 ? width / 2 : (index / (len - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

const CATEGORY_LABELS: Record<
  CategoryKey,
  { tr: string; en: string; nl: string }
> = {
  service: { tr: "Hizmet", en: "Service", nl: "Service" },
  price: { tr: "Fiyat", en: "Price", nl: "Prijs" },
  quality: {
    tr: "Ürün/Kalite",
    en: "Product/Quality",
    nl: "Product/Kwaliteit",
  },
  staff: { tr: "Personel", en: "Staff", nl: "Personeel" },
  cleanliness: { tr: "Temizlik", en: "Cleanliness", nl: "Hygiëne" },
  speed: { tr: "Hız", en: "Speed", nl: "Snelheid" },
  other: { tr: "Diğer", en: "Other", nl: "Overig" },
};

// COMPETITOR_TEXTS removed - now using main translation system (t.competitors.*)

interface CompetitorReview {
  id: string;
  competitor_id: string;
  author_name: string;
  rating: number;
  text: string | null;
  review_created_at: string;
}

type TabType =
  | "overview"
  | "reviews"
  | "templates"
  | "analytics"
  | "competitors"
  | "settings";

export default function Dashboard() {
  const { t, locale } = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Business & Profile
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [replyFilter, setReplyFilter] = useState<
    "all" | "replied" | "unreplied"
  >("all");
  const [reviewSort, setReviewSort] = useState<
    "newest" | "oldest" | "highest" | "lowest" | "unreplied"
  >("newest");
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewsPerPage, setReviewsPerPage] = useState(10);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTone, setTemplateTone] = useState("positive");
  const [templateLanguage, setTemplateLanguage] = useState("Türkçe");
  const [templateInstructions, setTemplateInstructions] = useState("");
  const [templateExample, setTemplateExample] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateGenerating, setTemplateGenerating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Settings
  const [settingsLanguage, setSettingsLanguage] = useState("Türkçe");
  const [settingsTone, setSettingsTone] = useState("Profesyonel");
  const [settingsInstructions, setSettingsInstructions] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [aiLanguage, setAiLanguage] = useState("Türkçe");
  const [aiTone, setAiTone] = useState("Profesyonel");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatedReply, setGeneratedReply] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Analytics
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState<7 | 30 | 90>(
    30
  );

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);
  const [categoryInsights, setCategoryInsights] =
    useState<CategoriesResponse | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [competitorMetrics, setCompetitorMetrics] =
    useState<CompetitorMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [competitorReviews, setCompetitorReviews] = useState<
    CompetitorReview[]
  >([]);

  // Status
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const currentBusiness = businesses.find((b) => b.id === selectedBusiness);
  const dateLocale =
    locale === "tr" ? "tr-TR" : locale === "en" ? "en-US" : "nl-NL";

  const topCategoryHighlight = useMemo(() => {
    if (!categoryInsights) return null;

    let candidate: { key: CategoryKey; total: number } | null = null;
    (
      Object.entries(categoryInsights.own_categories) as [
        CategoryKey,
        CategorySummary,
      ][]
    ).forEach(([key, summary]) => {
      const total = summary.positive + summary.negative + summary.neutral;
      if (!candidate || total > candidate.total) {
        candidate = { key, total };
      }
    });

    if (!candidate || candidate.total === 0) return null;

    const labelSet = CATEGORY_LABELS[candidate.key];
    const label =
      locale === "tr"
        ? labelSet.tr
        : locale === "nl"
          ? labelSet.nl
          : labelSet.en;

    return { label, total: candidate.total };
  }, [categoryInsights, locale]);

  const loadReviews = useCallback(
    async (businessId: string) => {
      setReviewsLoading(true);
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("business_id", businessId)
          .order("review_created_at", { ascending: false });

        if (error) throw error;
        setReviews(data || []);
      } catch (error) {
        console.error("Reviews load error:", error);
        setSyncStatus({ type: "error", text: "Yorumlar yüklenemedi." });
      } finally {
        setReviewsLoading(false);
      }
    },
    [supabase]
  );

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch("/api/templates", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Şablonlar yüklenemedi");
      }

      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Templates load error:", error);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadCompetitors = useCallback(async (businessId: string) => {
    setCompetitorsLoading(true);
    try {
      const response = await fetch(`/api/competitors?businessId=${businessId}`);
      const data = await response.json();

      if (data.success) {
        setCompetitors(data.competitors || []);
      }
    } catch (error) {
      console.error("Competitors load error:", error);
    } finally {
      setCompetitorsLoading(false);
    }
  }, []);

  const loadCompetitorMetrics = useCallback(async (businessId: string) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch(
        `/api/competitors/metrics?businessId=${businessId}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Rakip metrikleri alınamadı");
      }

      setCompetitorMetrics({
        business: data.business,
        competitor_rankings: data.competitor_rankings,
        competitor_series: data.competitor_series,
      });
    } catch (error: any) {
      console.error("Competitor metrics error:", error);
      setMetricsError(error.message || "Metrikler alınamadı");
    } finally {
      setMetricsLoading(false);
      setMetricsRefreshing(false);
    }
  }, []);

  const loadCategoryInsights = useCallback(async (businessId: string) => {
    setCategoryLoading(true);
    try {
      const response = await fetch(
        `/api/competitors/categories?businessId=${businessId}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Kategori içgörüleri alınamadı");
      }

      setCategoryInsights(data);
    } catch (error) {
      console.error("Category insights error:", error);
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedBusiness && activeTab === "competitors") {
      loadCompetitors(selectedBusiness);
      loadCompetitorMetrics(selectedBusiness);
      loadCategoryInsights(selectedBusiness);
    }
  }, [
    selectedBusiness,
    activeTab,
    loadCompetitors,
    loadCompetitorMetrics,
    loadCategoryInsights,
  ]);

  const clearOAuthParams = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete("google");
    params.delete("google_error");
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      setGoogleConnected(true);
      setSyncStatus({
        type: "success",
        text: "Google hesabınız başarıyla bağlandı!",
      });
      clearOAuthParams();
    } else if (searchParams.get("google_error")) {
      setSyncStatus({
        type: "error",
        text: "Google bağlantısı başarısız oldu.",
      });
      clearOAuthParams();
    }
  }, [searchParams, clearOAuthParams]);

  useEffect(() => {
    if (selectedBusiness) {
      loadReviews(selectedBusiness);
    } else {
      setReviews([]);
    }
  }, [selectedBusiness, loadReviews]);

  useEffect(() => {
    if (!selectedBusiness) {
      setSettingsInstructions("");
      return;
    }

    const current = businesses.find(
      (business) => business.id === selectedBusiness
    );
    if (current) {
      setSettingsLanguage(current.default_language || "Türkçe");
      setSettingsTone(current.default_tone || "Profesyonel");
      setSettingsInstructions(current.custom_instructions || "");
    }
  }, [selectedBusiness, businesses]);

  useEffect(() => {
    setReviewPage(1);
  }, [searchTerm, ratingFilter, replyFilter, reviewSort, reviewsPerPage, reviews]);

  const loadData = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/auth/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      const { data: googleConnection, error: googleConnectionError } =
        await supabase
          .from("google_connections")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (googleConnectionError) {
        console.error("Google connection check failed:", googleConnectionError);
      }
      setGoogleConnected(!!googleConnection);

      const { data: businessesData } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (businessesData && businessesData.length > 0) {
        setBusinesses(businessesData);
        setSelectedBusiness((prev) => {
          if (prev && businessesData.some((business) => business.id === prev)) {
            return prev;
          }
          return businessesData[0].id;
        });
      } else {
        setBusinesses([]);
        setSelectedBusiness(null);

        if (profileData && !profileData.onboarding_completed) {
          router.push("/onboarding");
          return;
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleSyncReviews = async () => {
    if (!selectedBusiness) return;
    if (!googleConnected) {
      setSyncStatus({
        type: "warning",
        text: "Tam senkronizasyon için önce Google hesabınızı bağlamalısınız.",
      });
      return;
    }

    setSyncing(true);
    setSyncStatus(null);

    try {
      const response = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selectedBusiness }),
        credentials: "include",
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data.error || "Yorumlar senkronize edilemedi");
      }

      await loadReviews(selectedBusiness);

      if (data.business) {
        setBusinesses((prev) =>
          prev.map((business) =>
            business.id === data.business.id
              ? { ...business, ...data.business }
              : business
          )
        );
      }

      const statusType = data.usedPlacesAPI ? "warning" : "success";
      setSyncStatus({
        type: statusType,
        text: data.message || "Yorumlar senkronize edildi.",
      });
    } catch (error: any) {
      console.error("Sync error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "Yorumlar senkronize edilemedi",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGoogle = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/api/google/authorize";
  };

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setSyncStatus(null);
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "Google bağlantısı kaldırılırken bir hata oluştu"
        );
      }

      setGoogleConnected(false);
      setSyncStatus({
        type: "success",
        text: "Google bağlantısı kaldırıldı.",
      });
    } catch (error: any) {
      console.error("Google disconnect error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "Google bağlantısı kaldırılamadı.",
      });
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Bu işletmeyi ve tüm yorumlarını silmek istediğinizden emin misiniz?"
      );
      if (!confirmed) {
        return;
      }
    }

    setDeleting(true);
    setSyncStatus(null);

    try {
      const response = await fetch(`/api/business/${selectedBusiness}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "İşletme silinemedi");
      }

      await loadData();

      setSyncStatus({ type: "success", text: "İşletme silindi." });
    } catch (error: any) {
      console.error("Delete business error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "İşletme silinemedi",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenAiModal = (review: Review) => {
    setSelectedReview(review);
    setGeneratedReply("");
    setAiError(null);
    setAiModalOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedBusiness) return;
    setSettingsSaving(true);
    setSyncStatus(null);

    try {
      const response = await fetch(
        `/api/business/${selectedBusiness}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            default_language: settingsLanguage,
            default_tone: settingsTone,
            custom_instructions: settingsInstructions || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ayarlar kaydedilemedi");
      }

      if (data.business) {
        setBusinesses((prev) =>
          prev.map((business) =>
            business.id === data.business.id ? data.business : business
          )
        );
      }

      setSyncStatus({ type: "success", text: "İşletme ayarları kaydedildi." });
    } catch (error: any) {
      console.error("Settings save error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "Ayarlar kaydedilemedi",
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedBusiness) return;

    if (!templateName.trim() || !templateInstructions.trim()) {
      setSyncStatus({
        type: "error",
        text: "Şablon adı ve içerik zorunludur.",
      });
      return;
    }

    setTemplateSaving(true);
    setSyncStatus(null);

    try {
      const payload = {
        business_id: selectedBusiness,
        name: templateName.trim(),
        description: templateDescription.trim(),
        tone_type: templateTone,
        language: templateLanguage,
        instructions: templateInstructions.trim(),
        example_response: templateExample.trim() || null,
      };

      const response = await fetch(
        editingTemplate
          ? `/api/templates/${editingTemplate.id}`
          : "/api/templates",
        {
          method: editingTemplate ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Şablon kaydedilemedi");
      }

      setTemplates((prev) =>
        editingTemplate
          ? prev.map((item) =>
              item.id === data.template.id ? data.template : item
            )
          : [data.template, ...prev]
      );
      setTemplateModalOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateInstructions("");
      setTemplateExample("");
      setEditingTemplate(null);
      setSyncStatus({ type: "success", text: "Şablon kaydedildi." });
    } catch (error: any) {
      console.error("Template save error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "Şablon kaydedilemedi",
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleGenerateTemplate = async () => {
    setTemplateGenerating(true);
    setSyncStatus(null);

    try {
      const sampleReview =
        templateTone === "negative"
          ? "Servis çok yavaştı ve siparişim beklentilerimi karşılamadı."
          : templateTone === "neutral"
            ? "Deneyim fena değildi ama emin değilim tekrar gelir miyim."
            : "Harika bir hizmet aldım, tüm ekip çok ilgiliydi.";

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: sampleReview,
          language: templateLanguage,
          tone: settingsTone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI şablon üretemedi");
      }

      setTemplateInstructions(data.reply);
    } catch (error: any) {
      console.error("Template AI error:", error);
      setSyncStatus({
        type: "error",
        text: error.message || "AI şablon üretemedi",
      });
    } finally {
      setTemplateGenerating(false);
    }
  };

  const handleCloseAiModal = () => {
    setAiModalOpen(false);
    setSelectedReview(null);
    setGeneratedReply("");
    setAiError(null);
  };

  const handleGenerateAiReply = async () => {
    if (!selectedReview?.text) {
      setAiError("Yorum metni bulunamadı.");
      return;
    }
    if (!selectedReview?.id) {
      setAiError("Yorum bilgisi bulunamadı.");
      return;
    }

    setGeneratingAi(true);
    setAiError(null);
    setGeneratedReply("");

    try {
      const response = await fetch(
        `/api/reviews/${selectedReview.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            language: aiLanguage,
            tone: aiTone,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI cevap üretilemedi");
      }

      setGeneratedReply(data.reply);
    } catch (error: any) {
      console.error("AI generation error:", error);
      setAiError(error.message || "Bir hata oluştu");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleCopyReply = () => {
    if (generatedReply) {
      navigator.clipboard.writeText(generatedReply);
      const originalText = generatedReply;
      setGeneratedReply("✓ Kopyalandı!");
      setTimeout(() => setGeneratedReply(originalText), 1000);
    }
  };

  const handleSendReplyToGoogle = async () => {
    if (!selectedReview || !generatedReply || !selectedBusiness) {
      setAiError("Yanıt veya işletme bilgisi eksik");
      return;
    }

    setSendingReply(true);
    setAiError(null);
    setReplySuccess(false);

    try {
      const response = await fetch("/api/extension/post-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessId: selectedBusiness,
          reviewId: selectedReview.google_review_id,
          replyText: generatedReply,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Yanıt gönderilemedi");
      }

      // Başarılı - yorumu güncelle
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedReview.id
            ? {
                ...r,
                has_reply: true,
                reply_text: generatedReply,
                reply_author: "İşletme Sahibi",
                replied_at: data.replied_at || new Date().toISOString(),
              }
            : r
        )
      );

      setReplySuccess(true);

      // 2 saniye sonra modal'ı kapat
      setTimeout(() => {
        setAiModalOpen(false);
        setSelectedReview(null);
        setGeneratedReply("");
        setReplySuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error("Send reply error:", error);
      setAiError(error.message || "Yanıt gönderilirken bir hata oluştu");
    } finally {
      setSendingReply(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("tr-TR", {
        dateStyle: "medium",
      });
    } catch {
      return value;
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      if (
        searchTerm &&
        !review.text?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (ratingFilter !== "all" && review.rating !== ratingFilter) {
        return false;
      }
      if (replyFilter === "replied" && !review.has_reply) {
        return false;
      }
      if (replyFilter === "unreplied" && review.has_reply) {
        return false;
      }
      return true;
    });
  }, [reviews, searchTerm, ratingFilter, replyFilter]);

  const sortedReviews = useMemo(() => {
    const sorted = [...filteredReviews];
    switch (reviewSort) {
      case "oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.review_created_at).getTime() -
            new Date(b.review_created_at).getTime()
        );
        break;
      case "highest":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case "unreplied":
        sorted.sort((a, b) => Number(a.has_reply) - Number(b.has_reply));
        break;
      case "newest":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.review_created_at).getTime() -
            new Date(a.review_created_at).getTime()
        );
        break;
    }
    return sorted;
  }, [filteredReviews, reviewSort]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedReviews.length / reviewsPerPage) || 1
  );
  const currentReviewPage = Math.min(reviewPage, totalPages);

  const paginatedReviews = useMemo(() => {
    const start = (currentReviewPage - 1) * reviewsPerPage;
    return sortedReviews.slice(start, start + reviewsPerPage);
  }, [sortedReviews, currentReviewPage, reviewsPerPage]);

  const respondedCount = useMemo(
    () => reviews.filter((review) => review.has_reply).length,
    [reviews]
  );

  const pendingReplies = useMemo(
    () => reviews.filter((review) => !review.has_reply).length,
    [reviews]
  );

  const newReviewsLast7Days = useMemo(() => {
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return reviews.filter(
      (review) => new Date(review.review_created_at).getTime() > threshold
    ).length;
  }, [reviews]);

  const lowRatedPendingReviews = useMemo(
    () =>
      reviews
        .filter((review) => !review.has_reply && review.rating <= 2)
        .sort(
          (a, b) =>
            new Date(b.review_created_at).getTime() -
            new Date(a.review_created_at).getTime()
        ),
    [reviews]
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return currentBusiness?.rating ?? null;
    }
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews, currentBusiness]);

  const responseRate =
    reviews.length > 0 ? Math.round((respondedCount / reviews.length) * 100) : 0;

  const totalReviewCountDisplay =
    currentBusiness?.total_reviews || reviews.length;

  const averageRatingDisplay =
    typeof averageRating === "number"
      ? averageRating.toFixed(1)
      : currentBusiness?.rating?.toFixed(1) || "-";

  const totalFilteredReviews = sortedReviews.length;
  const paginationStart =
    totalFilteredReviews === 0
      ? 0
      : (currentReviewPage - 1) * reviewsPerPage + 1;
  const paginationEnd =
    totalFilteredReviews === 0
      ? 0
      : Math.min(currentReviewPage * reviewsPerPage, totalFilteredReviews);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t.dashboard.noBusiness}
          </h2>
          <p className="text-gray-600 mb-6">{t.onboarding.description}</p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            {t.dashboard.addBusiness}
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as TabType, label: t.nav.dashboard, icon: "📊" },
    { id: "reviews" as TabType, label: t.nav.reviews, icon: "⭐" },
    { id: "templates" as TabType, label: t.nav.templates, icon: "📝" },
    { id: "analytics" as TabType, label: t.nav.analytics, icon: "📈" },
    { id: "competitors" as TabType, label: t.nav.competitors, icon: "🎯" },
    { id: "settings" as TabType, label: t.nav.settings, icon: "⚙️" },
  ];

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
                  value={selectedBusiness || ""}
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
              <LanguageSwitcher />
              <button
                onClick={() => router.push("/onboarding")}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + {t.dashboard.addBusiness}
              </button>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {profile?.full_name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                {t.auth.logout}
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
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
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
              syncStatus.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : syncStatus.type === "warning"
                  ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                  : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {syncStatus.text}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && currentBusiness && (
          <div className="space-y-6">
            <section className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 rounded-2xl shadow-lg text-white p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-200">
                    {t.analytics.overview}
                  </p>
                  <h2 className="text-3xl font-bold mt-2">
                    {currentBusiness.name}
                  </h2>
                  <p className="text-sm text-blue-100 mt-1">
                    {currentBusiness.address}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
                    <span className="flex items-center gap-2 text-blue-100">
                      <span>🕒</span>
                      {currentBusiness.last_sync_at
                        ? `Son senkron: ${formatDateTime(currentBusiness.last_sync_at)}`
                        : t.dashboard.noSyncYet}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        googleConnected
                          ? "bg-white/20 text-white"
                          : "bg-amber-200 text-amber-900"
                      }`}
                    >
                      {googleConnected
                        ? "Google bağlı"
                        : "Google bağlantısı yok"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSyncReviews}
                    disabled={syncing || !googleConnected}
                    className="px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-semibold shadow hover:bg-blue-50 disabled:opacity-60 flex items-center gap-2"
                  >
                    {syncing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        {t.dashboard.syncing}
                      </>
                    ) : (
                      <>
                        <span>⟳</span>
                        {t.dashboard.syncReviews}
                      </>
                    )}
                  </button>
                  {googleConnected ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={disconnectingGoogle}
                      className="px-4 py-2 bg-white/10 text-white border border-white/40 rounded-lg text-sm font-medium hover:bg-white/20 disabled:opacity-60"
                    >
                      {disconnectingGoogle ? "Kaldırılıyor..." : "Google bağlantısını kaldır"}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      className="px-4 py-2 bg-white/10 text-white border border-white/40 rounded-lg text-sm font-medium hover:bg-white/20"
                    >
                      Google Hesabını Bağla
                    </button>
                  )}
                  <button
                    onClick={handleDeleteBusiness}
                    disabled={deleting}
                    className="px-4 py-2 border border-white/30 text-white/90 rounded-lg text-sm font-medium hover:bg-white/10 disabled:opacity-60"
                  >
                    {deleting ? "Siliniyor..." : "İşletmeyi Sil"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-100">
                    {t.dashboard.totalReviews}
                  </p>
                  <p className="text-2xl font-semibold mt-2">
                    {totalReviewCountDisplay || 0}
                  </p>
                  <p className="text-xs text-blue-100 mt-1">
                    Güncel toplam yorum
                  </p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-100">
                    {t.dashboard.averageRating}
                  </p>
                  <p className="text-2xl font-semibold mt-2">
                    {averageRatingDisplay}
                  </p>
                  <p className="text-xs text-blue-100 mt-1">5 üzerinden</p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-100">
                    {t.analytics.responseRate}
                  </p>
                  <p className="text-2xl font-semibold mt-2">{responseRate}%</p>
                  <p className="text-xs text-blue-100 mt-1">
                    {respondedCount} / {reviews.length || 0} yanıtlandı
                  </p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-100">
                    Son 7 günde yeni yorum
                  </p>
                  <p className="text-2xl font-semibold mt-2">
                    {newReviewsLast7Days}
                  </p>
                  <p className="text-xs text-blue-100 mt-1">
                    Anlık takibi sürdür
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide">
                        Yanıt performansı
                      </p>
                      <h3 className="text-3xl font-bold text-gray-900 mt-1">
                        {responseRate}%
                      </h3>
                      <p className="text-sm text-gray-500">
                        {respondedCount} / {reviews.length || 0}{" "}
                        {t.analytics.responded.toLowerCase()}
                      </p>
                    </div>
                    <div className="w-full md:w-1/2">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-green-500 rounded-full transition-all"
                          style={{ width: `${responseRate}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Hedefinize ulaşmak için yanıt oranınızı %90 üstünde tutun.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="border border-gray-100 rounded-xl p-4">
                      <p className="text-sm text-gray-500">
                        {t.dashboard.pendingReplies}
                      </p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">
                        {pendingReplies}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Yanıt bekleyen yorum
                      </p>
                    </div>
                    <div className="border border-gray-100 rounded-xl p-4">
                      <p className="text-sm text-gray-500">
                        Kritik yanıt kuyruğu
                      </p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">
                        {lowRatedPendingReviews.length}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        1-2 ⭐ ve yanıtsız
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {t.dashboard.recentReviews}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Son senkronize edilen yorumlar
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("reviews")}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Tüm yorumları görüntüle →
                    </button>
                  </div>
                  {reviewsLoading ? (
                    <p className="text-sm text-gray-500">{t.common.loading}</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {t.dashboard.noReviews}
                    </p>
                  ) : (
                    <div className="space-y-4 mt-4">
                      {reviews.slice(0, 5).map((review) => (
                        <div
                          key={review.id}
                          className="border border-gray-100 rounded-xl p-4"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                              {review.author_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {review.author_name}
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span
                                      key={i}
                                      className={
                                        i < review.rating
                                          ? "text-yellow-400"
                                          : "text-gray-300"
                                      }
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatDate(review.review_created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700">
                            {review.text || "Metin bulunmuyor."}
                          </p>
                          {!review.has_reply && (
                            <button
                              onClick={() => handleOpenAiModal(review)}
                              className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                              {t.reviews.aiGenerateReply}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Kritik yanıt kuyruğu
                      </h3>
                      <p className="text-sm text-gray-500">
                        1-2 yıldızlı ve yanıtsız yorumlar
                      </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600">
                      {lowRatedPendingReviews.length}
                    </span>
                  </div>
                  {lowRatedPendingReviews.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {t.analytics.allNegativeReplied}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {lowRatedPendingReviews.slice(0, 4).map((review) => (
                        <div
                          key={review.id}
                          className="border border-rose-100 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {review.author_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(review.review_created_at)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-rose-600">
                              {review.rating} ★
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {review.text || "Metin bulunamadı."}
                          </p>
                          <button
                            onClick={() => handleOpenAiModal(review)}
                            className="mt-3 text-xs font-medium text-rose-600 hover:text-rose-700"
                          >
                            Hemen yanıtla →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Hızlı aksiyonlar
                  </h3>
                  <p className="text-sm text-gray-500">
                    Günlük işlerini kolaylaştıran kısa yollar
                  </p>
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => setActiveTab("templates")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-left hover:border-blue-300 hover:text-blue-700"
                    >
                      ✍️ Yeni şablon oluştur
                    </button>
                    <button
                      onClick={() => setActiveTab("analytics")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-left hover:border-blue-300 hover:text-blue-700"
                    >
                      📈 Analitikleri görüntüle
                    </button>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-left hover:border-blue-300 hover:text-blue-700"
                    >
                      ⚙️ İşletme ayarlarını düzenle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border-2 border-gray-200 p-6 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-blue-600">
                  {t.reviews.title}
                </p>
                <h2 className="text-3xl font-black text-gray-900 mt-1">
                  {currentBusiness?.name} yorumları
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                    {totalFilteredReviews} yorum
                  </span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-bold">
                    {pendingReplies} yanıt bekleyen
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSyncReviews}
                  disabled={syncing}
                  className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t.dashboard.syncing}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t.reviews.refresh}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.reviews.searchPlaceholder}
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                  />
                </div>
                <select
                  value={ratingFilter}
                  onChange={(e) =>
                    setRatingFilter(
                      e.target.value === "all" ? "all" : Number(e.target.value)
                    )
                  }
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                >
                  <option value="all">{t.reviews.allRatings}</option>
                  <option value="5">⭐ 5 {t.reviews.starRating}</option>
                  <option value="4">⭐ 4 {t.reviews.starRating}</option>
                  <option value="3">⭐ 3 {t.reviews.starRating}</option>
                  <option value="2">⭐ 2 {t.reviews.starRating}</option>
                  <option value="1">⭐ 1 {t.reviews.starRating}</option>
                </select>
                <select
                  value={replyFilter}
                  onChange={(e) =>
                    setReplyFilter(
                      e.target.value as "all" | "replied" | "unreplied"
                    )
                  }
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                >
                  <option value="all">{t.reviews.allReviews}</option>
                  <option value="unreplied">⏱️ {t.reviews.unreplied}</option>
                  <option value="replied">✅ {t.reviews.replied}</option>
                </select>
                <select
                  value={reviewSort}
                  onChange={(e) =>
                    setReviewSort(
                      e.target.value as
                        | "newest"
                        | "oldest"
                        | "highest"
                        | "lowest"
                        | "unreplied"
                    )
                  }
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                >
                  <option value="newest">🕐 En yeni</option>
                  <option value="oldest">🕑 En eski</option>
                  <option value="highest">📈 Puan (yüksek → düşük)</option>
                  <option value="lowest">📉 Puan (düşük → yüksek)</option>
                  <option value="unreplied">⚠️ Yanıtsızlar üstte</option>
                </select>
                <select
                  value={reviewsPerPage}
                  onChange={(e) => setReviewsPerPage(Number(e.target.value))}
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      📄 Sayfa başına {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
              <p>
                Gösterilen {paginationStart}-{paginationEnd} /{" "}
                {totalFilteredReviews} yorum
              </p>
              <p>
                {pendingReplies} yorum yanıt bekliyor, {lowRatedPendingReviews.length}{" "}
                kritik
              </p>
            </div>

            {/* Reviews List */}
            {reviewsLoading ? (
              <p className="text-sm text-gray-500">{t.common.loading}</p>
            ) : totalFilteredReviews === 0 ? (
              <p className="text-sm text-gray-500">
                {t.reviews.noReviewsFound}
              </p>
            ) : (
              <div className="space-y-4">
                {paginatedReviews.map((review) => (
                  <ReviewReplyForm key={review.id} initialReview={review} />
                ))}
              </div>
            )}

            {totalFilteredReviews > 0 && (
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Sayfa {currentReviewPage} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setReviewPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentReviewPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Önceki
                  </button>
                  <button
                    onClick={() =>
                      setReviewPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentReviewPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sonraki →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === "templates" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t.templates.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t.templates.description}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateName("");
                  setTemplateDescription("");
                  setTemplateTone("positive");
                  setTemplateLanguage("Türkçe");
                  setTemplateInstructions("");
                  setTemplateExample("");
                  setTemplateModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + {t.templates.newTemplate}
              </button>
            </div>

            {templatesLoading ? (
              <p className="text-sm text-gray-500">{t.common.loading}</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500">{t.templates.noTemplates}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {template.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {template.language} • {template.tone_type}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setTemplateName(template.name);
                            setTemplateDescription(template.description || "");
                            setTemplateTone(template.tone_type);
                            setTemplateLanguage(template.language);
                            setTemplateInstructions(template.instructions);
                            setTemplateExample(template.example_response || "");
                            setTemplateModalOpen(true);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          {t.common.edit}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(
                                `/api/templates/${template.id}`,
                                {
                                  method: "DELETE",
                                  credentials: "include",
                                }
                              );
                              if (!response.ok) {
                                const data = await response.json();
                                throw new Error(
                                  data.error || t.templates.templateDeleteError
                                );
                              }
                              setTemplates((prev) =>
                                prev.filter((item) => item.id !== template.id)
                              );
                              setSyncStatus({
                                type: "success",
                                text: t.templates.templateDeleted,
                              });
                            } catch (error) {
                              console.error("Template delete error:", error);
                              setSyncStatus({
                                type: "error",
                                text: t.templates.templateDeleteError,
                              });
                            }
                          }}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        >
                          {t.common.delete}
                        </button>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {template.instructions}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && currentBusiness && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {t.analytics.businessAnalytics}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {t.analytics.detailedAnalysisDescription}
                  </p>
                </div>
                <div className="flex gap-2">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() =>
                        setAnalyticsTimeFilter(days as 7 | 30 | 90)
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        analyticsTimeFilter === days
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t.analytics.lastNDays.replace("{days}", days.toString())}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Basic Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-1">
                    {t.analytics.totalReviewsCount}
                  </p>
                  <p className="text-3xl font-bold text-blue-900">
                    {reviews.length}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    {t.analytics.lastNDays.replace(
                      "{days}",
                      analyticsTimeFilter.toString()
                    )}{" "}
                    {
                      reviews.filter(
                        (r) =>
                          new Date(r.review_created_at) >
                          new Date(
                            Date.now() -
                              analyticsTimeFilter * 24 * 60 * 60 * 1000
                          )
                      ).length
                    }{" "}
                    {t.analytics.newReviews}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">
                    {t.dashboard.averageRating}
                  </p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {reviews.length > 0
                      ? (
                          reviews.reduce((acc, r) => acc + r.rating, 0) /
                          reviews.length
                        ).toFixed(1)
                      : "-"}
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">5 üzerinden</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-700 font-medium mb-1">
                    {t.analytics.responseRate}
                  </p>
                  <p className="text-3xl font-bold text-green-900">
                    {reviews.length > 0
                      ? Math.round(
                          (reviews.filter((r) => r.has_reply).length /
                            reviews.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {reviews.filter((r) => r.has_reply).length} /{" "}
                    {reviews.length} {t.analytics.responded.toLowerCase()}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium mb-1">
                    {t.analytics.positiveRate}
                  </p>
                  <p className="text-3xl font-bold text-purple-900">
                    {reviews.length > 0
                      ? Math.round(
                          (reviews.filter((r) => r.rating >= 4).length /
                            reviews.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-purple-600 mt-2">
                    4-5 yıldızlı yorumlar
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Star Rating Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                {t.analytics.starDistribution}
              </h3>
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length;
                  const percentage =
                    reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-sm font-medium text-gray-700">
                          {star}
                        </span>
                        <span className="text-yellow-400">★</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            star === 5
                              ? "bg-gradient-to-r from-green-500 to-green-600"
                              : star === 4
                                ? "bg-gradient-to-r from-blue-500 to-blue-600"
                                : star === 3
                                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                                  : star === 2
                                    ? "bg-gradient-to-r from-orange-500 to-orange-600"
                                    : "bg-gradient-to-r from-red-500 to-red-600"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                          {count} yorum ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Time-based Analysis */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                {t.analytics.timeBasedAnalysis}
              </h3>
              <div className="space-y-6">
                {/* Daily Review Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-4">
                    {t.analytics.dailyReviewTrend}
                  </p>
                  <div className="flex items-end justify-between gap-2 h-48">
                    {Array.from({
                      length: Math.min(analyticsTimeFilter, 30),
                    }).map((_, index) => {
                      const daysAgo =
                        Math.min(analyticsTimeFilter, 30) - index - 1;
                      const targetDate = new Date(
                        Date.now() - daysAgo * 24 * 60 * 60 * 1000
                      );
                      const dayReviews = reviews.filter((r) => {
                        const reviewDate = new Date(r.review_created_at);
                        return (
                          reviewDate.toDateString() ===
                            targetDate.toDateString() &&
                          reviewDate >
                            new Date(
                              Date.now() -
                                analyticsTimeFilter * 24 * 60 * 60 * 1000
                            )
                        );
                      });
                      const maxReviews = Math.max(
                        1,
                        ...Array.from({
                          length: Math.min(analyticsTimeFilter, 30),
                        }).map((_, i) => {
                          const d = Math.min(analyticsTimeFilter, 30) - i - 1;
                          const td = new Date(
                            Date.now() - d * 24 * 60 * 60 * 1000
                          );
                          return reviews.filter((r) => {
                            const rd = new Date(r.review_created_at);
                            return (
                              rd.toDateString() === td.toDateString() &&
                              rd >
                                new Date(
                                  Date.now() -
                                    analyticsTimeFilter * 24 * 60 * 60 * 1000
                                )
                            );
                          }).length;
                        })
                      );
                      const height = (dayReviews.length / maxReviews) * 100;
                      return (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center group relative"
                        >
                          <div
                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-700 hover:to-blue-500"
                            style={{ height: `${Math.max(height, 4)}%` }}
                          />
                          <div className="absolute -top-8 hidden group-hover:flex items-center justify-center bg-gray-900 text-white text-xs px-2 py-1 rounded">
                            {dayReviews.length}
                          </div>
                          {index %
                            Math.floor(
                              Math.min(analyticsTimeFilter, 30) / 7
                            ) ===
                            0 && (
                            <span className="text-[10px] text-gray-500 mt-1">
                              {targetDate.getDate()}/{targetDate.getMonth() + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rating Trend */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-4">
                    {t.analytics.averageRatingTrend}
                  </p>
                  <div className="relative h-32">
                    <div className="absolute inset-0 flex items-end justify-between gap-2">
                      {Array.from({ length: 10 }).map((_, index) => {
                        const weeksAgo = 10 - index - 1;
                        const startDate = new Date(
                          Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000
                        );
                        const endDate = new Date(
                          Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000
                        );
                        const weekReviews = reviews.filter((r) => {
                          const reviewDate = new Date(r.review_created_at);
                          return (
                            reviewDate >= startDate && reviewDate < endDate
                          );
                        });
                        const avgRating =
                          weekReviews.length > 0
                            ? weekReviews.reduce(
                                (acc, r) => acc + r.rating,
                                0
                              ) / weekReviews.length
                            : 0;
                        const height = (avgRating / 5) * 100;
                        return (
                          <div
                            key={index}
                            className="flex-1 flex items-end justify-center"
                          >
                            <div
                              className="w-full bg-gradient-to-t from-yellow-500 to-yellow-300 rounded-t"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute left-0 top-0 text-xs text-gray-500">
                      5.0
                    </div>
                    <div className="absolute left-0 bottom-0 text-xs text-gray-500">
                      0.0
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 4. Word Analysis */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  {t.analytics.wordAnalysis}
                </h3>
                <div className="space-y-6">
                  {/* Positive Words */}
                  <div>
                    <p className="text-sm font-semibold text-green-700 mb-3">
                      {t.analytics.positiveKeywords}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const positiveReviews = reviews.filter(
                          (r) => r.rating >= 4 && r.text
                        );
                        const words = positiveReviews
                          .flatMap(
                            (r) => r.text?.toLowerCase().split(/\s+/) || []
                          )
                          .filter((word) => word.length > 3);
                        const wordCounts: Record<string, number> = {};
                        words.forEach((word) => {
                          wordCounts[word] = (wordCounts[word] || 0) + 1;
                        });
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
                          ));
                      })()}
                    </div>
                  </div>

                  {/* Negative Words */}
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-3">
                      {t.analytics.negativeKeywords}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const negativeReviews = reviews.filter(
                          (r) => r.rating <= 2 && r.text
                        );
                        const words = negativeReviews
                          .flatMap(
                            (r) => r.text?.toLowerCase().split(/\s+/) || []
                          )
                          .filter((word) => word.length > 3);
                        const wordCounts: Record<string, number> = {};
                        words.forEach((word) => {
                          wordCounts[word] = (wordCounts[word] || 0) + 1;
                        });
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
                          ));
                      })()}
                      {reviews.filter((r) => r.rating <= 2).length === 0 && (
                        <p className="text-sm text-gray-500">
                          {t.analytics.noNegativeReviews}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Response Performance */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  {t.analytics.responsePerformance}
                </h3>
                <div className="space-y-6">
                  {/* Reply Status */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-4">
                      {t.analytics.replyStatus}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-green-700 font-medium">
                          {t.analytics.responded}
                        </p>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {reviews.filter((r) => r.has_reply).length}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <p className="text-sm text-red-700 font-medium">
                          {t.analytics.notResponded}
                        </p>
                        <p className="text-2xl font-bold text-red-900 mt-1">
                          {reviews.filter((r) => !r.has_reply).length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Average Response Time */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {t.analytics.averageResponseTime}
                    </p>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-3xl font-bold text-gray-900">
                        {(() => {
                          const repliedReviews = reviews.filter(
                            (r) => r.has_reply && r.replied_at
                          );
                          if (repliedReviews.length === 0) return "-";
                          const avgDays =
                            repliedReviews.reduce((acc, r) => {
                              const reviewDate = new Date(
                                r.review_created_at
                              ).getTime();
                              const replyDate = new Date(
                                r.replied_at!
                              ).getTime();
                              return (
                                acc +
                                (replyDate - reviewDate) / (1000 * 60 * 60 * 24)
                              );
                            }, 0) / repliedReviews.length;
                          return avgDays < 1
                            ? `${Math.round(avgDays * 24)} ${t.analytics.hours}`
                            : `${avgDays.toFixed(1)} ${t.analytics.days}`;
                        })()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {t.analytics.firstResponseTime}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Risky Reviews */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                {t.analytics.riskyReviews}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-red-700 font-medium mb-1">
                    {t.analytics.lowRated}
                  </p>
                  <p className="text-3xl font-bold text-red-900">
                    {reviews.filter((r) => r.rating <= 2).length}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    {t.analytics.oneToTwoStarReviews}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-700 font-medium mb-1">
                    {t.analytics.unrepliedNegative}
                  </p>
                  <p className="text-3xl font-bold text-orange-900">
                    {
                      reviews.filter((r) => r.rating <= 2 && !r.has_reply)
                        .length
                    }
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    {t.analytics.urgentResponseNeeded}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">
                    {t.analytics.last7Days}
                  </p>
                  <p className="text-3xl font-bold text-yellow-900">
                    {
                      reviews.filter(
                        (r) =>
                          r.rating <= 2 &&
                          new Date(r.review_created_at) >
                            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length
                    }
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    {t.analytics.newLowRated}
                  </p>
                </div>
              </div>

              {/* List of Risky Reviews */}
              {reviews.filter((r) => r.rating <= 2 && !r.has_reply).length >
              0 ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {t.analytics.unrepliedNegativeReviews}
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
                                <p className="font-medium text-gray-900 text-sm">
                                  {review.author_name}
                                </p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span
                                      key={i}
                                      className={`text-sm ${i < review.rating ? "text-yellow-400" : "text-gray-300"}`}
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDate(review.review_created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {review.text?.slice(0, 150)}...
                          </p>
                          <button
                            onClick={() => {
                              setActiveTab("reviews");
                              handleOpenAiModal(review);
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            {t.analytics.replyNow}
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
                  <p className="text-sm font-medium text-gray-700">
                    {t.analytics.allNegativeReplied}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t.analytics.congratsForSatisfaction}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competitors Tab */}
        {activeTab === "competitors" && currentBusiness && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {t.competitors.performanceTitle}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t.competitors.performanceSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!currentBusiness) return;
                      setMetricsRefreshing(true);
                      loadCompetitorMetrics(currentBusiness.id);
                    }}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    disabled={metricsLoading || metricsRefreshing}
                  >
                    {metricsRefreshing
                      ? t.competitors.refreshing
                      : t.competitors.refresh}
                  </button>
                </div>
                {metricsLoading ? (
                  <p className="text-sm text-gray-500">
                    {t.competitors.metricsLoading}
                  </p>
                ) : metricsError ? (
                  <p className="text-sm text-rose-500">{metricsError}</p>
                ) : competitorMetrics ? (
                  (() => {
                    const latestPoint =
                      competitorMetrics.business.time_series.at(-1);
                    const ownRating =
                      currentBusiness.rating ?? latestPoint?.avg_rating ?? 0;
                    const topCompetitor =
                      competitorMetrics.competitor_rankings[0];
                    const competitorRating = topCompetitor?.rating ?? 0;
                    const reviewSum =
                      competitorMetrics.business.time_series.reduce(
                        (sum, point) => sum + point.review_count,
                        0
                      );
                    const competitorReviewSum =
                      competitorMetrics.competitor_series[0]?.data.reduce(
                        (sum, point) => sum + point.review_count,
                        0
                      );

                    return (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="p-4 rounded-xl border border-gray-200">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t.competitors.yourAvgRating}
                          </p>
                          <p className="text-3xl font-bold text-gray-900 mt-2">
                            {ownRating.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t.competitors.lastData}:{" "}
                            {latestPoint
                              ? new Date(latestPoint.date).toLocaleDateString(
                                  dateLocale
                                )
                              : t.competitors.noData}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-gray-200">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t.competitors.topCompetitor}
                          </p>
                          <p className="text-3xl font-bold text-gray-900 mt-2">
                            {competitorRating.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {topCompetitor?.name || t.competitors.noData}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-gray-200">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t.competitors.reviewVolume}
                          </p>
                          <p className="text-3xl font-bold text-gray-900 mt-2">
                            {reviewSum}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t.analytics.last30Days}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-gray-200">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {t.competitors.nearestCompetitor}
                          </p>
                          <p className="text-lg font-semibold text-gray-900 mt-2">
                            {topCompetitor?.name || t.competitors.noData}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t.competitors.totalReviews}:{" "}
                            {topCompetitor?.total_reviews ??
                              competitorReviewSum ??
                              0}
                          </p>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-gray-500">
                    {t.competitors.metricsEmpty}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {t.competitors.ratingTrendTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.competitors.ratingTrendSubtitle}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      {t.competitors.you}
                    </div>
                    {competitorMetrics?.competitor_rankings[0] && (
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        {`${t.competitors.competitor}: ${competitorMetrics.competitor_rankings[0]?.name ?? ""}`}
                      </div>
                    )}
                  </div>
                </div>
                {metricsLoading ? (
                  <p className="text-sm text-gray-500">
                    {t.competitors.metricsLoading}
                  </p>
                ) : competitorMetrics ? (
                  <div className="w-full overflow-x-auto">
                    <svg width={600} height={200} className="min-w-full">
                      <path
                        d={buildLinePath(
                          competitorMetrics.business.time_series,
                          600,
                          180
                        )}
                        stroke="url(#ownLineGradient)"
                        strokeWidth={3}
                        fill="none"
                      />
                      {competitorMetrics.competitor_series[0] && (
                        <path
                          d={buildLinePath(
                            competitorMetrics.competitor_series[0]?.data || [],
                            600,
                            180
                          )}
                          stroke="url(#competitorLineGradient)"
                          strokeWidth={3}
                          fill="none"
                        />
                      )}
                      <defs>
                        <linearGradient
                          id="ownLineGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                        <linearGradient
                          id="competitorLineGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#fb7185" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {t.competitors.metricsEmpty}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {t.competitors.rankingTitle}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.competitors.lastData}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!currentBusiness) return;
                    setMetricsRefreshing(true);
                    loadCompetitorMetrics(currentBusiness.id);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {t.competitors.refresh}
                </button>
              </div>
              {metricsLoading ? (
                <p className="text-sm text-gray-500">
                  {t.competitors.metricsLoading}
                </p>
              ) : competitorMetrics ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2">{t.competitors.businessName}</th>
                        <th className="py-2">{t.competitors.rating}</th>
                        <th className="py-2">{t.competitors.totalReviews}</th>
                        <th className="py-2">{t.competitors.lastSync}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitorMetrics.competitor_rankings.map((item) => (
                        <tr key={item.id} className="border-t text-gray-800">
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2">
                            {item.rating?.toFixed(2) ?? t.competitors.noData}
                          </td>
                          <td className="py-2">{item.total_reviews}</td>
                          <td className="py-2 text-xs text-gray-500">
                            {item.last_sync_at
                              ? new Date(item.last_sync_at).toLocaleDateString(
                                  dateLocale
                                )
                              : t.competitors.noData}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {t.competitors.metricsEmpty}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {t.competitors.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t.competitors.description}
                </p>
                {competitors.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t.competitors.noCompetitors}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={t.competitors.searchCompetitor}
                    value={searchQuery}
                    onChange={async (e) => {
                      const query = e.target.value;
                      setSearchQuery(query);

                      if (query.length >= 3) {
                        setSearching(true);
                        try {
                          const response = await fetch(
                            `/api/competitors/search?query=${encodeURIComponent(query)}`
                          );
                          const data = await response.json();
                          if (data.success) {
                            setSearchResults(data.results || []);
                          }
                        } catch (error) {
                          console.error("Search error:", error);
                        } finally {
                          setSearching(false);
                        }
                      } else {
                        setSearchResults([]);
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
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.place_id}
                        className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {result.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {result.address}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-400">★</span>
                              <span className="text-sm font-medium text-gray-700">
                                {result.rating?.toFixed(1) || "N/A"}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {t.competitors.totalReviews}:{" "}
                              {result.total_reviews}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            setAddingCompetitor(true);
                            try {
                              const response = await fetch("/api/competitors", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  businessId: currentBusiness.id,
                                  placeId: result.place_id,
                                }),
                              });
                              const data = await response.json();
                              if (data.success) {
                                setCompetitors([
                                  ...competitors,
                                  data.competitor,
                                ]);
                                setSearchQuery("");
                                setSearchResults([]);
                                setSyncStatus({
                                  type: "success",
                                  text: "Rakip başarıyla eklendi!",
                                });
                                setTimeout(() => setSyncStatus(null), 3000);
                              } else {
                                setSyncStatus({
                                  type: "error",
                                  text: data.error || "Rakip eklenemedi",
                                });
                                setTimeout(() => setSyncStatus(null), 3000);
                              }
                            } catch (error) {
                              console.error("Add competitor error:", error);
                              setSyncStatus({
                                type: "error",
                                text: "Bir hata oluştu",
                              });
                              setTimeout(() => setSyncStatus(null), 3000);
                            } finally {
                              setAddingCompetitor(false);
                            }
                          }}
                          disabled={addingCompetitor}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {addingCompetitor
                            ? t.competitors.addThisCompetitorLoading
                            : t.competitors.addThisCompetitor}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {categoryInsights && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t.competitors.categoriesTitle}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t.competitors.categoriesSubtitle}
                    </p>
                  </div>
                  {categoryLoading && (
                    <span className="text-xs text-gray-500">
                      {t.competitors.categoriesLoading}
                    </span>
                  )}
                </div>
                {topCategoryHighlight && (
                  <div className="mb-6 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                    {t.competitors.topCategorySummary.replace(
                      "{category}",
                      topCategoryHighlight.label
                    )}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(CATEGORY_LABELS).map(([key, labels]) => {
                    const own =
                      categoryInsights.own_categories[key as CategoryKey];
                    if (!own) return null;
                    const competitor =
                      categoryInsights.competitor_categories[0]?.categories[
                        key as CategoryKey
                      ];

                    const ownTotal = own.positive + own.negative + own.neutral;
                    const competitorTotal = competitor
                      ? competitor.positive +
                        competitor.negative +
                        competitor.neutral
                      : 0;

                    if (ownTotal === 0 && competitorTotal === 0) return null;

                    const getLabel = () => {
                      if (locale === "en") return labels.en;
                      if (locale === "nl") return labels.nl;
                      return labels.tr;
                    };

                    return (
                      <div
                        key={key}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-800">
                            {getLabel()}
                          </h4>
                          <div className="text-xs text-gray-500">
                            {ownTotal + competitorTotal}{" "}
                            {t.analytics.reviewVolume}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs text-gray-600">
                          <div className="p-2 rounded-lg bg-green-50 text-green-700">
                            <p className="font-semibold">
                              {t.competitors.categoryPositive}
                            </p>
                            <p>
                              {t.competitors.you}: {own.positive}
                              {competitor
                                ? ` / ${t.competitors.competitor}: ${competitor.positive}`
                                : ""}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-red-50 text-red-700">
                            <p className="font-semibold">
                              {t.competitors.categoryNegative}
                            </p>
                            <p>
                              {t.competitors.you}: {own.negative}
                              {competitor
                                ? ` / ${t.competitors.competitor}: ${competitor.negative}`
                                : ""}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                            <p className="font-semibold">
                              {t.competitors.categoryNeutral}
                            </p>
                            <p>
                              {t.competitors.you}: {own.neutral}
                              {competitor
                                ? ` / ${t.competitors.competitor}: ${competitor.neutral}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {competitors.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    {t.competitors.comparison}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t.competitors.comparisonSubtitle}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          {t.competitors.businessName}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t.competitors.rating}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t.competitors.totalReviews}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t.competitors.lastSync}
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                          {t.competitors.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 bg-blue-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                              {t.competitors.you}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {currentBusiness.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-yellow-400">★</span>
                            <span className="font-semibold text-gray-900">
                              {currentBusiness.rating?.toFixed(1) ||
                                t.competitors.noData}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 font-semibold text-gray-900">
                          {currentBusiness.total_reviews}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-600">
                          {currentBusiness.last_sync_at
                            ? new Date(
                                currentBusiness.last_sync_at
                              ).toLocaleDateString(dateLocale)
                            : t.competitors.noData}
                        </td>
                        <td className="text-center py-3 px-4">-</td>
                      </tr>
                      {competitors.map((comp) => (
                        <tr
                          key={comp.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {comp.competitor_name}
                              </p>
                              {comp.address && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {comp.address}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-yellow-400">★</span>
                              <span className="font-medium text-gray-700">
                                {comp.rating?.toFixed(1) ||
                                  t.competitors.noData}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4 font-medium text-gray-700">
                            {comp.total_reviews}
                          </td>
                          <td className="text-center py-3 px-4 text-sm text-gray-600">
                            {comp.last_sync_at
                              ? new Date(comp.last_sync_at).toLocaleDateString(
                                  dateLocale
                                )
                              : t.competitors.noData}
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={async () => {
                                  setSyncing(true);
                                  try {
                                    const response = await fetch(
                                      `/api/competitors/${comp.id}/sync`,
                                      {
                                        method: "POST",
                                      }
                                    );
                                    const data = await response.json();
                                    if (data.success) {
                                      const updatedCompetitors =
                                        competitors.map((c) =>
                                          c.id === comp.id
                                            ? { ...c, ...data.competitor }
                                            : c
                                        );
                                      setCompetitors(updatedCompetitors);
                                      setSyncStatus({
                                        type: "success",
                                        text: "Rakip verileri güncellendi!",
                                      });
                                      setTimeout(
                                        () => setSyncStatus(null),
                                        3000
                                      );
                                    }
                                  } catch (error) {
                                    console.error("Sync error:", error);
                                  } finally {
                                    setSyncing(false);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                {t.competitors.sync}
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={async () => {
                                  const confirmed = confirm(
                                    t.competitors.deleteCompetitorConfirm
                                  );
                                  if (!confirmed) return;
                                  try {
                                    const response = await fetch(
                                      `/api/competitors/${comp.id}`,
                                      {
                                        method: "DELETE",
                                      }
                                    );
                                    const data = await response.json();
                                    if (data.success) {
                                      setCompetitors(
                                        competitors.filter(
                                          (c) => c.id !== comp.id
                                        )
                                      );
                                      setSyncStatus({
                                        type: "success",
                                        text: "Rakip kaldırıldı",
                                      });
                                      setTimeout(
                                        () => setSyncStatus(null),
                                        3000
                                      );
                                    }
                                  } catch (error) {
                                    console.error("Delete error:", error);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                {t.competitors.deleteCompetitor}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">
                      {t.competitors.ratingComparisonTitle}
                    </h4>
                    <div className="space-y-3">
                      {[
                        {
                          name: currentBusiness.name,
                          rating: currentBusiness.rating || 0,
                          isYou: true,
                        },
                        ...competitors.map((c) => ({
                          name: c.competitor_name,
                          rating: c.rating || 0,
                          isYou: false,
                        })),
                      ].map((item, index) => {
                        const percentage = (item.rating / 5) * 100;
                        return (
                          <div key={`${item.name}-${index}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {item.isYou
                                  ? `${item.name} (${t.competitors.you})`
                                  : item.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                {item.rating.toFixed(1)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.isYou
                                    ? "bg-gradient-to-r from-blue-500 to-blue-600"
                                    : "bg-gradient-to-r from-gray-400 to-gray-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">
                      {t.competitors.reviewComparisonTitle}
                    </h4>
                    <div className="space-y-3">
                      {[
                        {
                          name: currentBusiness.name,
                          total_reviews: currentBusiness.total_reviews,
                          isYou: true,
                        },
                        ...competitors.map((c) => ({
                          name: c.competitor_name,
                          total_reviews: c.total_reviews,
                          isYou: false,
                        })),
                      ].map((item, index) => {
                        const maxReviews = Math.max(
                          currentBusiness.total_reviews,
                          ...competitors.map((c) => c.total_reviews)
                        );
                        const percentage =
                          maxReviews > 0
                            ? (item.total_reviews / maxReviews) * 100
                            : 0;
                        return (
                          <div key={`${item.name}-${index}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {item.isYou
                                  ? `${item.name} (${t.competitors.you})`
                                  : item.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                {item.total_reviews}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.isYou
                                    ? "bg-gradient-to-r from-green-500 to-green-600"
                                    : "bg-gradient-to-r from-gray-400 to-gray-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t.competitors.noCompetitors}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t.competitors.description}
                </p>
                <p className="text-xs text-gray-400">
                  {t.competitors.searchCompetitor}
                </p>
              </div>
            )}
          </div>
        )}
        {/* Settings Tab */}
        {activeTab === "settings" && currentBusiness && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t.settings.businessSettings}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t.settings.customInstructionsPlaceholder}
                </p>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {settingsSaving
                  ? t.settings.savingSettings
                  : t.settings.saveSettings}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.settings.defaultLanguage}
                </label>
                <select
                  value={settingsLanguage}
                  onChange={(e) => setSettingsLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Türkçe">
                    {locale === "tr"
                      ? "Türkçe"
                      : locale === "en"
                        ? "Turkish"
                        : "Turks"}
                  </option>
                  <option value="İngilizce">
                    {locale === "tr"
                      ? "İngilizce"
                      : locale === "en"
                        ? "English"
                        : "Engels"}
                  </option>
                  <option value="Felemenkçe">
                    {locale === "tr"
                      ? "Felemenkçe"
                      : locale === "en"
                        ? "Dutch"
                        : "Nederlands"}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.settings.defaultTone}
                </label>
                <select
                  value={settingsTone}
                  onChange={(e) => setSettingsTone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Profesyonel">
                    {t.templates.professional}
                  </option>
                  <option value="Samimi">{t.templates.friendly}</option>
                  <option value="Kısa">{t.templates.short}</option>
                  <option value="Detaylı">{t.templates.detailed}</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t.settings.customInstructions}
                </label>
                <textarea
                  value={settingsInstructions}
                  onChange={(e) => setSettingsInstructions(e.target.value)}
                  rows={4}
                  placeholder={t.settings.customInstructionsPlaceholder}
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
                {editingTemplate
                  ? t.templates.editTemplate
                  : t.templates.createTemplate}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.templates.templateName}
                </label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.templates.templateDescription}
                </label>
                <input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.templates.toneType}
                  </label>
                  <select
                    value={templateTone}
                    onChange={(e) => setTemplateTone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="positive">{t.templates.positive}</option>
                    <option value="negative">{t.templates.negative}</option>
                    <option value="neutral">{t.templates.neutral}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.templates.language}
                  </label>
                  <select
                    value={templateLanguage}
                    onChange={(e) => setTemplateLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Türkçe">
                      {locale === "tr"
                        ? "Türkçe"
                        : locale === "en"
                          ? "Turkish"
                          : "Turks"}
                    </option>
                    <option value="İngilizce">
                      {locale === "tr"
                        ? "İngilizce"
                        : locale === "en"
                          ? "English"
                          : "Engels"}
                    </option>
                    <option value="Felemenkçe">
                      {locale === "tr"
                        ? "Felemenkçe"
                        : locale === "en"
                          ? "Dutch"
                          : "Nederlands"}
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {t.templates.instructions}
                  </label>
                  <button
                    onClick={handleGenerateTemplate}
                    type="button"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    disabled={templateGenerating}
                  >
                    {templateGenerating
                      ? t.reviews.generating
                      : "AI " + t.reviews.generateReply.toLowerCase()}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.templates.exampleResponse}
                </label>
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
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={templateSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {templateSaving ? t.common.loading : t.common.save}
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
                <h3 className="text-xl font-bold text-gray-900">
                  {t.reviews.aiGenerateReply}
                </h3>
                <button
                  onClick={handleCloseAiModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Original Review */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.reviews.customerReview}
                </label>
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {selectedReview.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {selectedReview.author_name}
                      </p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span
                            key={index}
                            className={`text-lg ${index < selectedReview.rating ? "text-yellow-400" : "text-gray-300"}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {selectedReview.text}
                  </p>
                </div>
              </div>

              {/* Language & Tone Selectors */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.reviews.language}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Türkçe", "İngilizce", "Felemenkçe"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setAiLanguage(lang)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        aiLanguage === lang
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.reviews.tone}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "Profesyonel", label: t.templates.professional },
                    { value: "Samimi", label: t.templates.friendly },
                    { value: "Kısa", label: t.templates.short },
                    { value: "Detaylı", label: t.templates.detailed },
                  ].map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setAiTone(tone.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        aiTone === tone.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {tone.label}
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
                    {t.reviews.generating}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {t.reviews.generateReply}
                  </>
                )}
              </button>

              {/* Error */}
              {aiError && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {aiError}
                </div>
              )}

              {/* Success Message */}
              {replySuccess && (
                <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {t.reviews.sentSuccessfully}
                </div>
              )}

              {/* Generated Reply */}
              {generatedReply && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t.reviews.generatedReply}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyReply}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        {t.reviews.copyReply}
                      </button>
                      <button
                        onClick={handleSendReplyToGoogle}
                        disabled={sendingReply || replySuccess}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {sendingReply ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {t.reviews.sending}
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                            {t.reviews.sendToGoogle}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {generatedReply}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
