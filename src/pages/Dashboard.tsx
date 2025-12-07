import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import RadarChart from '../components/RadarChart';
import { BIG5_ITEMS } from '../lib/big5_items';
import { Upload, FileText, TrendingUp, Share2, Download } from 'lucide-react';

type Scores = { O: number; C: number; E: number; A: number; N: number };

const traitInfo = {
  O: { name: 'Openness', color: '#8b5cf6', icon: '🎨' },
  C: { name: 'Conscientiousness', color: '#3b82f6', icon: '📋' },
  E: { name: 'Extraversion', color: '#10b981', icon: '👥' },
  A: { name: 'Agreeableness', color: '#f59e0b', icon: '🤝' },
  N: { name: 'Neuroticism', color: '#ef4444', icon: '😰' },
};

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [responses, setResponses] = useState<number[]>(Array(50).fill(3));
  const [results, setResults] = useState<{
    scores: Scores;
    label: string;
    percentiles: any;
  } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'text' | 'survey'>('text');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(prof);
      const { data: preds } = await supabase
        .from('predictions')
        .select('id,created_at,input_type,label,share,public_id')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecent(preds || []);
    })();
  }, [session]);

  const computeSurveyScores = useMemo(() => {
    const sums: any = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const counts: any = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    BIG5_ITEMS.forEach((item, idx) => {
      let v = responses[idx];
      if (item.reverse) v = 6 - v;
      sums[item.trait] += v;
      counts[item.trait]++;
    });
    const avg: any = {};
    (['O', 'C', 'E', 'A', 'N'] as const).forEach(
      (k) => (avg[k] = sums[k] / counts[k])
    );
    const norm: any = {};
    (['O', 'C', 'E', 'A', 'N'] as const).forEach(
      (k) => (norm[k] = (avg[k] - 1) / 4)
    );
    return { avg, norm };
  }, [responses]);

  const analyze = async (mode: 'text' | 'survey') => {
    if (!session) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const token = session.access_token;
      const payload: any = { type: mode };
      if (mode === 'text') payload.text = text;
      else payload.responses = responses;
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || data?.error || 'Failed');
      } else {
        setResults({
          scores: data.scores,
          label: data.label,
          percentiles: data.percentiles,
        });
        const { data: preds } = await supabase
          .from('predictions')
          .select('id,created_at,input_type,label,share,public_id')
          .order('created_at', { ascending: false })
          .limit(10);
        setRecent(preds || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  OCEAN Personality
                </h1>
                <p className="text-gray-600">
                  Advanced Big Five personality analysis
                </p>
              </div>
            </div>
            {profile && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {profile.display_name}
                  </p>
                  <p className="text-sm text-gray-500">@{profile.public_handle}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">👤</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 px-6 py-4 font-medium transition ${
                    activeTab === 'text'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="inline w-5 h-5 mr-2" />
                  Text Analysis
                </button>
                <button
                  onClick={() => setActiveTab('survey')}
                  className={`flex-1 px-6 py-4 font-medium transition ${
                    activeTab === 'survey'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📋 IPIP-50 Survey
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'text' ? (
                  <div className="space-y-4">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                      placeholder="Describe yourself, your thoughts, behaviors, and preferences..."
                    />
                    <p className="text-sm text-gray-500">
                      {text.length} / 4000 characters
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {BIG5_ITEMS.map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition"
                      >
                        <p className="text-sm text-gray-700 mb-3">
                          <span className="font-bold text-purple-600">
                            Q{item.id}.
                          </span>{' '}
                          {item.text}
                        </p>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500 w-20">
                            Disagree
                          </span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={responses[idx]}
                            onChange={(e) => {
                              const a = responses.slice();
                              a[idx] = Number(e.target.value);
                              setResponses(a);
                            }}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-16">
                            Agree
                          </span>
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="font-bold text-purple-700">
                              {responses[idx]}
                            </span>
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
                  disabled={loading || (activeTab === 'text' && !text.trim())}
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition transform hover:scale-105 shadow-lg"
                >
                  {loading ? 'Analyzing...' : '🔍 Analyze Personality'}
                </button>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Your Results
                  </h2>
                  <div className="flex space-x-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <RadarChart scores={results.scores} />
                </div>

                <div className="space-y-4">
                  {Object.entries(results.scores).map(([trait, score]) => (
                    <div
                      key={trait}
                      className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-semibold">
                          {(traitInfo as any)[trait].icon}{' '}
                          {(traitInfo as any)[trait].name}
                        </span>
                        <span
                          className="text-2xl font-bold"
                          style={{ color: (traitInfo as any)[trait].color }}
                        >
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${score * 100}%`,
                            backgroundColor: (traitInfo as any)[trait].color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {results && (
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-sm font-medium opacity-90 mb-2">
                  Dominant Trait
                </h3>
                <h2 className="text-4xl font-bold mb-4">{results.label}</h2>
                <p className="text-sm opacity-90">
                  This is your highest scoring dimension
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Recent Analyses
              </h3>
              <div className="space-y-3">
                {recent.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition"
                  >
                    <p className="font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
