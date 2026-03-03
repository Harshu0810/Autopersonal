# 🧠 OCEAN Personality Analysis Platform

> AI-powered Big Five personality assessment using advanced linguistic analysis and standardized psychological surveys.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://autopersonal.vercel.app/dashboard)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

<img width="585" height="284" alt="image" src="https://github.com/user-attachments/assets/5d93a32a-d064-4708-b58c-9b7e963dcc03" />


## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 Overview

The OCEAN Personality Analysis Platform is a modern web application that analyzes personality traits using the scientifically validated **Big Five (OCEAN)** personality model. The platform offers two analysis methods:

1. **Text Analysis** - Advanced linguistic pattern recognition analyzing 70+ personality markers
2. **IPIP-50 Survey** - Standardized 50-item personality inventory with 85-90% accuracy

### What is OCEAN?

**OCEAN** stands for the five major personality dimensions:

- 🎨 **O**penness - Imagination, creativity, and openness to new experiences
- 📋 **C**onscientiousness - Organization, responsibility, and dependability
- 👥 **E**xtraversion - Sociability, assertiveness, and energy level
- 🤝 **A**greeableness - Compassion, cooperation, and trust
- 😰 **N**euroticism - Emotional stability and stress management

---

## ✨ Features

### For Users

- 🔐 **Secure Authentication** - Email-based authentication with Supabase
- 📝 **Text Analysis** - Analyze personality from written text (minimum 50 words)
- 📊 **IPIP-50 Survey** - Complete standardized psychological assessment
- 📈 **Visual Results** - Interactive radar and bar charts showing all 5 traits
- 💾 **History Tracking** - View all past personality assessments
- 🎯 **Dominant Trait** - Identify your strongest personality dimension
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

### For Admins

- 👥 **User Management** - View all registered users and their activity
- 📥 **Data Export** - Download user data, predictions, or grouped reports as CSV
- 🔄 **Real-time Updates** - Dashboard updates automatically as users submit data
- 🔍 **Advanced Filtering** - Search by user, trait, or input type

 <img width="585" height="284" alt="image" src="https://github.com/user-attachments/assets/778e8c98-4feb-48ef-bfd1-e2e86b616ce3" />
 
- 📊 **Real-time Analytics** - Live dashboard with statistics and trends
- 🥧 **Interactive Charts** - Personality distribution, average scores, activity timeline
- 🎨 **Modern UI** - Beautiful, gradient-based design with smooth animations
 
<img width="585" height="284" alt="image" src="https://github.com/user-attachments/assets/a8ae2454-747e-4b42-bf3c-da3ef8c100ef" />

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **Lucide Icons** - Beautiful icon library

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Real-time subscriptions
  - Row-level security (RLS)
  - Authentication
- **Vercel Edge Functions** - Serverless API

### AI/ML
- **Custom Linguistic Analysis** - Rule-based personality detection
- **Advanced NLP** - Pattern recognition for 70+ personality markers
- **IPIP-50 Algorithm** - Standardized scoring methodology

---

## 📁 Project Structure

```
Autopersonal/
├── api/
│   └── predict.ts              # Personality prediction API endpoint
├── src/
│   ├── components/
│   │   └── RadarChart.tsx      # Radar chart visualization
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client configuration
│   │   └── big5_items.ts       # IPIP-50 survey questions
│   ├── pages/
│   │   ├── SignIn.tsx          # Authentication page
│   │   ├── Dashboard.tsx       # User dashboard & analysis
│   │   ├── Admin.tsx           # Admin panel with analytics
│   │   ├── PublicProfile.tsx   # Public user profiles
│   │   └── PublicPrediction.tsx# Shared prediction results
│   ├── App.tsx                 # Main app wrapper with navigation
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles
├── vercel.json                 
├── tsconfig.node.json          
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── vite-env.d.ts
├── index.html
├── postcss.config.js
└── README.md
```

---

### Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Admins have full access to all predictions
- Public users can view shared predictions

---

## 🔌 API Documentation

### `POST /api/predict`

Analyzes personality from text or survey responses.

**Authentication:** Required (Bearer token)

**Request Body:**

```typescript
// Text Analysis
{
  type: "text",
  text: "Your text here (minimum 50 words)..."
}

// Survey Analysis
{
  type: "survey",
  responses: [1, 2, 3, 4, 5, ...] // 50 values from 1-5
}
```

**Response:**

```typescript
{
  scores: {
    O: 0.75,  // Openness (0-1)
    C: 0.60,  // Conscientiousness
    E: 0.45,  // Extraversion
    A: 0.70,  // Agreeableness
    N: 0.30   // Neuroticism
  },
  percentiles: {
    O: 75,    // Percentile scores (0-100)
    C: 60,
    E: 45,
    A: 70,
    N: 30
  },
  label: "Openness",        // Dominant trait
  method: "text_analysis",  // or "survey_ipip50"
  id: 123                   // Prediction ID
}
```

**Error Responses:**

- `400` - Invalid input (missing text, invalid survey responses)
- `401` - Unauthorized (missing or invalid token)
- `500` - Server error

---


---

## 🤖 Acknowledgments

- **Big Five Personality Theory** - Based on decades of psychological research
- **IPIP-50** - International Personality Item Pool
- **Supabase** - For excellent BaaS platform
- **Vercel** - For seamless deployment
- **Recharts** - For beautiful data visualizations

---

## 👤 Author

**Harshit Goyal**

- GitHub: [@Harshu0810](https://github.com/Harshu0810)
- Email: hellofriends0810@gmail.com

---

## 🐛 Known Issues

- Text analysis requires minimum 50 words for accurate results
- Real-time updates require Realtime enabled in Supabase
- Admin panel requires manual admin flag in database

---

## 🔮 Future Enhancements

- [ ] Multi-language support
- [ ] PDF report generation
- [ ] Personality compatibility matching
- [ ] Historical trend analysis
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations
- [ ] Machine learning model improvements
- [ ] Social sharing features
- [ ] Team/organization accounts
- [ ] Advanced analytics dashboard

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/Harshu0810/Autopersonal/issues) page
2. Create a new issue with detailed description
3. Contact the author via email

---

## ⭐ Show Your Support

If you find this project helpful, please give it a ⭐ on GitHub!

---

<div align="center">

**Built with ❤️ using React, TypeScript, and Supabase**

[Live Demo](https://autopersonal.vercel.app) • [Report Bug](https://github.com/Harshu0810/Autopersonal/issues) • [Request Feature](https://github.com/Harshu0810/Autopersonal/issues)

</div>
