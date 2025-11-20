"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Review = {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  review_created_at: string;
  has_reply: boolean;
  reply_text: string | null;
  replied_at: string | null;
  google_review_id: string | null;
  business_id: string;
};

type Status = {
  type: "success" | "error";
  message: string;
} | null;

const LANGUAGE_OPTIONS = ["Türkçe", "İngilizce", "Felemenkçe"];
const TONE_OPTIONS = ["Profesyonel", "Samimi", "Kısa", "Detaylı"];

interface ReviewReplyFormProps {
  initialReview: Review;
}

export default function ReviewReplyForm({
  initialReview,
}: ReviewReplyFormProps) {
  const { t, locale } = useTranslation();
  const supabase = createClient();

  const [review, setReview] = useState(initialReview);
  const [replyText, setReplyText] = useState(initialReview.reply_text || "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    initialReview.language && LANGUAGE_OPTIONS.includes(initialReview.language)
      ? initialReview.language
      : "Türkçe"
  );
  const [selectedTone, setSelectedTone] = useState("Profesyonel");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingToGoogle, setSendingToGoogle] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const formattedDate = useMemo(() => {
    try {
      return new Date(review.review_created_at).toLocaleDateString(
        locale === "en" ? "en-US" : locale === "nl" ? "nl-NL" : "tr-TR",
        {
          dateStyle: "medium",
        }
      );
    } catch {
      return review.review_created_at;
    }
  }, [review.review_created_at, locale]);

  const handleGenerateReply = async () => {
    setGenerating(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/reviews/${review.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: selectedLanguage,
          tone: selectedTone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI cevap üretilemedi");
      }

      setReplyText(data.reply);
      setStatus({
        type: "success",
        message: t.reviews.generatedReply,
      });
    } catch (error: any) {
      console.error("Generate reply error:", error);
      setStatus({
        type: "error",
        message: error.message || "AI cevabı oluşturulamadı.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyReply = async () => {
    if (!replyText) return;
    await navigator.clipboard.writeText(replyText);
    setStatus({ type: "success", message: t.reviews.copyReply });
    setTimeout(() => setStatus(null), 1500);
  };

  const handleSaveReply = async () => {
    if (!replyText.trim()) {
      setStatus({
        type: "error",
        message: t.reviews.noText,
      });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const { error } = await supabase
        .from("reviews")
        .update({
          has_reply: true,
          reply_text: replyText.trim(),
          replied_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      if (error) {
        throw error;
      }

      setReview((prev) => ({
        ...prev,
        has_reply: true,
        reply_text: replyText.trim(),
        replied_at: new Date().toISOString(),
      }));

      setStatus({
        type: "success",
        message: t.common.success,
      });
    } catch (error: any) {
      console.error("Save reply error:", error);
      setStatus({
        type: "error",
        message: error.message || "Yanıt kaydedilemedi.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendToGoogle = async () => {
    if (!replyText.trim()) {
      setStatus({
        type: "error",
        message: t.reviews.noText,
      });
      return;
    }

    if (!review.google_review_id) {
      setStatus({
        type: "error",
        message: "Google review ID bulunamadı",
      });
      return;
    }

    setSendingToGoogle(true);
    setStatus(null);

    try {
      // DOĞRU API ROTASINI ÇAĞIRIYORUZ
      const response = await fetch("/api/extension/post-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessId: review.business_id,
          reviewId: review.google_review_id,
          replyText: replyText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Google'a gönderilemedi");
      }

      setReview((prev) => ({
        ...prev,
        has_reply: true,
        reply_text: data.reply_text || replyText.trim(),
        replied_at: data.replied_at || new Date().toISOString(),
      }));

      setStatus({
        type: "success",
        message: t.reviews.sentSuccessfully,
      });
    } catch (error: any) {
      console.error("Send to Google error:", error);
      setStatus({
        type: "error",
        message: error.message || t.reviews.sendError,
      });
    } finally {
      setSendingToGoogle(false);
    }
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-md flex-shrink-0">
            {review.author_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {review.author_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={`text-xl ${
                      index < review.rating
                        ? "text-yellow-500"
                        : "text-gray-300"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600">•</span>
              <span className="text-sm font-medium text-gray-600">{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-base leading-relaxed text-gray-900 whitespace-pre-line font-medium">
          {review.text || <span className="text-gray-500 italic">{t.reviews.noText}</span>}
        </p>
      </div>

      <div className="mt-5">
        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
          {review.has_reply ? (
            <>
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              {t.reviews.businessResponse}
            </>
          ) : (
            <>
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
              {t.reviews.generateReply}
            </>
          )}
        </label>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={5}
          className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
          placeholder={t.reviews.generateReply}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleGenerateReply}
          disabled={generating}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {t.reviews.generating}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t.reviews.aiGenerateReply}
            </>
          )}
        </button>
        <button
          onClick={handleCopyReply}
          disabled={!replyText.trim()}
          className="px-5 py-2.5 bg-gray-100 border-2 border-gray-300 text-gray-800 text-sm font-bold rounded-lg hover:bg-gray-200 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {t.reviews.copyReply}
        </button>
        <button
          onClick={handleSendToGoogle}
          disabled={sendingToGoogle || !replyText.trim()}
          className="px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-2"
        >
          {sendingToGoogle ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {t.reviews.sending}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {t.reviews.sendToGoogle}
            </>
          )}
        </button>
        <button
          onClick={handleSaveReply}
          disabled={saving || !replyText.trim()}
          className="px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {t.common.loading}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t.common.save}
            </>
          )}
        </button>
      </div>

      {status && (
        <div className={`mt-4 p-3 rounded-lg font-medium text-sm ${
          status.type === "success"
            ? "bg-green-50 border-2 border-green-200 text-green-800"
            : "bg-red-50 border-2 border-red-200 text-red-800"
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
