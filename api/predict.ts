// ====================
// FILE: api/predict.ts (FINAL PRODUCTION VERSION)
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

// Enhance scores using linguistic features for better accuracy
const enhanceScores = (text: string, baseScores: any) => {
  const lower = text.toLowerCase()
  const words = text.split(/\s+/)
  
  // Calculate linguistic features
  const wordCount = words.length
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount
  const exclamations = (text.match(/!/g) || []).length
  const questions = (text.match(/\?/g) || []).length
  
  // Count specific word categories
  const firstPerson = (lower.match(/\b(i|me|my|mine|myself)\b/g) || []).length
  const socialWords = (lower.match(/\b(we|us|our|together|friend|people|party|social)\b/g) || []).length
  const negativeWords = (lower.match(/\b(not|never|no|bad|hate|dislike|worry|anxious|stress)\b/g) || []).length
  const positiveWords = (lower.match(/\b(good|great|love|like|happy|joy|excited|wonderful)\b/g) || []).length
  const abstractWords = (lower.match(/\b(idea|think|theory|concept|imagine|philosophy|creative)\b/g) || []).length
  const organizationWords = (lower.match(/\b(plan|organize|schedule|detail|prepare|order|system)\b/g) || []).length
  
  // Calculate adjustment factors (small adjustments to avoid overfitting)
  const adjustments = {
    E: (socialWords > 2 ? 0.05 : 0) + (firstPerson > 8 ? -0.03 : 0),
    N: (negativeWords > positiveWords ? 0.06 : -0.04) + (exclamations > 3 ? 0.02 : 0),
    O: (abstractWords > 2 ? 0.05 : 0) + (avgWordLength > 6 ? 0.03 : 0),
    C: (organizationWords > 2 ? 0.05 : 0) + (wordCount > 250 ? 0.03 : 0),
    A: (positiveWords > negativeWords + 2 ? 0.05 : 0) + (questions > 1 ? 0.02 : 0),
  }
  
  // Apply adjustments while keeping scores in valid range
  const enhanced = { ...baseScores }
  for (const [trait, adjustment] of Object.entries(adjustments)) {
    enhanced[trait] = Math.max(0.1, Math.min(0.9, enhanced[trait] + adjustment))
  }
  
  return enhanced
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
    const HF_API_TOKEN = process.env.HF_API_TOKEN
    const MODEL_ID = process.env.HF_MODEL_ID || 'Minej/bert-base-personality'

    // Validate environment
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase credentials')
      return jsonResponse({ error: 'Server configuration error: Missing Supabase credentials' }, 500)
    }

    if (!HF_API_TOKEN) {
      console.error('Missing HF_API_TOKEN')
      return jsonResponse({ error: 'Server configuration error: Missing Hugging Face token' }, 500)
    }

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400)
    }

    const { type, text, responses } = body || {}

    // Verify authentication
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

    if (!token) {
      return jsonResponse({ error: 'Unauthorized: Missing bearer token' }, 401)
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
      return jsonResponse({ error: 'Invalid authentication token' }, 401)
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
      // Text analysis path
      if (!text || !String(text).trim()) {
        return jsonResponse({ error: 'Text input is empty' }, 400)
      }
      
      inputText = String(text).slice(0, 4000)
      method = 'text_analysis'

      // Call Hugging Face model
      const hfRes = await fetch(`https://router.huggingface.co/models/${MODEL_ID}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: inputText }),
      })

      if (!hfRes.ok) {
        const errorText = await hfRes.text()
        console.error('HF API error:', hfRes.status, errorText)
        
        // Better error messages for common issues
        if (hfRes.status === 503) {
          return jsonResponse({ 
            error: 'AI model is loading. Please wait 20 seconds and try again.',
            retryAfter: 20 
          }, 503)
        }
        
        return jsonResponse({ 
          error: `AI model error (${hfRes.status})`,
          detail: errorText.slice(0, 200)
        }, 502)
      }

      const output = await hfRes.json()
      
      // Parse model output
      let vec: any = Array.isArray(output) && Array.isArray(output[0])
        ? output[0]
        : Array.isArray(output)
        ? output
        : null

      if (!vec || vec.length < 5) {
        console.error('Unexpected output:', output)
        return jsonResponse({ error: 'Unexpected model output format' }, 500)
      }

      // Get base scores from model
      const baseScores = {
        O: Number(vec[0]),
        C: Number(vec[1]),
        E: Number(vec[2]),
        A: Number(vec[3]),
        N: Number(vec[4]),
      }

      // Enhance with linguistic analysis
      finalScores = enhanceScores(inputText, baseScores)

    } else if (type === 'survey') {
      // Survey analysis path (more accurate)
      const arr = Array.isArray(responses) ? responses.map((x: any) => Number(x)) : []
      
      if (!arr.length || arr.length < 50) {
        return jsonResponse({ error: 'Survey must have 50 responses' }, 400)
      }

      method = 'survey'
      inputText = 'IPIP-50 Survey Response'

      // Calculate scores directly from survey responses
      const buckets: any = { O: [], C: [], E: [], A: [], N: [] }
      
      for (let i = 0; i < Math.min(arr.length, 50); i++) {
        buckets[OCEAN_KEYS[i % 5]].push(arr[i])
      }

      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      const normalize = (x: number) => (x - 1) / 4 // Normalize 1-5 scale to 0-1

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
      })

    } catch (dbError: any) {
      console.error('Database error:', dbError)
      
      // Return results even if DB save fails
      return jsonResponse({
        scores: finalScores,
        label,
        percentiles,
        method,
        warning: 'Results calculated but not saved to database',
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
