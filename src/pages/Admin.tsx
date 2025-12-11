// ====================
// FILE: src/pages/Admin.tsx (COMPLETE REWRITE)
// ====================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { 
  Users, 
  Download, 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  FileText,
  Eye,
  Search,
  ChevronDown
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'

const COLORS = {
  O: '#8b5cf6',
  C: '#3b82f6', 
  E: '#10b981',
  A: '#f59e0b',
  N: '#ef4444'
}

const TRAIT_NAMES = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism'
}

export default function Admin() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'text' | 'survey'>('all')
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPredictions: 0,
    avgScores: { O: 0, C: 0, E: 0, A: 0, N: 0 },
    traitDistribution: { O: 0, C: 0, E: 0, A: 0, N: 0 }
  })
  const nav = useNavigate()

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        nav('/')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (!profile?.is_admin) {
        alert('Access denied: Admin only')
        nav('/dashboard')
        return
      }

      setIsAdmin(true)
      loadData()
    }
    checkAdmin()
  }, [nav])

  // Real-time subscription
  useEffect(() => {
    if (!isAdmin) return

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'predictions' },
        (payload) => {
          console.log('Real-time update:', payload)
          loadData() // Reload data on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAdmin])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all predictions with user info
      const { data: preds, error: predError } = await supabase
        .from('predictions')
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            display_name,
            public_handle
          )
        `)
        .order('created_at', { ascending: false })

      if (predError) throw predError

      setPredictions(preds || [])

      // Load users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      setUsers(usersData || [])

      // Calculate statistics
      if (preds && preds.length > 0) {
        const totalUsers = new Set(preds.map(p => p.user_id)).size
        
        // Average scores
        const avgScores = { O: 0, C: 0, E: 0, A: 0, N: 0 }
        preds.forEach(p => {
          Object.keys(avgScores).forEach(trait => {
            avgScores[trait as keyof typeof avgScores] += p.scores[trait] || 0
          })
        })
        Object.keys(avgScores).forEach(trait => {
          avgScores[trait as keyof typeof avgScores] = avgScores[trait as keyof typeof avgScores] / preds.length
        })

        // Trait distribution (dominant traits)
        const traitDist = { O: 0, C: 0, E: 0, A: 0, N: 0 }
        preds.forEach(p => {
          if (p.label) {
            const key = Object.keys(TRAIT_NAMES).find(k => TRAIT_NAMES[k as keyof typeof TRAIT_NAMES] === p.label)
            if (key) traitDist[key as keyof typeof traitDist]++
          }
        })

        setStats({
          totalUsers,
          totalPredictions: preds.length,
          avgScores,
          traitDistribution: traitDist
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = (type: 'predictions' | 'users' | 'grouped') => {
    let csvContent = ''
    let filename = ''

    if (type === 'predictions') {
      csvContent = 'ID,User Email,Type,Label,Created At,O,C,E,A,N\n'
      predictions.forEach(p => {
        csvContent += `${p.id},"${p.profiles?.email || 'N/A'}",${p.input_type},${p.label},${new Date(p.created_at).toLocaleString()},${p.scores.O},${p.scores.C},${p.scores.E},${p.scores.A},${p.scores.N}\n`
      })
      filename = 'predictions_export.csv'
    } else if (type === 'users') {
      csvContent = 'ID,Email,Display Name,Handle,Created At,Total Predictions\n'
      users.forEach(u => {
        const predCount = predictions.filter(p => p.user_id === u.id).length
        csvContent += `${u.id},"${u.email}","${u.display_name}","${u.public_handle}",${new Date(u.created_at).toLocaleString()},${predCount}\n`
      })
      filename = 'users_export.csv'
    } else if (type === 'grouped') {
      csvContent = 'Personality Trait,User Count,User Emails\n'
      Object.entries(stats.traitDistribution).forEach(([trait, count]) => {
        const traitUsers = predictions
          .filter(p => p.label === TRAIT_NAMES[trait as keyof typeof TRAIT_NAMES])
          .map(p => p.profiles?.email || 'N/A')
          .filter((v, i, a) => a.indexOf(v) === i)
        csvContent += `${TRAIT_NAMES[trait as keyof typeof TRAIT_NAMES]},${count},"${traitUsers.join(', ')}"\n`
      })
      filename = 'grouped_by_personality.csv'
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  const filteredPredictions = predictions.filter(p => {
    const matchesSearch = searchTerm === '' || 
      p.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.label?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterType === 'all' || p.input_type === filterType
    
    return matchesSearch && matchesFilter
  })

  const traitDistributionData = Object.entries(stats.traitDistribution).map(([trait, count]) => ({
    name: TRAIT_NAMES[trait as keyof typeof TRAIT_NAMES],
    value: count,
    trait
  }))

  const avgScoresData = Object.entries(stats.avgScores).map(([trait, score]) => ({
    name: TRAIT_NAMES[trait as keyof typeof TRAIT_NAMES],
    score: Math.round(score * 100),
    trait
  }))

  const timelineData = predictions
    .slice(0, 30)
    .reverse()
    .map((p, i) => ({
      index: i + 1,
      date: new Date(p.created_at).toLocaleDateString(),
      predictions: predictions.filter(pred => 
        new Date(pred.created_at).toLocaleDateString() === new Date(p.created_at).toLocaleDateString()
      ).length
    }))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600">Real-time personality analytics</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white">
            <Users className="w-8 h-8 mb-4 opacity-80" />
            <p className="text-sm opacity-90">Total Users</p>
            <p className="text-4xl font-bold">{stats.totalUsers}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
            <BarChart3 className="w-8 h-8 mb-4 opacity-80" />
            <p className="text-sm opacity-90">Total Predictions</p>
            <p className="text-4xl font-bold">{stats.totalPredictions}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl shadow-lg p-6 text-white">
            <TrendingUp className="w-8 h-8 mb-4 opacity-80" />
            <p className="text-sm opacity-90">Avg per User</p>
            <p className="text-4xl font-bold">
              {stats.totalUsers > 0 ? (stats.totalPredictions / stats.totalUsers).toFixed(1) : 0}
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trait Distribution Pie Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Personality Distribution</h2>
              <PieChart className="w-6 h-6 text-gray-600" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={traitDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(data) => setSelectedTrait(data.trait)}
                  style={{ cursor: 'pointer' }}
                >
                  {traitDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.trait as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <p className="text-sm text-gray-500 text-center mt-4">
              Click on a segment to filter users by personality
            </p>
          </div>

          {/* Average Scores Bar Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Average Trait Scores</h2>
              <BarChart3 className="w-6 h-6 text-gray-600" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={avgScoresData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {avgScoresData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.trait as keyof typeof COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Activity Timeline (Last 30 Entries)</h2>
            <Calendar className="w-6 h-6 text-gray-600" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="predictions" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Export Buttons */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Export Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => downloadCSV('predictions')}
              className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Download className="w-5 h-5 mr-2" />
              All Predictions
            </button>
            <button
              onClick={() => downloadCSV('users')}
              className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Download className="w-5 h-5 mr-2" />
              All Users
            </button>
            <button
              onClick={() => downloadCSV('grouped')}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download className="w-5 h-5 mr-2" />
              Grouped by Personality
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email, name, or trait..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
            <div className="flex space-x-2">
              {['all', 'text', 'survey'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as any)}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
                    filterType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Trait Users */}
        {selectedTrait && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Users with {TRAIT_NAMES[selectedTrait as keyof typeof TRAIT_NAMES]} Personality
              </h2>
              <button
                onClick={() => setSelectedTrait(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                Clear Filter
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions
                .filter(p => p.label === TRAIT_NAMES[selectedTrait as keyof typeof TRAIT_NAMES])
                .map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-4 border-2" style={{ borderColor: COLORS[selectedTrait as keyof typeof COLORS] }}>
                    <p className="font-semibold text-gray-900">{p.profiles?.display_name || 'User'}</p>
                    <p className="text-sm text-gray-600">{p.profiles?.email}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Detailed Predictions Table */}
        <div className="bg-white rounded-2xl shadow-lg p-6 overflow-hidden">
          <h2 className="text-xl font-bold text-gray-900 mb-4">All Predictions ({filteredPredictions.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dominant Trait</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Scores</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPredictions.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{p.profiles?.display_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{p.profiles?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        p.input_type === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {p.input_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: COLORS[Object.keys(TRAIT_NAMES).find(k => TRAIT_NAMES[k as keyof typeof TRAIT_NAMES] === p.label) as keyof typeof COLORS] || '#666' }}
                      >
                        {p.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-1">
                        {Object.entries(p.scores).map(([trait, score]) => (
                          <div key={trait} className="text-center">
                            <div 
                              className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: COLORS[trait as keyof typeof COLORS] }}
                            >
                              {Math.round((score as number) * 100)}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trait}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
