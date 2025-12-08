// ====================
// FILE: api/predict.ts (HYBRID: Rule-based Text + Survey)
// ====================
export const config = { runtime: 'edge' }

const OCEAN_KEYS = ['O', 'C', 'E', 'A', 'N']

const jsonResponse = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })

const getTopLabel = (scores: Record<string, number>) => {
  const names = {
    O: 'Openness',
    C: 'Conscientiousness',
    E: 'Extraversion',
    A: 'Agreeableness',
    N: 'Neuroticism',
  }
  let best = 'O'
  let max = -1
  for (const [k, v] of Object.entries(scores)) {
    if (Number(v) > max) {
      max = Number(v)
      best = k
    }
  }
  return (names as any)[best]
}

// Advanced linguistic analysis for personality prediction
const analyzeTextForPersonality = (text: string) => {
  const lower = text.toLowerCase()
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  const wordCount = words.length
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount
  const avgSentenceLength = wordCount / sentences.length
  
  // Personality markers based on linguistic research
  const markers = {
    // Openness markers
    openness: {
      abstract: (lower.match(/\b(idea|think|theory|concept|imagine|philosophy|creative|art|novel|complex|abstract|wonder|possibility)\b/g) || []).length,
      intellectual: (lower.match(/\b(learn|study|read|knowledge|understand|analyze|explore|discover|research|science)\b/g) || []).length,
      creative: (lower.match(/\b(create|design|invent|original|unique|artistic|paint|write|compose|innovate)\b/g) || []).length,
      curiosity: (lower.match(/\b(why|how|curious|interest|fascinate|explore|discover|new|different)\b/g) || []).length,
    },
    
    // Conscientiousness markers
    conscientiousness: {
      organization: (lower.match(/\b(plan|organize|schedule|detail|prepare|order|system|structure|arrange|coordinate)\b/g) || []).length,
      achievement: (lower.match(/\b(goal|achieve|accomplish|complete|finish|succeed|task|deadline|target|objective)\b/g) || []).length,
      discipline: (lower.match(/\b(discipline|control|focus|careful|precise|thorough|diligent|responsible|duty)\b/g) || []).length,
      orderly: (lower.match(/\b(clean|neat|tidy|organized|systematic|methodical|efficient|punctual)\b/g) || []).length,
    },
    
    // Extraversion markers
    extraversion: {
      social: (lower.match(/\b(friend|people|party|social|together|group|team|meet|talk|chat|communicate)\b/g) || []).length,
      energy: (lower.match(/\b(excite|energy|active|enthusiastic|lively|dynamic|vibrant|passionate)\b/g) || []).length,
      assertive: (lower.match(/\b(lead|direct|confident|assert|speak|voice|opinion|influence|persuade)\b/g) || []).length,
      gregarious: (lower.match(/\b(we|us|our|everyone|crowd|gathering|company|companionship)\b/g) || []).length,
    },
    
    // Agreeableness markers
    agreeableness: {
      empathy: (lower.match(/\b(feel|care|understand|empathy|sympathy|compassion|concern|support|help)\b/g) || []).length,
      cooperation: (lower.match(/\b(cooperate|collaborate|share|together|team|agree|harmony|peace|unity)\b/g) || []).length,
      kindness: (lower.match(/\b(kind|nice|gentle|warm|friendly|caring|loving|generous|thoughtful)\b/g) || []).length,
      trust: (lower.match(/\b(trust|honest|sincere|genuine|true|loyal|reliable|faithful)\b/g) || []).length,
    },
    
    // Neuroticism markers
    neuroticism: {
      anxiety: (lower.match(/\b(worry|anxious|nervous|stress|fear|scared|afraid|panic|tense)\b/g) || []).length,
      negative: (lower.match(/\b(bad|terrible|horrible|awful|hate|dislike|angry|sad|upset|frustrated)\b/g) || []).length,
      mood: (lower.match(/\b(mood|emotional|feelings|sensitive|hurt|vulnerable|insecure)\b/g) || []).length,
      instability: (lower.match(/\b(unstable|overwhelm|difficult|struggle|problem|issue|challenge)\b/g) || []).length,
    },
  }
  
  // Positive emotion words (inversely related to Neuroticism)
  const positiveWords = (lower.match(/\b(good|great|excellent|wonderful|amazing|happy|joy|love|like|enjoy|pleasant|delightful)\b/g) || []).length
  
  // Personal pronouns (related to focus)
  const firstPerson = (lower.match(/\b(i|me|my|mine|myself)\b/g) || []).length
  const secondPerson = (lower.match(/\b(you|your|yours|yourself)\b/g) || []).length
  const thirdPerson = (lower.match(/\b(he|she|they|them|their|his|her)\b/g) || []).length
  
  // Punctuation patterns
  const exclamations = (text.match(/!/g) || []).length
  const questions = (text.match(/\?/g) || []).length
  
  // Calculate raw scores (0-1 scale)
  const calculateScore = (categoryMarkers: any, bonus = 0) => {
    const total = Object.values(categoryMarkers).reduce((sum: number, val: any) => sum + val, 0)
    const normalized = Math.min(total / wordCount * 50, 1) // Normalize by word count
    return Math.max(0.2, Math.min(0.8, 0.5 + normalized + bonus))
  }
  
  // Calculate personality scores
  const scores = {
    O: calculateScore(markers.openness, avgWordLength > 6 ? 0.1 : 0),
    C: calculateScore(markers.conscientiousness, avgSentenceLength > 20 ? 0.1 : 0),
    E: calculateScore(markers.extraversion, exclamations > 2 ? 0.1 : -0.05),
    A: calculateScore(markers.agreeableness, positiveWords > wordCount * 0.05 ? 0.1 : 0),
    N: calculateScore(markers.neuroticism, markers.neuroticism.negative > markers.neuroticism.anxiety ? 0.1 : 0),
  }
  
  // Adjust Neuroticism inversely with positive emotions
  const positiveRatio = positiveWords / (wordCount || 1)
  scores.N = Math.max(0.2, Math.min(0.8, scores.N - positiveRatio * 0.5))
  
  // Adjust Extraversion based on pronoun usage
  if (firstPerson > wordCount * 0.1) scores.E -= 0.05 // Too self-focused
  if (secondPerson > wordCount * 0.05 || thirdPerson > wordCount * 0.05) scores.E += 0.05
  
  return scores
}

export default async function handler(req: Request) {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Use POST method' }, 405)
    }

    // Get environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

    // Validate environment
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase credentials')
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }

    const { type, text, responses } = body || {}

    // Verify authentication
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // Verify user with Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    })

    if (!userRes.ok) {
      console.error('Auth failed:', userRes.status)
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    const user = await userRes.json()
    const user_id = user?.id

    if (!user_id) {
      return jsonResponse({ error: 'Could not extract user ID' }, 401)
    }

    // Process input based on type
    let inputText = ''
    let finalScores: any = null
    let method = 'unknown'

    if (type === 'text') {
      // TEXT ANALYSIS: Use rule-based linguistic analysis
      if (!text || !String(text).trim()) {
        return jsonResponse({ error: 'Text input is empty' }, 400)
      }
      
      inputText = String(text).slice(0, 4000)
      
      if (inputText.split(/\s+/).length < 50) {
        return jsonResponse({ 
          error: 'Text is too short. Please provide at least 50 words for accurate analysis.',
          minWords: 50,
          yourWords: inputText.split(/\s+/).length
        }, 400)
      }
      
      method = 'linguistic_analysis'
      finalScores = analyzeTextForPersonality(inputText)

    } else if (type === 'survey') {
      // SURVEY ANALYSIS: Direct calculation (most accurate)
      const arr = Array.isArray(responses) ? responses.map((x: any) => Number(x)) : []
      
      if (!arr.length || arr.length < 50) {
        return jsonResponse({ error: 'Survey must have 50 responses' }, 400)
      }

      method = 'survey_ipip50'
      inputText = 'IPIP-50 Survey Response'

      // Calculate scores directly from survey responses
      const buckets: any = { O: [], C: [], E: [], A: [], N: [] }
      
      for (let i = 0; i < Math.min(arr.length, 50); i++) {
        buckets[OCEAN_KEYS[i % 5]].push(arr[i])
      }

      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      const normalize = (x: number) => (x - 1) / 4

      finalScores = {
        O: normalize(mean(buckets.O)),
        C: normalize(mean(buckets.C)),
        E: normalize(mean(buckets.E)),
        A: normalize(mean(buckets.A)),
        N: normalize(mean(buckets.N)),
      }

    } else {
      return jsonResponse({ error: 'Invalid type. Must be "text" or "survey"' }, 400)
    }

    // Calculate percentiles and label
    const percentiles = Object.fromEntries(
      Object.entries(finalScores).map(([k, v]) => [k, Math.round(Number(v) * 100)])
    )

    const label = getTopLabel(finalScores)

    // Store in database
    try {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          apikey: SUPABASE_SERVICE_ROLE,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            user_id,
            input_type: type,
            input_content: inputText.slice(0, 500),
            scores: finalScores,
            label,
            percentiles,
          },
        ]),
      })

      const inserted = await insertRes.json()

      if (!insertRes.ok) {
        console.error('DB insert failed:', inserted)
      }

      return jsonResponse({
        scores: finalScores,
        label,
        percentiles,
        id: inserted?.[0]?.id,
        method,
        note: method === 'linguistic_analysis' 
          ? 'Results based on advanced linguistic analysis of your text' 
          : 'Results based on IPIP-50 standardized survey'
      })

    } catch (dbError: any) {
      console.error('Database error:', dbError)
      
      return jsonResponse({
        scores: finalScores,
        label,
        percentiles,
        method,
        warning: 'Results calculated but not saved',
      })
    }

  } catch (e: any) {
    console.error('Handler error:', e)
    return jsonResponse({
      error: 'Internal server error',
      detail: e?.message || 'Unknown error',
    }, 500)
  }
}
