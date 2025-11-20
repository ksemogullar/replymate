import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Bu fonksiyon, sync/route.ts dosyasında zaten mevcut.
// Kod tekrarını önlemek için bunu paylaşılan bir lib dosyasına taşımak iyi bir pratik olacaktır.
// Şimdilik buraya kopyalıyoruz.
async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth ortam değişkenleri eksik");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData?.error === "invalid_grant") {
      throw new Error("REAUTH_REQUIRED");
    }
    throw new Error(
      errorData?.error_description || "Google erişim tokenı yenilenemedi"
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    expiresAt: new Date(
      Date.now() + (data.expires_in ?? 3600) * 1000
    ).toISOString(),
  };
}

export async function PUT(
  request: Request,
  { params }: { params: { reviewId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { replyText } = await request.json();
    const { reviewId } = params;

    if (!replyText) {
      return NextResponse.json(
        { error: "Yanıt metni gerekli" },
        { status: 400 }
      );
    }

    // 1. Veritabanından yorumu ve sahibini doğrula
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("*, businesses(user_id)")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review || review.businesses?.user_id !== user.id) {
      return NextResponse.json(
        { error: "Yorum bulunamadı veya bu yoruma erişim izniniz yok" },
        { status: 404 }
      );
    }

    // 2. Google bağlantısını ve token'ı al
    const { data: connection } = await supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Google hesabı bağlı değil" },
        { status: 400 }
      );
    }

    let accessToken = connection.access_token;
    if (
      connection.expires_at &&
      new Date(connection.expires_at) <= new Date()
    ) {
      if (!connection.refresh_token) {
        throw new Error("REAUTH_REQUIRED");
      }
      const refreshed = await refreshAccessToken(connection.refresh_token);
      accessToken = refreshed.accessToken;
      // Token'ı veritabanında güncelle
      await supabase
        .from("google_connections")
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken ?? connection.refresh_token,
          expires_at: refreshed.expiresAt,
        })
        .eq("id", connection.id);
    }

    // 3. Google My Business API'ye yanıtı gönder
    // YANITLAMA İŞLEMİ İÇİN MODERN API UÇ NOKTASINI KULLANIYORUZ.
    // Bu, Google'ın yeni ve önerilen yöntemidir.
    // review.google_review_id, 'accounts/123/locations/456/reviews/789' formatındadır.
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${review.google_review_id}:updateReply`;

    console.log(`📤 Replying to review via: ${url}`);

    const googleResponse = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reply: {
          comment: replyText,
        },
      }),
    });

    if (!googleResponse.ok) {
      // Google'dan gelen yanıt JSON değilse (HTML hata sayfası gibi), metin olarak oku.
      const errorText = await googleResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: { message: errorText.substring(0, 200) } }; // Hatanın bir kısmını göster
      }
      console.error("Google API reply error:", errorData);
      throw new Error(
        errorData.error?.message || "Google'a yanıt gönderilemedi"
      );
    }

    const googleReply = await googleResponse.json();

    // 4. Kendi veritabanındaki yorumu güncelle
    const { data: updatedReview, error: updateError } = await supabase
      .from("reviews")
      .update({
        has_reply: true,
        reply_text: googleReply.comment,
        replied_at: googleReply.updateTime,
        reply_author: "İşletme Sahibi",
      })
      .eq("id", review.id)
      .select()
      .single();

    if (updateError) {
      console.error("Supabase review update error:", updateError);
      return NextResponse.json(
        {
          error:
            "Yanıt Google'a gönderildi ancak yerel veritabanına kaydedilemedi.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedReview);
  } catch (error: any) {
    if (error.message === "REAUTH_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "Google bağlantınızın süresi dolmuş. Lütfen profil sayfanızdan yeniden bağlanın.",
        },
        { status: 401 }
      );
    }
    console.error("Reply API error:", error);
    return NextResponse.json(
      { error: error.message || "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
