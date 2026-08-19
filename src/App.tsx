import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'

const FaceAnonymization = lazy(() => import('./pages/FaceAnonymization'))
const MealPrepChatbot = lazy(() => import('./pages/MealPrepChatbot'))
const BakeryAssistant = lazy(() => import('./pages/BakeryAssistant'))
const GitHubProjects = lazy(() => import('./pages/GitHubProjects'))

function PageFallback() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
      loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route
            path="/face-anonymization"
            element={
              <Suspense fallback={<PageFallback />}>
                <FaceAnonymization />
              </Suspense>
            }
          />
          <Route
            path="/mealprep-chatbot"
            element={
              <Suspense fallback={<PageFallback />}>
                <MealPrepChatbot />
              </Suspense>
            }
          />
          <Route
            path="/bakery-assistant"
            element={
              <Suspense fallback={<PageFallback />}>
                <BakeryAssistant />
              </Suspense>
            }
          />
          <Route
            path="/github"
            element={
              <Suspense fallback={<PageFallback />}>
                <GitHubProjects />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
