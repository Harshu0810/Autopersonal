export const config = { runtime: "edge" };

type Scores = { O:number; C:number; E:number; A:number; N:number };

export default async function handler(req: Request) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

  const TRAIT_KEYWORDS: Record<keyof Scores, string[]> = {
    O:["creative","imagine","art","novel","theory","curious","idea","discover","abstract","explore","design","music","write","poem","philosophy"],
    C:["organize","plan","schedule","goal","focus","discipline","neat","order","deadline","prepare","routine","habit","clean","list","task"],
    E:["party","talk","friends","team","social","outgoing","energetic","crowd","chat","festival","network","meet","group","club","celebrate"],
    A:["kind","help","support","trust","care","friendly","empathy","polite","cooperate","share","volunteer","forgive","respect","generous","listen"],
    N:["worry","anxious","stress","sad","angry","fear","nervous","guilt","tired","panic","depressed","frustrated","upset","moody","tense"],
  };

  const scoreKeywords = (text: string): Scores => {
    const t = text.toLowerCase(), n = Math.max(t.split(/\s+/).length, 1);
    const base: any = {O:0,C:0,E:0,A:0,N:0};
    (Object.keys(TRAIT_KEYWORDS) as (keyof Scores)[]).forEach(k => {
      const hit = TRAIT_KEYWORDS[k].reduce((acc, kw) => acc + (t.split(kw).length - 1), 0);
      base[k] = Math.min(1, hit / Math.max(8, n/50));
    });
    const vals = Object.fromEntries(Object.entries(base).map(([k,v])=>[k, Math.exp(2*Number(v))]));
    const sum = Object.values(vals).reduce((a,b)=>a+Number(b),0) || 1;
    const dist: any = {}; for (const k in vals) dist[k] = Number(vals[k]) / sum;
    return dist as Scores;
  };
  const percentiles = (scores: Scores) => Object.fromEntries(Object.entries(scores).map(([k,v])=>[k, Math.round(Number(v)*10000)/100]));
  const topLabel = (scores: Scores) => {
    const map: any = {O:"Openness",C:"Conscientiousness",E:"Extraversion",A:"Agreeableness",N:"Neuroticism"};
    let top = "O", best = -1; for (const k in scores){ const v = (scores as any)[k]; if (v>best){best=v; top=k} }
    return map[top];
  };

  try{
    const body = await req.json();
    const { type, text, responses } = body || {};
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    // verify user via Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    const user = await userRes.json(); const userId = user?.id;

    let scores: Scores, input_content = "";
    if (type === "text"){
      if (!text?.trim()) return new Response(JSON.stringify({ error:"Empty text" }), { status: 400 });
      scores = scoreKeywords(String(text)); input_content = String(text).slice(0,500);
    } else if (type === "survey"){
      const arr = Array.isArray(responses) ? responses.map((x:any)=>Number(x)) : [];
      if (!arr.length) return new Response(JSON.stringify({ error:"Empty responses" }), { status: 400 });
      const chunks: any = { O:[],C:[],E:[],A:[],N:[] };
      for (let i=0;i<arr.length;i++){ const k = "OCEAN"[i%5]; chunks[k].push(arr[i]); }
      const norm = (x:number)=> (x-1)/4;
      scores = {
        O: chunks.O.length? norm(chunks.O.reduce((a:number,b:number)=>a+b,0)/chunks.O.length):0.2,
        C: chunks.C.length? norm(chunks.C.reduce((a:number,b:number)=>a+b,0)/chunks.C.length):0.2,
        E: chunks.E.length? norm(chunks.E.reduce((a:number,b:number)=>a+b,0)/chunks.E.length):0.2,
        A: chunks.A.length? norm(chunks.A.reduce((a:number,b:number)=>a+b,0)/chunks.A.length):0.2,
        N: chunks.N.length? norm(chunks.N.reduce((a:number,b:number)=>a+b,0)/chunks.N.length):0.2
      };
      input_content = `${arr.length}-item survey`;
    } else {
      return new Response(JSON.stringify({ error:"Unknown type" }), { status: 400 });
    }

    const label = topLabel(scores); const pct = percentiles(scores);

    // store to Supabase (service role)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        apikey: SUPABASE_SERVICE_ROLE,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify([{ user_id: userId, input_type: type, input_content, scores, label, percentiles: pct }])
    });
    const inserted = await insertRes.json();
    if (!insertRes.ok) return new Response(JSON.stringify({ error: inserted }), { status: 500 });

    return new Response(JSON.stringify({ scores, label, percentiles: pct, id: inserted?.[0]?.id }), {
      headers: { "Content-Type":"application/json" }
    });
  }catch(e:any){
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500 });
  }
}
