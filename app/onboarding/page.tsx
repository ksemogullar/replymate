'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [placeId, setPlaceId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/business/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeId: placeId.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Bir hata oluştu')
      }

      // Mark onboarding as completed
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', session.user.id)

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">İşletmenizi Ekleyin</h1>
          <p className="text-gray-600">
            Google Business profilinizi ReplyMate'e bağlayın
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="placeId" className="block text-sm font-medium text-gray-700 mb-2">
              Google Place ID
            </label>
            <input
              id="placeId"
              type="text"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            />
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              {showHelp ? '▼' : '▶'} Place ID'mi nasıl bulurum?
            </button>

            {showHelp && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                <p className="font-medium mb-2">Place ID Bulma Adımları:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google Place ID Finder
                    </a>{' '}
                    sayfasını açın
                  </li>
                  <li>İşletmenizin adını veya adresini arayın</li>
                  <li>Sonuçlardan işletmenizi seçin</li>
                  <li>
                    "Place ID" alanındaki kodu kopyalayın (örnek:
                    ChIJN1t_tDeuEmsRUsoyG83frY4)
                  </li>
                </ol>
                <p className="mt-3 text-xs text-gray-600">
                  <strong>Not:</strong> Place ID, Google Maps'teki her işletmenin benzersiz
                  kimliğidir.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !placeId.trim()}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'İşletme ekleniyor...' : 'İşletmeyi Ekle'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Daha sonra ekleyeceğim →
          </button>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">İşletme eklendikten sonra:</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>✅ Tüm Google yorumlarınızı görebileceksiniz</li>
            <li>✅ AI ile otomatik cevaplar üretebileceksiniz</li>
            <li>✅ WhatsApp ile anlık bildirimler alabileceksiniz</li>
            <li>✅ Rakip analizi yapabileceksiniz</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
