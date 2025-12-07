import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import RadarChart from '../components/RadarChart'

export default function PublicPrediction() {
  const { id } = useParams()
  const [row, setRow] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('predictions').select('*').eq('public_id', id).eq('share', true).single()
      setRow(data)
    })()
  }, [id])

  if (!row) return <div className="p-16 text-center">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Shared OCEAN Result</h1>
        <div className="mb-6">
          <p className="text-xl">Top trait: <strong>{row.label}</strong></p>
        </div>
        <RadarChart scores={row.scores} />
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <pre className="text-sm">{JSON.stringify(row.percentiles, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
