export const config = { runtime: "edge" };

const OCEAN_KEYS = ["O", "C", "E", "A", "N"];
const MODEL_ID = "ppp57420/ocean-personality-distilbert";

// ✅ Helper: send JSON + CORS headers
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*", // allow all origins
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

const topLabel = (scores) => {
  const names = {
    O: "Openness",
    C: "Conscientiousness",
    E: "Extraversion",
    A: "Agreeableness",
    N: "Neuroticism",
  };
  let bestK = "O",
    bestV = -1;
  for (const k of Object.keys(scores)) {
    const v = Number(scores[k] || 0);
    if (v > bestV) {
      bestV = v;
      bestK = k;
    }
  }
  return names[bestK];
};

export default async function handler(req) {
  try {
    // ✅ Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // ✅ Require POST
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);

    // Env vars
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    const HF_API_TOKEN = process.env.HF_API_TOKEN;

    // Parse body safely
    let body = null;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body must be JSON" }, 400);
    }
    const { type, text, responses } = body || {};

    // Auth (JWT from Supabase client)
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return json({ error: "Invalid token" }, 401);
    const user = await userRes.json();
    const user_id = user?.id;

    // Build input text
    let inputText = "";
    if (type === "text") {
      if (!text || !String(text).trim())
        return json({ error: "Empty text" }, 400);
      inputText = String(text).slice(0, 4000);
    } else if (type === "survey") {
      const arr = Array.isArray(responses)
        ? responses.map((x) => Number(x))
        : [];
      if (!arr.length) return json({ error: "Empty survey" }, 400);
      const buckets = { O: [], C: [], E: [], A: [], N: [] };
      for (let i = 0; i < arr.length; i++)
        buckets[OCEAN_KEYS[i % 5]].push(arr[i]);
      const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const norm = (x) => (x - 1) / 4;
      const approx = {
        O: norm(mean(buckets.O || [3])),
        C: norm(mean(buckets.C || [3])),
        E: norm(mean(buckets.E || [3])),
        A: norm(mean(buckets.A || [3])),
        N: norm(mean(buckets.N || [3])),
      };
      inputText = `User self-report summary: O=${approx.O.toFixed(
        2
      )}, C=${approx.C.toFixed(2)}, E=${approx.E.toFixed(
        2
      )}, A=${approx.A.toFixed(2)}, N=${approx.N.toFixed(2)}.`;
    } else {
      return json({ error: "Unknown type" }, 400);
    }

    // Call Hugging Face API
    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: inputText }),
      }
    );
    if (!hfRes.ok)
      return json(
        { error: `HF API error: ${hfRes.status}`, detail: await hfRes.text() },
        502
      );

    const out = await hfRes.json();
    let vec =
      Array.isArray(out) && Array.isArray(out[0])
        ? out[0]
        : Array.isArray(out)
        ? out
        : null;
    if (!vec || vec.length < 5)
      return json({ error: "Unexpected HF output", raw: out }, 500);

    const scores = { O: vec[0], C: vec[1], E: vec[2], A: vec[3], N: vec[4] };
    const percentiles = Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(Number(v) * 10000) / 100])
    );
    const label = topLabel(scores);

    // Store in Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        apikey: SUPABASE_SERVICE_ROLE,
        "Content-Type": "application/json",
        Prefer: "return=representation",
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
    });
    const inserted = await insertRes.json();
    if (!insertRes.ok) return json({ error: inserted }, 500);

    return json({ scores, label, percentiles, id: inserted?.[0]?.id });
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
