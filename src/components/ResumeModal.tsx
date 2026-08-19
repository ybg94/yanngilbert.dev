import { useEffect } from 'react'

const LINKEDIN_URL = 'https://www.linkedin.com/in/yann-gilbert-42b9bb186/'

export default function ResumeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      style={{ background: 'rgba(8,10,16,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border p-6"
        style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[14.5px] leading-relaxed mb-5" style={{ color: 'var(--text)' }}>
          Thank you for downloading my resume! If you need to reach me for anything, please
          contact me on LinkedIn.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-[13.5px] transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--amber)', color: '#1a1206', fontFamily: 'var(--font-mono)' }}
          >
            view linkedin
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-[13.5px] border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--line)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
          >
            close
          </button>
        </div>
      </div>
    </div>
  )
}
