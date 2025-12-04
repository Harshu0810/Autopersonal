import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
export default function AuthGate({ children }){
  const [session, setSession] = useState(null)
  useEffect(()=>{
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess)=> setSession(sess))
    return () => sub.subscription.unsubscribe()
  },[])
  if (!session) return <Login />
  return children
}
function Login(){
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const signIn = async () => { await supabase.auth.signInWithPassword({ email, password }) }
  const signUp = async () => { await supabase.auth.signUp({ email, password }) }
  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-4 mt-24 border border-brand/20">
      <h2 className="text-xl font-bold">Sign in to continue</h2>
      <input className="w-full border rounded-xl p-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full border rounded-xl p-2" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="w-full bg-brand text-white rounded-xl py-2" onClick={signIn}>Sign in</button>
      <button className="w-full border rounded-xl py-2" onClick={signUp}>Create account</button>
    </div>
  )
}
