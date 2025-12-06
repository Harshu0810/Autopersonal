import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AuthGate from '../components/AuthGate.jsx'
import RadarChartCard from '../components/RadarChartCard.jsx'
import { Link } from 'react-router-dom'

const API = 'https://autopersonal.vercel.app/api/predict'

export default function App(){ return (<AuthGate><Shell /></AuthGate>) }

function Shell(){
  const [tab, setTab] = useState('dashboard'); const [profile, setProfile] = useState(null)

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user){
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data)
    }
  }

  useEffect(()=>{ loadProfile() },[])

  const saveHandle = async (updates) => {
    await supabase.from('profiles').update(updates).eq('id', profile.id)
    await loadProfile()
  }

  const profileUrl = profile?.public_handle ? `${window.location.origin}/u/${profile.public_handle}` : null

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between bg-white/70 backdrop-blur rounded-2xl p-3 border border-brand/20">
        <h1 className="text-2xl sm:text-3xl font-bold">OCEAN Personality</h1>
        <div className="flex gap-2 items-center">
          {profileUrl && <a href={profileUrl} className="text-brand underline" target="_blank">Public profile</a>}
          <button className={`px-3 py-1 rounded ${tab==='dashboard'?'bg-brand/10 border border-brand/40':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
          {profile?.is_admin && <button className={`px-3 py-1 rounded ${tab==='admin'?'bg-brand/10 border border-brand/40':''}`} onClick={()=>setTab('admin')}>Admin</button>}
          <button className="px-3 py-1 rounded bg-brand text-white" onClick={()=>supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <h3 className="text-lg font-semibold mb-2">Public profile settings</h3>
        {!profile ? <p>Loading...</p> : (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Handle (unique)</label>
              <div className="flex gap-2">
                <input className="w-full border rounded-xl p-2" value={profile.public_handle || ''} onChange={e=>setProfile({...profile, public_handle: e.target.value.replace(/[^a-z0-9_]/g,'')})} placeholder="yourname" />
                <button className="px-3 py-2 rounded bg-brand text-white" onClick={()=>saveHandle({ public_handle: profile.public_handle })}>Save</button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Allowed: lowercase letters, numbers, underscore.</p>
            </div>
            <div>
              <label className="text-sm">Display name</label>
              <div className="flex gap-2">
                <input className="w-full border rounded-xl p-2" value={profile.display_name || ''} onChange={e=>setProfile({...profile, display_name: e.target.value})} />
                <button className="px-3 py-2 rounded bg-brand text-white" onClick={()=>saveHandle({ display_name: profile.display_name })}>Save</button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm">Bio</label>
              <textarea className="w-full border rounded-xl p-2" rows={2} value={profile.bio || ''} onChange={e=>setProfile({...profile, bio: e.target.value})} />
              <button className="mt-2 px-3 py-2 rounded bg-brand text-white" onClick={()=>saveHandle({ bio: profile.bio })}>Save bio</button>
            </div>
            <div>
              <label className="text-sm">Public visibility</label>
              <div className="flex items-center gap-2">
                <input id="is_public" type="checkbox" checked={!!profile.is_public} onChange={e=>setProfile({...profile, is_public: e.target.checked})} />
                <label htmlFor="is_public">Make my profile public</label>
                <button className="ml-2 px-3 py-2 rounded bg-brand text-white" onClick={()=>saveHandle({ is_public: profile.is_public })}>Apply</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {tab==='dashboard' ? <Dashboard /> : <Admin />}
    </div>
  )
}

function toCsv(rows){
  if (!rows?.length) return ''
  const keys = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')
}
function download(name, text){
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

function Dashboard(){
  const [mode, setMode] = useState('text'); const [text, setText] = useState('')
  const [responses, setResponses] = useState(Array(20).fill(3)); const [result, setResult] = useState(null)
  const [history, setHistory] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null)

  const loadHistory = async () => {
    const { data } = await supabase.from('predictions').select('id, created_at, input_type, label, percentiles, scores, public_id, share').order('created_at',{ ascending:false }).limit(200)
    setHistory(data || [])
  }
  useEffect(()=>{ loadHistory() }, [])

  const analyze = async () => {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = mode==='text' ? { type:'text', text } : { type:'survey', responses }
      const res = await fetch(API, { method:'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify(payload) })
      const out = await res.json(); if (!res.ok) throw new Error(out?.error || 'Failed')
      setResult(out); await loadHistory()
    } catch (e){ setError(e.message) } finally { setLoading(false) }
  }

  const exportCsv = () => {
    const rows = history.map(h => ({
      id: h.id, created_at: h.created_at, input_type: h.input_type, label: h.label,
      O: h.percentiles?.O ?? Math.round((h.scores?.O||0)*100),
      C: h.percentiles?.C ?? Math.round((h.scores?.C||0)*100),
      E: h.percentiles?.E ?? Math.round((h.scores?.E||0)*100),
      A: h.percentiles?.A ?? Math.round((h.scores?.A||0)*100),
      N: h.percentiles?.N ?? Math.round((h.scores?.N||0)*100),
      share: h.share, public_id: h.public_id
    }))
    download('my_predictions.csv', toCsv(rows))
  }

  const toggleShare = async (row) => {
    await supabase.from('predictions').update({ share: !row.share }).eq('id', row.id)
    await loadHistory()
  }

  const copyLink = (row) => {
    const url = `${window.location.origin}/result/${row.public_id}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <div className="flex gap-2 mb-3">
          <button className={`px-3 py-1 rounded ${mode==='text'?'bg-brand/10 border border-brand/40':''}`} onClick={()=>setMode('text')}>Text</button>
          <button className={`px-3 py-1 rounded ${mode==='survey'?'bg-brand/10 border border-brand/40':''}`} onClick={()=>setMode('survey')}>Survey</button>
          <div className="flex-1" />
          <button className="px-3 py-1 rounded border" onClick={exportCsv}>Export CSV</button>
        </div>
        {mode==='text' ? (
          <textarea className="w-full border rounded-xl p-3 min-h-[140px]" placeholder="Paste text..." value={text} onChange={e=>setText(e.target.value)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {responses.map((v,i)=> (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <span className="text-sm w-10">Q{i+1}</span>
                <input type="range" min="1" max="5" value={v} onChange={e=>{ const arr=[...responses]; arr[i]=Number(e.target.value); setResponses(arr) }} className="flex-1" />
                <span className="w-6 text-right">{v}</span>
              </div>
            ))}
          </div>
        )}
        <button className="mt-3 px-4 py-2 rounded-xl bg-brand text-white disabled:opacity-50" disabled={loading} onClick={analyze}>{loading?'Working...':'Analyze'}</button>
        {error && <div className="mt-2 bg-red-100 border text-red-800 rounded-xl p-2">{error}</div>}
      </div>

      {result && (
        <section className="grid md:grid-cols-2 gap-4">
          <RadarChartCard scores={result.scores} />
          <div className="bg-white rounded-2xl shadow p-4 border border-brand/20 space-y-2">
            <h3 className="text-lg font-semibold">Result</h3>
            <p><span className="font-semibold">Dominant:</span> {result.label}</p>
            <ul className="list-disc pl-6">{Object.entries(result.percentiles).map(([k,v])=> <li key={k}>{k}: {v}%</li>)}</ul>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <h3 className="text-lg font-semibold mb-2">Your recent predictions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left p-2">When</th><th className="text-left p-2">Type</th><th className="text-left p-2">Label</th><th className="text-left p-2">Share</th><th className="text-left p-2">Link</th></tr></thead>
            <tbody>{history.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.input_type}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2">
                  <button className="px-2 py-1 rounded border" onClick={()=>toggleShare(r)}>{r.share ? 'Unshare' : 'Share'}</button>
                </td>
                <td className="p-2">
                  <button className="px-2 py-1 rounded border" onClick={()=>copyLink(r)}>Copy</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Admin(){
  const [users, setUsers] = useState([]); const [preds, setPreds] = useState([])

  const load = async () => {
    const { data: p } = await supabase.from('predictions').select('*, profiles!inner(email)').order('created_at',{ ascending:false }).limit(500)
    setPreds(p || [])
    const { data: u } = await supabase.from('profiles').select('id, email, is_admin, display_name, public_handle, is_public, created_at').order('created_at',{ ascending:false }).limit(500)
    setUsers(u || [])
  }
  useEffect(()=>{ load() },[])

  const toggleAdmin = async (user) => {
    await supabase.from('profiles').update({ is_admin: !user.is_admin }).eq('id', user.id)
    await load()
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <h3 className="text-lg font-semibold mb-2">Users</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left p-2">Email</th><th className="text-left p-2">Handle</th><th className="text-left p-2">Public</th><th className="p-2">Admin</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.public_handle || '-'}</td>
                  <td className="p-2">{u.is_public ? 'Yes' : 'No'}</td>
                  <td className="p-2">
                    <button className="px-3 py-1 rounded bg-brand text-white" onClick={()=>toggleAdmin(u)}>
                      {u.is_admin ? 'Revoke' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 border border-brand/20">
        <h3 className="text-lg font-semibold mb-2">Recent predictions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left p-2">When</th><th className="text-left p-2">User</th><th className="text-left p-2">Type</th><th className="text-left p-2">Label</th></tr></thead>
            <tbody>
              {preds.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{r.profiles?.email}</td>
                  <td className="p-2">{r.input_type}</td>
                  <td className="p-2">{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
