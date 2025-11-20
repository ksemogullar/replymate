import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];

type GoogleReview = {
  name: string; // The full resource name, e.g., accounts/XXX/locations/YYY/reviews/ZZZ
  reviewId: string;
  starRating: string;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
  };
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
};

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

async function fetchAccounts(accessToken: string) {
  const response = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error?.message || "Google Business hesapları alınamadı"
    );
  }
  const data = await response.json();
  return (data.accounts || []).map((acc: any) => acc.name);
}

async function findLocationInAccount(
  accountName: string,
  placeId: string,
  accessToken: string
) {
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`
    );
    url.searchParams.set("readMask", "name,storeCode,metadata");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Error fetching locations for account ${accountName}:`,
        await response.text()
      );
      continue;
    }

    const data = await response.json();
    console.log(`Found ${data.locations?.length || 0} locations in this page`);

    if (data.locations) {
      for (const location of data.locations) {
        const locationPlaceId = location.metadata?.placeId;
        console.log("Checking location:", {
          name: location.name,
          placeId: locationPlaceId,
          storeCode: location.storeCode,
          matches: locationPlaceId === placeId,
        });
        if (locationPlaceId === placeId) {
          return location.name;
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return null;
}

async function findLocationName(
  placeId: string,
  accessToken: string
): Promise<string | null> {
  console.log("📋 Fetching Google Business accounts...");
  const accounts = await fetchAccounts(accessToken);
  console.log(`✅ Found ${accounts.length} account(s):`, accounts);

  for (const accountName of accounts) {
    console.log(`🔍 Searching locations in account: ${accountName}`);
    const locationName = await findLocationInAccount(
      accountName,
      placeId,
      accessToken
    );
    if (locationName) {
      console.log(`✅ Found matching location: ${locationName}`);
      if (!locationName.startsWith("accounts/")) {
        const fixedLocationName = `${accountName}/${locationName}`;
        console.warn(
          `⚠️ Location name was incomplete, fixed to: ${fixedLocationName}`
        );
        return fixedLocationName;
      }
      return locationName;
    }
  }

  return null;
}

async function fetchAllReviews({
  accessToken,
  locationName,
}: {
  accessToken: string;
  locationName: string;
}) {
  let pageToken: string | undefined;
  const reviews: GoogleReview[] = [];
  let averageRating: number | null = null;
  let totalReviewCount: number | null = null;

  do {
    // ESKİ ve ÇALIŞAN v4 API UÇ NOKTASINA GERİ DÖNÜYORUZ
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    console.log("🔗 Fetching reviews from:", url.toString());

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.error?.message ||
        data.error?.status ||
        "Google yorumları alınamadı";
      console.error("Google API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        locationName,
      });
      throw new Error(`${errorMessage} (Status: ${response.status})`);
    }

    if (typeof data.averageRating === "number") {
      averageRating = data.averageRating;
    }
    if (typeof data.totalReviewCount === "number") {
      totalReviewCount = data.totalReviewCount;
    }
    reviews.push(...((data.reviews as GoogleReview[]) ?? []));

    pageToken = data.nextPageToken as string | undefined;
  } while (pageToken);

  console.log(`Successfully fetched ${reviews.length} reviews`);
  return { reviews, averageRating, totalReviewCount };
}

function normalizeRating(starRating: string) {
  switch (starRating) {
    case "ONE":
      return 1;
    case "TWO":
      return 2;
    case "THREE":
      return 3;
    case "FOUR":
      return 4;
    case "FIVE":
      return 5;
    default:
      return 0;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await request.json();

  if (!businessId) {
    return NextResponse.json(
      { error: "Business ID is required" },
      { status: 400 }
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .single();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "Business not found or access denied" },
      { status: 404 }
    );
  }

  const { data: connection, error: connectionError } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (connectionError || !connection) {
    return NextResponse.json(
      { error: "Google connection not found" },
      { status: 404 }
    );
  }

  let accessToken = connection.access_token;
  const typedConnection =
    connection as Database["public"]["Tables"]["google_connections"]["Row"];

  if (
    typedConnection.expires_at &&
    new Date(typedConnection.expires_at) <= new Date()
  ) {
    if (!typedConnection.refresh_token) {
      return NextResponse.json(
        { error: "Google token expired, please reconnect" },
        { status: 401 }
      );
    }
    try {
      const refreshed = await refreshAccessToken(typedConnection.refresh_token);
      accessToken = refreshed.accessToken;
      await supabase
        .from("google_connections")
        .update({
          access_token: refreshed.accessToken,
          refresh_token:
            refreshed.refreshToken ?? typedConnection.refresh_token,
          expires_at: refreshed.expiresAt,
        })
        .eq("id", typedConnection.id);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  let reviews: Review[] = [];
  let averageRating: number | null = business.rating;
  let totalReviewCount: number | null = business.total_reviews;
  let usedPlacesAPI = false;

  try {
    console.log(`🔍 Looking for location with Place ID: ${business.place_id}`);
    const locationName = await findLocationName(business.place_id, accessToken);

    if (locationName) {
      console.log(`✅ Location found: ${locationName}`);
      console.log("📥 Fetching reviews from My Business API...");
      try {
        const result = await fetchAllReviews({ accessToken, locationName });
        const fetchedAt = new Date().toISOString();

        reviews = result.reviews.map((review) => ({
          google_review_id: review.name,
          author_name: review.reviewer?.displayName || "Anonim Kullanıcı",
          author_photo_url: review.reviewer?.profilePhotoUrl || null,
          rating: normalizeRating(review.starRating),
          text: review.comment || null,
          has_reply: !!review.reviewReply,
          reply_text: review.reviewReply?.comment || null,
          replied_at: review.reviewReply?.updateTime || null,
          review_created_at: review.createTime || fetchedAt,
        }));

        averageRating = result.averageRating;
        totalReviewCount = result.totalReviewCount;
        console.log(
          `✅ Successfully fetched ${reviews.length} reviews from My Business API`
        );
      } catch (error: any) {
        console.error("❌ My Business API failed, falling back to Places API");
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        usedPlacesAPI = true;
      }
    } else {
      console.warn(
        "⚠️ Location not found in any Google Business account, falling back to Places API"
      );
      usedPlacesAPI = true;
    }

    if (usedPlacesAPI) {
      // Fallback to Places API
    }

    if (reviews.length > 0) {
      const reviewsToInsert = reviews.map((r) => ({
        ...r,
        business_id: business.id,
      }));

      const uniqueReviewsMap = new Map<string, (typeof reviewsToInsert)[0]>();
      for (const review of reviewsToInsert) {
        const key = `${review.business_id}:${review.google_review_id}`;
        uniqueReviewsMap.set(key, review);
      }
      const uniqueReviews = Array.from(uniqueReviewsMap.values());

      const { error: upsertError } = await supabase
        .from("reviews")
        .upsert(uniqueReviews, {
          onConflict: "business_id, google_review_id",
        });

      if (upsertError) {
        console.error("Error upserting reviews:", upsertError);
        throw new Error("Failed to save reviews to database");
      }
    }

    const { error: updateBusinessError } = await supabase
      .from("businesses")
      .update({
        rating: averageRating,
        total_reviews: totalReviewCount,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", business.id);

    if (updateBusinessError) {
      console.error("Error updating business stats:", updateBusinessError);
    }

    let message = `Successfully synchronized ${reviews.length} reviews.`;
    if (usedPlacesAPI) {
      message = `Yorumlar Places API ile senkronize edildi (maksimum 5 yorum). Tüm yorumlar için Google Business hesabınızı bağlamanız gerekiyor.`;
    }

    return NextResponse.json({ message, reviewCount: reviews.length });
  } catch (error: any) {
    console.error("An error occurred during review sync:", error);
    return NextResponse.json(
      { error: error.message || "An unknown error occurred" },
      { status: 500 }
    );
  }
}
