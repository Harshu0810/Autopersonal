export const config = {
  runtime: 'edge',
}

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
  for (const k of Object.keys(scores)) {
    const val = Number(scores[k] || 0)
    if (val > max) {
      max = val
      best = k
    }
  }
  return (names as any)[best]
}

export default async function handler(req: Request) {
  try {
    // Handle CORS preflight
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
      return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405)
    }

    // Check environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
    const HF_API_TOKEN = process.env.HF_API_TOKEN

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return jsonResponse(
        {
          error: 'Server configuration error',
          detail: 'Missing Supabase credentials. Please check Vercel environment variables.',
        },
        500
      )
    }

    if (!HF_API_TOKEN) {
      console.error('Missing HF_API_TOKEN')
      return jsonResponse(
        {
          error: 'Server configuration error',
          detail: 'Missing Hugging Face API token. Please add HF_API_TOKEN to Vercel environment variables.',
        },
        500
      )
    }

    // Parse request body
    let body: any = null
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400)
    }

    const { type, text, responses } = body || {}

    // Validate authorization
    const auth = req.headers.get('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

    if (!token) {
      return jsonResponse({ error: 'Unauthorized. Missing bearer token.' }, 401)
    }

    // Verify user with Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    })

    if (!userRes.ok) {
      console.error('Supabase auth failed:', userRes.status)
      return jsonResponse({ error: 'Invalid authentication token' }, 401)
    }

    const user = await userRes.json()
    const user_id = user?.id

    if (!user_id) {
      return jsonResponse({ error: 'Could not extract user ID from token' }, 401)
    }

    // Process input
    let inputText = ''

    if (type === 'text') {
      if (!text || !String(text).trim()) {
        return jsonResponse({ error: 'Text input is empty' }, 400)
      }
      inputText = String(text).slice(0, 4000)
    } else if (type === 'survey') {
      const arr = Array.isArray(responses) ? responses.map((x: any) => Number(x)) : []
      if (!arr.length) {
        return jsonResponse({ error: 'Survey responses are empty' }, 400)
      }

      const buckets: any = { O: [], C: [], E: [], A: [], N: [] }
      for (let i = 0; i < arr.length; i++) {
        buckets[OCEAN_KEYS[i % 5]].push(arr[i])
      }

      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      const norm = (x: number) => (x - 1) / 4

      const scores = {
        O: norm(mean(buckets.O || [3])),
        C: norm(mean(buckets.C || [3])),
        E: norm(mean(buckets.E || [3])),
        A: norm(mean(buckets.A || [3])),
        N: norm(mean(buckets.N || [3])),
      }

      inputText = `Personality assessment based on IPIP-50 survey: Openness ${scores.O.toFixed(
        3
      )}, Conscientiousness ${scores.C.toFixed(3)}, Extraversion ${scores.E.toFixed(
        3
      )}, Agreeableness ${scores.A.toFixed(3)}, Neuroticism ${scores.N.toFixed(
        3
      )}. Standardized Big Five inventory.`
    } else {
      return jsonResponse({ error: 'Invalid type. Must be "text" or "survey"' }, 400)
    }

    // Call Hugging Face API
    const MODEL_ID = process.env.HF_MODEL_ID || 'holistic-ai/personality_classifier'

    const callHF = async (modelId: string) => {
      try {
        return await fetch(`https://router.huggingface.co/models/${modelId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: inputText }),
        })
      } catch (err) {
        console.error('HF API call failed:', err)
        throw err
      }
    }

    let hfRes = await callHF(MODEL_ID)

    // Retry with fallback model if needed
    if ([403, 404, 410, 503].includes(hfRes.status)) {
      console.log('Primary model failed, trying fallback...')
      hfRes = await callHF('Minej/bert-base-personality')
    }

    if (!hfRes.ok) {
      const errorText = await hfRes.text()
      console.error('HF API error:', hfRes.status, errorText)
      return jsonResponse(
        {
          error: `Hugging Face API error: ${hfRes.status}`,
          detail: errorText,
        },
        502
      )
    }

    const output = await hfRes.json()
    let vec: any = Array.isArray(output) && Array.isArray(output[0])
      ? output[0]
      : Array.isArray(output)
      ? output
      : null

    if (!vec || vec.length < 5) {
      console.error('Unexpected HF output:', output)
      return jsonResponse(
        {
          error: 'Unexpected model output format',
          detail: 'The AI model returned an unexpected response',
          raw: output,
        },
        500
      )
    }

    // Calculate scores
    const scores: any = {
      O: Number(vec[0]),
      C: Number(vec[1]),
      E: Number(vec[2]),
      A: Number(vec[3]),
      N: Number(vec[4]),
    }

    const percentiles = Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(Number(v) * 10000) / 100])
    )

    const label = getTopLabel(scores)

    // Store in Supabase
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
            scores,
            label,
            percentiles,
          },
        ]),
      })

      const inserted = await insertRes.json()

      if (!insertRes.ok) {
        console.error('Supabase insert failed:', inserted)
        // Don't fail the request, just log the error
      }

      return jsonResponse({
        scores,
        label,
        percentiles,
        id: inserted?.[0]?.id,
      })
    } catch (dbError: any) {
      console.error('Database error:', dbError)
      // Still return the results even if DB insert fails
      return jsonResponse({
        scores,
        label,
        percentiles,
        warning: 'Results calculated but not saved to database',
      })
    }
  } catch (e: any) {
    console.error('Handler error:', e)
    return jsonResponse(
      {
        error: 'Internal server error',
        detail: e?.message || 'Unknown error occurred',
      },
      500
    )
  }
}
