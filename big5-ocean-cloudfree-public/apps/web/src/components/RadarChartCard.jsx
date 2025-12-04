import React from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
export default function RadarChartCard({ scores }){
  const data = ['O','C','E','A','N'].map(k=>({trait:k, value: Math.round((scores?.[k]||0)*100)}))
  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-brand/20">
      <h3 className="text-lg font-semibold mb-2">OCEAN Profile</h3>
      <div className="w-full h-80">
        <ResponsiveContainer>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="trait" />
            <PolarRadiusAxis angle={30} domain={[0,100]} />
            <Radar name="Score" dataKey="value" />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
