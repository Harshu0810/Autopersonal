import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './pages/App.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import PublicResult from './pages/PublicResult.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/u/:handle" element={<PublicProfile />} />
      <Route path="/result/:id" element={<PublicResult />} />
    </Routes>
  </BrowserRouter>
)
