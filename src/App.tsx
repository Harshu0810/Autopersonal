    import { PropsWithChildren } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { LogOut, LayoutDashboard } from 'lucide-react'

export default function App({ children }: PropsWithChildren) {
  const nav = useNavigate()

  const signOut = async () => {
    await supabase.auth.signOut()
    nav('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">O</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">OCEAN Personality</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => nav('/dashboard')}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </button>
              <button
                onClick={signOut}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </button>
              <button
                onClick={() => nav('/personality-analysis')}  // 👈 change this path if your page route is different
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 rounded-lg transition"
                >
              🔍 Analyze Personality
              </button>

            </div>
             </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
