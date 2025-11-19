import { NextResponse } from 'next/server'

const MODEL_NAME = 'models/gemini-2.5-flash'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/${MODEL_NAME}:generateContent`

const TONE_INSTRUCTIONS: Record<string, Record<string, string>> = {
  Profesyonel: {
    Türkçe: 'Profesyonel, saygılı ve resmi bir dil kullan. İşletme adına ciddi ve güvenilir bir yanıt ver.',
    İngilizce: 'Use professional, respectful and formal language. Respond on behalf of the business in a serious and trustworthy manner.',
    Felemenkçe: 'Gebruik professionele, respectvolle en formele taal. Reageer namens het bedrijf op een serieuze en betrouwbare manier.',
  },
  Samimi: {
    Türkçe: 'Samimi, sıcak ve arkadaşça bir dil kullan. Müşteriyle yakın bir bağ kur ama saygılı ol.',
    İngilizce: 'Use warm, friendly and approachable language. Build a close connection with the customer while remaining respectful.',
    Felemenkçe: 'Gebruik warme, vriendelijke en benaderbare taal. Bouw een nauwe band op met de klant terwijl je respectvol blijft.',
  },
  Kısa: {
    Türkçe: 'Kısa, öz ve doğrudan bir yanıt ver. Maksimum 2-3 cümle kullan. Gereksiz detaya girme.',
    İngilizce: 'Give a brief, concise and direct response. Use maximum 2-3 sentences. Avoid unnecessary details.',
    Felemenkçe: 'Geef een kort, beknopt en direct antwoord. Gebruik maximaal 2-3 zinnen. Vermijd onnodige details.',
  },
  Detaylı: {
    Türkçe: 'Detaylı, açıklayıcı ve kapsamlı bir yanıt ver. Yorumdaki her noktayı ele al ve gerekirse ek bilgi ver.',
    İngilizce: 'Give a detailed, explanatory and comprehensive response. Address every point in the review and provide additional information if needed.',
    Felemenkçe: 'Geef een gedetailleerd, verklarend en uitgebreid antwoord. Behandel elk punt in de review en geef indien nodig aanvullende informatie.',
  },
}

const BASE_INSTRUCTIONS: Record<string, string> = {
  Türkçe: `Müşteri yorumuna işletme sahibi adına cevap oluştur. Kurallar:
- Yorumdaki belirli noktaları ele al
- Geri bildirim için teşekkür et
- Yorum olumsuzsa özür dile ve sorunu çözmek için yardım teklif et
- Yorum olumluysa minnettarlığını ifade et ve gelecek ziyaretleri teşvik et
- Otantik ve kişiselleştirilmiş ol, jenerik şablonlar kullanma
- Sadece cevabı yaz, başka açıklama ekleme`,
  İngilizce: `Generate a response to the customer review on behalf of the business owner. Rules:
- Address specific points mentioned in the review
- Thank them for the feedback
- If negative, apologize and offer to help resolve the issue
- If positive, express gratitude and encourage future visits
- Be authentic and personalized, don't use generic templates
- Write only the response, no additional explanations`,
  Felemenkçe: `Genereer een reactie op de klantrecensie namens de bedrijfseigenaar. Regels:
- Behandel specifieke punten die in de review worden genoemd
- Bedank hen voor de feedback
- Als negatief, verontschuldig je en bied aan om het probleem op te lossen
- Als positief, druk dankbaarheid uit en moedig toekomstige bezoeken aan
- Wees authentiek en gepersonaliseerd, gebruik geen generieke sjablonen
- Schrijf alleen het antwoord, geen aanvullende uitleg`,
}

function buildPrompt(review: string, language: string, tone: string): string {
  const baseInstruction = BASE_INSTRUCTIONS[language] || BASE_INSTRUCTIONS['Türkçe']
  const toneInstruction = TONE_INSTRUCTIONS[tone]?.[language] || TONE_INSTRUCTIONS['Profesyonel']?.[language] || ''

  return `Bir Google işletme yorumu için yanıt taslağı yazmanı istiyorum.

Markanın Ses Tonu: "${toneInstruction || tone}"
Yanıtı hangi dilde yazmalısın: ${language}

Yorum Detayları:
- Müşteri Yorumu: "${review}"

Kurallar:
1. Yorumu yazan kişiye adıyla hitap et (isim yoksa "Merhaba" de).
2. Yorumun içeriğindeki spesifik noktaya değin.
3. İndirim/hediye/para iadesi vaadi verme.
4. Yanıtı kısa, samimi ve markanın tonuna uygun tut.
5. Sadece yanıtı döndür, açıklama ekleme.

${baseInstruction}
`
}

export async function POST(req: Request) {
  try {
    const { review, language, tone } = await req.json()

    if (!review || typeof review !== 'string') {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 })
    }

    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 })
    }

    if (!tone || typeof tone !== 'string') {
      return NextResponse.json({ error: 'Tone is required' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 })
    }

    const prompt = buildPrompt(review, language, tone)

    const response = await fetch(`${API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      console.error('Gemini API Error Response:', data)
      return NextResponse.json(
        { error: `API Error: ${data?.error?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate reply, please try again.'

    return NextResponse.json({ reply: reply.trim() })
  } catch (error) {
    console.error('Gemini API Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Server error', details: errorMessage }, { status: 500 })
  }
}
