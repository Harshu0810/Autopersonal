// Use a real OCEAN regressor via Hugging Face Inference API.
// Model: ppp57420/ocean-personality-distilbert  (distilbert-base-uncased, 5-dim regression [O,C,E,A,N])
// https://huggingface.co/ppp57420/ocean-personality-distilbert

export const config = { runtime: "edge" };

type Scores = { O:number; C:number; E:number; A:number; N:number };

const OCEAN_KEYS = ["O","C","E","A","N"] as const;
const MODEL_ID = "ppp57420/ocean-personality-distilbert";

function topLabel(scores: Scores){
  const names: Record<keyof Scores,string> = {
    O:"Openness", C:"Conscientiousness", E:"Extraversion", A:"Agreeableness", N:"Neuroticism"
  };
  return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0] as keyof Scores
    ? names[Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0] as keyof Scores]
    : "Openness";
}

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405, headers: { "content-type":"application/json" }
      });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
    const HF_API_TOKEN = process.env.HF_API_TOKEN!;

    const body = await req.json().catch(()=>null) as any;
    const { type, text, responses } = body || {};

    // auth: verify user with Supabase
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    const user = await userRes.json(); const user_id = user?.id;

    // === Build the text to score ===
    let inputText = "";
    if (type === "text") {
      if (!text || !String(text).trim()) {
        return new Response(JSON.stringify({ error: "Empty text" }), { status: 400, headers: { "content-type":"application/json" }});
      }
      inputText = String(text).slice(0, 4000);
    } else if (type === "survey") {
      const arr = Array.isArray(responses) ? responses.map((x:any)=>Number(x)) : [];
      if (!arr.length) {
        return new Response(JSON.stringify({ error: "Empty survey" }), { status: 400, headers: { "content-type":"application/json" }});
      }
      // turn Likert responses into a short summary prompt for the model
      const mean = (xs:number[]) => xs.reduce((a,b)=>a+b,0)/xs.length;
      const buckets = { O:[], C:[], E:[], A:[], N:[] } as Record<keyof Scores, number[]>;
      for (let i=0;i<arr.length;i++) buckets[OCEAN_KEYS[i%5]].push(arr[i]);
      const norm = (x:number)=> ((x-1)/4); // 1..5 -> 0..1
      const approx: Scores = {
        O: norm(mean(buckets.O||[3])), C: norm(mean(buckets.C||[3])),
        E: norm(mean(buckets.E||[3])), A: norm(mean(buckets.A||[3])),
        N: norm(mean(buckets.N||[3]))
      };
      inputText = `User self-report summary: O=${approx.O.toFixed(2)}, C=${approx.C.toFixed(2)}, E=${approx.E.toFixed(2)}, A=${approx.A.toFixed(2)}, N=${approx.N.toFixed(2)}.`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown type" }), { status: 400, headers: { "content-type":"application/json" }});
    }

    // === Call Hugging Face Inference API ===
    // DistilBERT regressor returns raw 5-dim list ~ [O,C,E,A,N] in [0,1]
    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${MODEL_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_API_TOKEN}`, "Content-Type":"application/json" },
      body: JSON.stringify({ inputs: inputText })
    });

    if (!hfRes.ok) {
      const msg = await hfRes.text();
      return new Response(JSON.stringify({ error: `HF API error: ${hfRes.status} ${msg}` }), {
        status: 502, headers: { "content-type":"application/json" }
      });
    }

    const out = await hfRes.json();
    // Possible shapes: {error: ...} or [[...]] or {...}
    let vec: number[] | null = null;
    if (Array.isArray(out) && Array.isArray(out[0])) vec = out[0] as number[];
    else if (Array.isArray(out)) vec = out as number[];
    if (!vec || vec.length < 5) {
      return new Response(JSON.stringify({ error: "Unexpected HF output", raw: out }), {
        status: 500, headers: { "content-type":"application/json" }
      });
    }

    const scores: Scores = { O:vec[0], C:vec[1], E:vec[2], A:vec[3], N:vec[4] };
    const percentiles = Object.fromEntries(
      Object.entries(scores).map(([k,v])=>[k, Math.round(Number(v)*10000)/100])
    ) as Record<keyof Scores, number>;
    const label = topLabel(scores);

    // === Store to Supabase ===
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        apikey: SUPABASE_SERVICE_ROLE,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify([{
        user_id, input_type: type, input_content: inputText.slice(0,500),
        scores, label, percentiles
      }])
    });
    const inserted = await insertRes.json();
    if (!insertRes.ok) {
      return new Response(JSON.stringify({ error: inserted }), {
        status: 500, headers: { "content-type":"application/json" }
      });
    }

    return new Response(JSON.stringify({ scores, label, percentiles, id: inserted?.[0]?.id }), {
      headers: { "content-type":"application/json" }
    });

  } catch (e:any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500, headers: { "content-type":"application/json" }
    });
  }
}
