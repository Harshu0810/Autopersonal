import {
  Radar,
  RadarChart as RC,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

type Scores = { O: number; C: number; E: number; A: number; N: number }

const traitNames = {
  O: 'Openness',
  C: 'Conscientiousness',
  E: 'Extraversion',
  A: 'Agreeableness',
  N: 'Neuroticism'
}

export default function RadarChart({ scores }: { scores: Scores }) {
  const data = Object.entries(scores).map(([trait, value]) => ({
    trait: traitNames[trait as keyof typeof traitNames],
    value: Math.round(value * 100),
    fullMark: 100
  }))

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <RC data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="trait" 
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
          />
          <PolarRadiusAxis 
            domain={[0, 100]} 
            tick={{ fill: '#6b7280', fontSize: 10 }}
            angle={90}
          />
          <Tooltip />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.6}
          />
        </RC>
      </ResponsiveContainer>
    </div>
  )
}
