// ====================
// FILE: src/App.tsx (UPDATED WITH ADMIN LINK)
// ====================
import { PropsWithChildren, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LogOut, LayoutDashboard, Shield } from 'lucide-react'

export default function App({ children }: PropsWithChildren) {
  const [isAdmin, setIsAdmin] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      setIsAdmin(profile?.is_admin || false)
    }
    checkAdmin()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    nav('/')
  }

  return (
    <div>
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">O</span>
              </div>
              <h1 className="text-xl font-bold">OCEAN</h1>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => nav('/dashboard')}
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 rounded-lg transition"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </button>
              
              {isAdmin && (
                <button
                  onClick={() => nav('/admin')}
                  className="flex items-center px-4 py-2 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition font-medium"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Panel
                </button>
              )}
              <button
    onClick={() => window.open('https://254fdb8d89228ea3e6.gradio.live/', '_blank')}
    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 rounded-lg transition"
  >
    🔍 Analyze Personality
  </button>

              <button
                onClick={signOut}
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
