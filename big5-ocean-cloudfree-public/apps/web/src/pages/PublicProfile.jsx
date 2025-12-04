import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PublicProfile(){
  const { handle } = useParams()
  const [profile, setProfile] = useState(null)
  const [preds, setPreds] = useState([])

  useEffect(()=>{
    (async ()=>{
      const { data: prof } = await supabase.from('profiles').select('id, display_name, public_handle, bio, avatar_url, created_at').eq('public_handle', handle).maybeSingle()
      setProfile(prof || null)
      if (prof){
        const { data: rows } = await supabase.from('predictions').select('public_id, label, percentiles, created_at, input_type').eq('user_id', prof.id).eq('share', true).order('created_at',{ ascending: false }).limit(100)
        setPreds(rows || [])
      }
    })()
  }, [handle])

  if (!profile) return <div className="max-w-4xl mx-auto p-6">Profile not found.</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xl">
          {profile.display_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name || profile.public_handle}</h1>
          <p className="text-gray-600">@{profile.public_handle}</p>
          {profile.bio && <p className="text-sm mt-1">{profile.bio}</p>}
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <h3 className="text-lg font-semibold mb-2">Shared results</h3>
        {preds.length === 0 ? <p className="text-sm text-gray-600">No shared predictions yet.</p> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {preds.map(r => (
              <Link to={`/result/${r.public_id}`} key={r.public_id} className="border border-brand/20 rounded-xl p-3 hover:bg-brand/5">
                <div className="text-sm text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                <div className="font-semibold">{r.label}</div>
                <div className="text-xs text-gray-600">Type: {r.input_type}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
