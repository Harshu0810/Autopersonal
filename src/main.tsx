import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import PublicProfile from './pages/PublicProfile'
import PublicPrediction from './pages/PublicPrediction'

const router = createBrowserRouter([
  { path: '/', element: <SignIn /> },
  { path: '/dashboard', element: <App><Dashboard /></App> },
  { path: '/admin', element: <App><Admin /></App> },
  { path: '/u/:handle', element: <PublicProfile /> },
  { path: '/p/:id', element: <PublicPrediction /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
