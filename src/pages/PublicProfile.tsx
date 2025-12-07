import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicProfile() {
  const { handle } = useParams()
  const [rows, setRows] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('*').eq('public_handle', handle).single()
      setUser(prof)
      if (prof) {
        const { data } = await supabase.from('shared_predictions').select('*').like('public_handle', handle!).order('created_at', { ascending: false })
        setRows(data || [])
      }
    })()
  }, [handle])

  if (!user) return <div className="p-16 text-center">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
        <h1 className="text-4xl font-bold mb-2">@{user.public_handle}</h1>
        <p className="text-gray-600">{user.display_name}</p>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Shared Results</h2>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <a href={`/p/${r.public_id}`} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100">
                {new Date(r.created_at).toLocaleDateString()} — {r.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
