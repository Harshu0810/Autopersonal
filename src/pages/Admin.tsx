import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('predictions').select('*').order('created_at', { ascending: false }).limit(100)
      setRows(data || [])
    })()
  }, [])

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Admin - Latest Predictions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">When</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{r.id}</td>
                  <td className="px-4 py-3 text-sm">{r.user_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{r.input_type}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
