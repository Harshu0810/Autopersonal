import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RadarChartCard from '../components/RadarChartCard'

export default function PublicResult(){
  const { id } = useParams()
  const [row, setRow] = useState(null)

  useEffect(()=>{
    (async ()=>{
      const { data, error } = await supabase.from('predictions').select('*, profiles!inner(public_handle, display_name)').eq('public_id', id).maybeSingle()
      if (!error) setRow(data)
    })()
  }, [id])

  if (!row) return <div className="max-w-3xl mx-auto p-6">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shared OCEAN Result</h1>
        {row.profiles?.public_handle && (
          <Link to={`/u/${row.profiles.public_handle}`} className="text-brand underline">View profile</Link>
        )}
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <RadarChartCard scores={row.scores} />
        <div className="bg-white rounded-2xl shadow p-4 border border-brand/20 space-y-2">
          <p><span className="font-semibold">Dominant:</span> {row.label}</p>
          <ul className="list-disc pl-6">{Object.entries(row.percentiles||{}).map(([k,v])=> <li key={k}>{k}: {v}%</li>)}</ul>
          <p className="text-sm text-gray-500">Published: {new Date(row.created_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
