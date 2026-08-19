import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import ResumeModal from './ResumeModal'

const NAV_ITEMS = [
  { to: '/', label: 'home', service: 'resume', end: true },
  { to: '/face-anonymization', label: 'face-anonymization', service: 'cv-pipeline' },
  { to: '/mealprep-chatbot', label: 'mealprep-chatbot', service: 'nlp-retrieval' },
  { to: '/bakery-assistant', label: 'bakery-assistant', service: 'ml + planner' },
  { to: '/github', label: 'github', service: 'misc' },
]

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [resumeModalOpen, setResumeModalOpen] = useState(false)

  const handleResumeClick = () => {
    setMenuOpen(false)
    setResumeModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--line)', background: 'rgba(11,14,20,0.9)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <span className="status-dot on" />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group px-3 py-2 rounded-md text-[13px] flex items-center gap-2 transition-colors ${
                    isActive ? '' : 'hover:bg-white/5'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                  background: isActive ? 'var(--amber-dim)' : undefined,
                })}
              >
                <span className={`status-dot ${'on'}`} style={{ opacity: 0.7 }} />
                {item.label}
              </NavLink>
            ))}
            <a
              href="/resume/Yann_Gilbert_Resume.pdf"
              download="Yann_Gilbert_Resume.pdf"
              onClick={handleResumeClick}
              className="ml-2 px-3 py-2 rounded-md text-[13px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: 'var(--amber)', color: '#1a1206' }}
            >
              ↓ resume
            </a>
          </nav>

          <button
            className="md:hidden text-[13px] px-3 py-1.5 rounded border"
            style={{ borderColor: 'var(--line)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? 'close' : 'menu'}
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t px-5 py-3 flex flex-col gap-1" style={{ borderColor: 'var(--line)', fontFamily: 'var(--font-mono)' }}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className="px-2 py-2.5 rounded text-[13px] flex items-center justify-between"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                  background: isActive ? 'var(--amber-dim)' : undefined,
                })}
              >
                <span>{item.label}</span>
                <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{item.service}</span>
              </NavLink>
            ))}
            <a
              href="/resume/Yann_Gilbert_Resume.pdf"
              download="Yann_Gilbert_Resume.pdf"
              onClick={handleResumeClick}
              className="mt-1 px-2 py-2.5 rounded text-[13px] text-center font-semibold"
              style={{ background: 'var(--amber)', color: '#1a1206' }}
            >
              ↓ download resume
            </a>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <ResumeModal open={resumeModalOpen} onClose={() => setResumeModalOpen(false)} />

      <footer className="border-t py-8 px-5 md:px-8" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-[12px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
          <span>© {new Date().getFullYear()} Yann Gilbert — built with React + TypeScript</span>
          <a href="https://github.com/ybg94" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: 'var(--text-dim)' }}>
            github.com/ybg94
          </a>
        </div>
      </footer>
    </div>
  )
}
