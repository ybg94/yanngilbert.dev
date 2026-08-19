import { useEffect, useState } from 'react'

const USERNAME = 'ybg94'

interface Repo {
  id: number
  name: string
  description: string | null
  html_url: string
  stargazers_count: number
  language: string | null
  updated_at: string
  fork: boolean
}

export default function GitHubProjects() {
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=100`)
      .then((r) => {
        if (!r.ok) throw new Error(`GitHub API returned ${r.status}`)
        return r.json()
      })
      .then((data: Repo[]) => setRepos(data.filter((r) => !r.fork)))
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
      <div className="flex items-center gap-2 mb-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 13 }}>
        <span className="status-dot on" />
        <span>github.com/{USERNAME}</span>
      </div>
      <h1 className="text-[36px] md:text-[44px] mb-4">Miscellaneous Projects</h1>
      <p className="max-w-2xl mb-10" style={{ color: 'var(--text-dim)' }}>
        Everything outside the three featured demos lives here — smaller experiments, scripts, and
        repos pulled live from GitHub.
      </p>

      {error && (
        <div className="p-4 rounded-lg border mb-6 text-[13.5px]" style={{ borderColor: 'var(--rose)', background: 'var(--rose-dim)', color: 'var(--text)' }}>
          Couldn't load repos ({error}).{' '}
          <a href={`https://github.com/${USERNAME}`} target="_blank" rel="noreferrer" className="underline">
            View the profile directly instead.
          </a>
        </div>
      )}

      {!repos && !error && (
        <div className="p-6 rounded-lg border text-[13.5px]" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          fetching repositories…
        </div>
      )}

      {repos && repos.length === 0 && (
        <div className="p-6 rounded-lg border text-[13.5px]" style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
          No public repositories yet.
        </div>
      )}

      {repos && repos.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {repos.map((repo) => (
            <a
              key={repo.id}
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="p-5 rounded-lg border block transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--line)', background: 'var(--bg-raised)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-[15px]" style={{ color: 'var(--teal)' }}>{repo.name}</h3>
                {repo.stargazers_count > 0 && (
                  <span className="text-[12px]" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                    ★ {repo.stargazers_count}
                  </span>
                )}
              </div>
              <p className="text-[13.5px] mb-3 min-h-[2.5em]" style={{ color: 'var(--text-dim)' }}>
                {repo.description || 'No description provided.'}
              </p>
              <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {repo.language && <span>{repo.language}</span>}
                <span>updated {new Date(repo.updated_at).toLocaleDateString()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
