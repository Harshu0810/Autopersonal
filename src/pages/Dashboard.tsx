import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import RadarChart from '../components/RadarChart'
import { BIG5_ITEMS } from '../lib/big5_items'
import { FileText, ClipboardList, TrendingUp, Share2, Download, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Scores = { O: number; C: number; E: number; A: number; N: number }

const traitInfo = {
  O: { name: 'Openness', color: '#8b5cf6', icon: '🎨', desc: 'Imagination and openness to new experiences' },
  C: { name: 'Conscientiousness', color: '#3b82f6', icon: '📋', desc: 'Organization and dependability' },
  E: { name: 'Extraversion', color: '#10b981', icon: '👥', desc: 'Sociability and energy level' },
  A: { name: 'Agreeableness', color: '#f59e0b', icon: '🤝', desc: 'Compassion and cooperation' },
  N: { name: 'Neuroticism', color: '#ef4444', icon: '😰', desc: 'Emotional stability' }
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [responses, setResponses] = useState<number[]>(Array(50).fill(3))
  const [results, setResults] = useState<{ scores: Scores; label: string; percentiles: any } | null>(null)
  const [recent, setRecent] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'text' | 'survey'>('text')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      const { data: preds } = await supabase.from('predictions').select('id,created_at,input_type,label,share,public_id').order('created_at', { ascending: false }).limit(10)
      setRecent(preds || [])
    })()
  }, [session])

  const computeSurveyScores = useMemo(() => {
    const sums: any = { O: 0, C: 0, E: 0, A: 0, N: 0 }
    const counts: any = { O: 0, C: 0, E: 0, A: 0, N: 0 }
    BIG5_ITEMS.forEach((item, idx) => {
      let v = responses[idx]
      if (item.reverse) v = 6 - v
      sums[item.trait] += v
      counts[item.trait]++
    })
    const avg: any = {};
    (['O', 'C', 'E', 'A', 'N'] as const).forEach((k) => (avg[k] = sums[k] / counts[k]))
    const norm: any = {};
    (['O', 'C', 'E', 'A', 'N'] as const).forEach((k) => (norm[k] = (avg[k] - 1) / 4))
    return { avg, norm }
  }, [responses])

  const analyze = async (mode: 'text' | 'survey') => {
    if (!session) return
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const token = session.access_token
      const payload: any = { type: mode }
      if (mode === 'text') payload.text = text
      else payload.responses = responses
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Failed')
      } else {
        setResults({ scores: data.scores, label: data.label, percentiles: data.percentiles })
        const { data: preds } = await supabase.from('predictions').select('id,created_at,input_type,label,share,public_id').order('created_at', { ascending: false }).limit(10)
        setRecent(preds || [])
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const barData = results ? Object.entries(results.scores).map(([trait, value]) => ({
    trait: (traitInfo as any)[trait].name,
    score: Math.round(value * 100)
  })) : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Personality Analysis</h1>
                <p className="text-gray-600">Big Five (OCEAN) Assessment</p>
              </div>
            </div>
            {profile && (
              <div className="text-right">
                <p className="font-semibold text-gray-900">{profile.display_name}</p>
                <p className="text-sm text-gray-500">@{profile.public_handle}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('text')} className={`flex-1 px-6 py-4 font-medium transition ${activeTab === 'text' ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <FileText className="inline w-5 h-5 mr-2" />
                  Text Analysis
                </button>
                <button onClick={() => setActiveTab('survey')} className={`flex-1 px-6 py-4 font-medium transition ${activeTab === 'survey' ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <ClipboardList className="inline w-5 h-5 mr-2" />
                  IPIP-50 Survey
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'text' ? (
                  <div className="space-y-4">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition" placeholder="Describe yourself, your thoughts, behaviors, preferences..." />
                    <p className="text-sm text-gray-500">{text.length} / 4000 characters</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {BIG5_ITEMS.map((item, idx) => (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition">
                        <p className="text-sm text-gray-700 mb-3">
                          <span className="font-bold text-purple-600">Q{item.id}.</span> {item.text}
                          {item.reverse && <span className="text-xs text-gray-500 ml-2">(reverse)</span>}
                        </p>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 w-20">Disagree</span>
                          <input type="range" min="1" max="5" value={responses[idx]} onChange={(e) => { const a = responses.slice(); a[idx] = Number(e.target.value); setResponses(a) }} className="flex-1" />
                          <span className="text-xs text-gray-500 w-16">Agree</span>
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="font-bold text-purple-700">{responses[idx]}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {error && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>}

                <button onClick={() => analyze(activeTab)} disabled={loading || (activeTab === 'text' && !text.trim())} className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition transform hover:scale-105 shadow-lg">
                  {loading ? 'Analyzing...' : '🔍 Analyze Personality'}
                </button>
              </div>
            </div>

            {results && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900
