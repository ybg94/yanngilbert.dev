import { resume } from '../data/resume'

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="text-[11px] px-1.5 py-0.5 rounded"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)', background: 'var(--amber-dim)' }}
      >
        {n}
      </span>
      <h2 className="text-[13px] tracking-[0.14em] uppercase" style={{ color: 'var(--text-dim)' }}>
        {children}
      </h2>
      <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
    </div>
  )
}

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
      {/* Hero */}
      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-start mb-16">
        <div>
          <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 13 }}>
            <span className="status-dot on" />
            <span>available for full-time ML/AI engineering roles</span>
          </div>
          <h1 className="text-[44px] md:text-[64px] leading-[1.02] mb-4">{resume.name}</h1>
          <p className="text-[17px] md:text-[19px] mb-6" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {resume.title} <span style={{ color: 'var(--text-faint)' }}>/</span> M.S. AI candidate
          </p>
          <p className="max-w-2xl leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            {resume.summary}
          </p>
        </div>
      </div>

      {/* Core skills */}
      <div className="mb-16">
        <SectionLabel n="01">Core Skills</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resume.coreSkills.map((e) => (
            <div key={e.area} className="p-5 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
              <h3 className="text-[13px] mb-3" style={{ color: 'var(--teal)' }}>{e.area}</h3>
              <div className="flex flex-wrap gap-1.5">
                {e.items.map((i) => (
                  <span
                    key={i}
                    className="text-[12px] px-2 py-1 rounded"
                    style={{ background: 'var(--bg-inset)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employment history */}
      <div className="mb-16">
        <SectionLabel n="02">Employment History</SectionLabel>
        <div className="space-y-6">
          {resume.employment.map((job) => (
            <div key={job.company} className="p-6 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h3 className="text-[16px]">{job.role}</h3>
                <span className="text-[12px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{job.period}</span>
              </div>
              <p className="text-[13px] mb-3" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{job.company}</p>
              <p className="text-[14px] mb-3" style={{ color: 'var(--text-dim)' }}>{job.summary}</p>
              <ul className="space-y-1.5">
                {job.duties.map((d) => (
                  <li key={d} className="text-[13.5px] leading-relaxed pl-4 relative" style={{ color: 'var(--text-dim)' }}>
                    <span className="absolute left-0" style={{ color: 'var(--teal)' }}>▸</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Education + Languages */}
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <SectionLabel n="03">Education</SectionLabel>
          <div className="space-y-4">
            {resume.education.map((ed) => (
              <div key={ed.degree} className="p-4 rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
                <h3 className="text-[14px] mb-1">{ed.degree}</h3>
                <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>{ed.school}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{ed.period}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel n="04">Languages</SectionLabel>
          <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}>
            {resume.languages.map((l) => (
              <div key={l.name} className="flex items-center justify-between text-[13.5px]">
                <span>{l.name}</span>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{l.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
