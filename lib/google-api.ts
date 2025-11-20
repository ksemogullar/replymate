const BUSINESS_MANAGE_SCOPE = 'https://www.googleapis.com/auth/business.manage'

type GoogleApiErrorPayload = {
  error?: {
    message?: string
    status?: string
  }
  message?: string
}

export type GoogleReviewRaw = {
  reviewId: string
  starRating: string
  comment?: string
  createTime?: string
  reviewerLanguage?: string
  reviewer?: {
    displayName?: string
    profilePhotoUrl?: string
  }
  reviewReply?: {
    comment?: string
    updateTime?: string
  }
}

export type GoogleLocationDetails = {
  storefrontAddress?: { addressLines?: string[] }
  phoneNumbers?: { primaryPhone?: string }
  websiteUri?: string
  categories?: {
    primaryCategory?: { displayName?: string }
  }
  metadata?: {
    placeId?: string
  }
}

export function getBusinessScope() {
  return BUSINESS_MANAGE_SCOPE
}

export async function handleGoogleApiError(response: Response, apiName: string): Promise<never> {
  let errorData: GoogleApiErrorPayload = {}
  try {
    errorData = (await response.json()) as GoogleApiErrorPayload
  } catch {
    errorData = { message: response.statusText }
  }

  console.error(`Google ${apiName} API Error Response:`, JSON.stringify(errorData, null, 2))
  const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`
  throw new Error(`Google ${apiName} API Error: ${errorMessage} (Status: ${response.status})`)
}

export async function fetchAllReviews(
  locationName: string,
  accessToken: string
): Promise<GoogleReviewRaw[]> {
  console.log(`📥 Fetching reviews using My Business Reviews API for: ${locationName}`)
  const baseUrl = `https://mybusinessreviews.googleapis.com/v1/${locationName}/reviews`

  const allReviews: GoogleReviewRaw[] = []
  let nextPageToken: string | null = null
  let page = 1

  do {
    const params = new URLSearchParams({ pageSize: '50' })
    if (nextPageToken) {
      params.set('pageToken', nextPageToken)
    }

    const url = `${baseUrl}?${params.toString()}`
    console.log(`🔗 Fetching page ${page} from: ${url}`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      await handleGoogleApiError(response, 'My Business Reviews')
    }

    let data: { reviews?: GoogleReviewRaw[]; nextPageToken?: string }
    try {
      data = (await response.json()) as {
        reviews?: GoogleReviewRaw[]
        nextPageToken?: string
      }
    } catch (error) {
      const text = await response.text().catch(() => '')
      console.error('🚨 Failed to parse My Business Reviews response as JSON. Raw body:', text)
      throw error
    }
    const reviews = data.reviews ?? []

    if (reviews.length) {
      console.log(`✅ Found ${reviews.length} reviews on page ${page}.`)
      allReviews.push(...reviews)
    } else {
      console.log(`ℹ️ No reviews found on page ${page} or end of list.`)
    }

    nextPageToken = (data.nextPageToken as string | undefined) ?? null
    page += 1
  } while (nextPageToken)

  console.log(`✨ Total reviews fetched successfully: ${allReviews.length}`)
  return allReviews
}

export async function fetchLocationDetails(
  locationName: string,
  accessToken: string
): Promise<GoogleLocationDetails> {
  console.log(`ℹ️ Fetching location details using My Business Information API for: ${locationName}`)
  const readMask =
    'name,title,metadata,storefrontAddress,phoneNumbers,websiteUri,categories,latlng,placeId'
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=${readMask}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    await handleGoogleApiError(response, 'My Business Information')
  }

  const data = (await response.json()) as GoogleLocationDetails
  console.log('✅ Successfully fetched location details.')
  return data
}
