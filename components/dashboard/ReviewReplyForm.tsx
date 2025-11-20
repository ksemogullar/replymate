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
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
            {review.author_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">
              {review.author_name}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={
                      index < review.rating
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">
        {review.text || t.reviews.noText}
      </p>

      <div className="mt-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          {review.has_reply
            ? t.reviews.businessResponse
            : t.reviews.generateReply}
        </label>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          placeholder={t.reviews.generateReply}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleGenerateReply}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? t.reviews.generating : t.reviews.aiGenerateReply}
        </button>
        <button
          onClick={handleCopyReply}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
        >
          {t.reviews.copyReply}
        </button>
        <button
          onClick={handleSendToGoogle}
          disabled={sendingToGoogle || !replyText.trim()}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {sendingToGoogle ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {t.reviews.sending}
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
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
        <button
          onClick={handleSaveReply}
          disabled={saving || !replyText.trim()}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? t.common.loading : t.common.save}
        </button>
      </div>

      {status && (
        <div
          className={`mt-3 text-sm ${
            status.type === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
