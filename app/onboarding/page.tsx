'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function OnboardingPage() {
  const [placeId, setPlaceId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const handleConnectGoogle = () => {
    if (typeof window === 'undefined') return
    window.location.href = '/api/google/authorize'
  }

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true)
    setStatusMessage(null)
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Google bağlantısı kaldırılamadı')
      }

      setGoogleConnected(false)
      setStatusMessage({
        type: 'success',
        text: 'Google bağlantısı kaldırıldı.',
      })
    } catch (err: any) {
      console.error('Disconnect error:', err)
      setStatusMessage({
        type: 'error',
        text: err.message || 'Google bağlantısı kaldırılamadı.',
      })
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  const clearOAuthParams = useCallback(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    params.delete('google')
    params.delete('google_error')
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [])

  const checkConnection = useCallback(async () => {
    setCheckingConnection(true)
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/auth/login')
        return
      }

      const { data: connection, error: connectionError } = await supabase
        .from('google_connections')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (connectionError) {
        console.error('Google connection kontrolü başarısız:', connectionError)
      }

      setGoogleConnected(!!connection)
    } catch (err) {
      console.error('Google connection fetch error:', err)
    } finally {
      setCheckingConnection(false)
    }
  }, [router, supabase])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  useEffect(() => {
    if (!searchParams) return
    if (searchParams.get('google') === 'connected') {
      setGoogleConnected(true)
      setStatusMessage({
        type: 'success',
        text: 'Google hesabınız başarıyla bağlandı!',
      })
      checkConnection()
      clearOAuthParams()
    } else if (searchParams.get('google_error')) {
      setStatusMessage({
        type: 'error',
        text: 'Google bağlantısı sırasında bir hata oluştu.',
      })
      clearOAuthParams()
    }
  }, [searchParams, checkConnection, clearOAuthParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleConnected) {
      setError('Önce Google hesabınızı bağlamalısınız.')
      return
    }
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

  if (checkingConnection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Google bağlantısı kontrol ediliyor...</p>
        </div>
      </div>
    )
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

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm ${
              statusMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {!googleConnected ? (
          <div className="space-y-6">
            <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">
                Google hesabınızı bağlayın
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                ReplyMate, Google Business hesabınıza bağlanarak tüm yorumlarınızı güvenle çeker ve cevaplar.
                Bağlantı kurulmadan işletme ekleyemezsiniz.
              </p>
              <button
                onClick={handleConnectGoogle}
                className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm"
              >
                Google Hesabını Bağla
              </button>
              <ul className="mt-6 space-y-2 text-sm text-gray-600">
                <li>• Bağlantı sadece yorumları senkronize etmek için okunur.</li>
                <li>• Token'lar Supabase'de şifrelenir.</li>
                <li>• Dilediğiniz an bağlantıyı kaldırabilirsiniz.</li>
              </ul>
            </div>

            <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
              <p className="font-medium">Bağlantıdan sonra ne olacak?</p>
              <p className="mt-2">
                Google hesabınız doğrulanır doğrulanmaz bu ekrana geri yönlendirileceksiniz ve işletmenizi Place ID ile ekleyebileceksiniz.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 p-5 border border-gray-200 rounded-xl bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">İşletmeni ekle</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Google hesabın bağlı. Şimdi Place ID ile işletmeni ReplyMate'e tanıt.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                disabled={disconnectingGoogle}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                {disconnectingGoogle ? 'Bağlantı kaldırılıyor...' : 'Google bağlantısını kaldır'}
              </button>
            </div>

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
        )}

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
