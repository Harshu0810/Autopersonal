// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import RadarChart from '../components/RadarChart'
import { BIG5_ITEMS } from '../lib/big5_items'
import { FileText, ClipboardList, TrendingUp } from 'lucide-react'
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

type Scores = { O: number; C: number; E: number; A: number; N: number }
type ResultPayload = { scores: Scores; label: string; percentiles: any }

const traitInfo: Record<keyof Scores, { name: string; color: string; icon: string }> = {
  O: { name: 'Openness',          color: '#8b5cf6', icon: '🎨' },
  C: { name: 'Conscientiousness', color: '#3b82f6', icon: '📋' },
  E: { name: 'Extraversion',      color: '#10b981', icon: '👥' },
  A: { name: 'Agreeableness',     color: '#f59e0b', icon: '🤝' },
  N: { name: 'Neuroticism',       color: '#ef4444', icon: '😰' }
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [responses, setResponses] = useState<number[]>(Array(50).fill(3))
  const [results, setResults] = useState<ResultPayload | null>(null)
  const [recent, setRecent] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'text' | 'survey'>('text')

  // Get auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  // Admin debug check (console)
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, email')
        .eq('id', session.user.id)
        .single()
      // Debug
      console.log('=== ADMIN CHECK ===')
      console.log('Email:', profile?.email)
      console.log('Is Admin:', profile?.is_admin)
      console.log('===================')
    }
    checkAdminStatus()
  }, [])

  // Load profile + recent predictions
  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(prof)

      const { data: preds } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setRecent(preds || [])
    })()
  }, [session])

  const analyze = async (mode: 'text' | 'survey') => {
    if (!session) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const token = session.access_token
      const payload: any = { type: mode }
      if (mode === 'text') {
        payload.text = text
      } else {
        if (responses.length !== 50) {
          setError('Survey must have 50 responses.')
          setLoading(false)
          return
        }
        payload.responses = responses
      }

      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Failed')
      } else {
        const typed: ResultPayload = {
          scores: data.scores,
          label: data.label,
          percentiles: data.percentiles
        }
        setResults(typed)

        const { data: preds } = await supabase
          .from('predictions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
        setRecent(preds || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const barData =
    results
      ? (Object.entries(results.scores) as [keyof Scores, number][])
          .map(([t, v]) => ({ trait: traitInfo[t].name, score: Math.round(v * 100) }))
      : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Personality Analysis</h1>
                <p className="text-gray-600">Big Five Assessment</p>
              </div>
            </div>
            {profile && (
              <div className="text-right">
                <p className="font-semibold text-gray-900">{profile.display_name || 'User'}</p>
                {profile.public_handle && (
                  <p className="text-sm text-gray-500">@{profile.public_handle}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: input + results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs & Inputs */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 px-6 py-4 font-medium ${
                    activeTab === 'text'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <FileText className="inline w-5 h-5 mr-2" />
                  Text
                </button>
                <button
                  onClick={() => setActiveTab('survey')}
                  className={`flex-1 px-6 py-4 font-medium ${
                    activeTab === 'survey'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <ClipboardList className="inline w-5 h-5 mr-2" />
                  Survey
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'text' ? (
                  <div className="space-y-4">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      placeholder="Describe yourself (min ~50 words for best analysis)..."
                    />
                    <p className="text-sm text-gray-500">{text.trim().split(/\s+/).filter(Boolean).length} words</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {BIG5_ITEMS.map((item, idx) => (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm mb-3">
                          <span className="font-bold text-purple-600">Q{item.id}.</span> {item.text}
                          {item.reverse && <em className="text-xs text-gray-400 ml-2">(reverse)</em>}
                        </p>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 w-20">Disagree</span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={responses[idx]}
                            onChange={(e) => {
                              const a = [...responses]
                              a[idx] = Number(e.target.value)
                              setResponses(a)
                            }}
                            className="flex-1"
                          />
                          <span className="text-xs w-16 text-right">Agree</span>
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="font-bold text-purple-700">{responses[idx]}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => analyze(activeTab)}
                  disabled={
                    loading ||
                    (activeTab === 'text' && !text.trim())
                  }
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Analyzing...' : '🔍 Analyze'}
                </button>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Results</h2>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <RadarChart scores={results.scores} />
                  <ResponsiveContainer width="100%" height={400}>
                    <ReBarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="trait" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {(Object.entries(results.scores) as [keyof Scores, number][])
                    .map(([t, v]) => (
                      <div key={t} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between mb-2">
                          <span className="font-semibold">
                            {traitInfo[t].icon} {traitInfo[t].name}
                          </span>
                          <span
                            className="text-2xl font-bold"
                            style={{ color: traitInfo[t].color }}
                          >
                            {Math.round(v * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${v * 100}%`, backgroundColor: traitInfo[t].color }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: summary cards + recent */}
          <div className="space-y-6">
            {results && (
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-sm opacity-90 mb-2">Dominant Trait</h3>
                <h2 className="text-4xl font-bold">{results.label}</h2>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Recent</h3>
              <div className="space-y-3">
                {recent.slice(0, 5).map((r) => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer">
                    <p className="font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {recent.length === 0 && (
                  <p className="text-sm text-gray-500">No predictions yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
