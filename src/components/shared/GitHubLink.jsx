// "Star on GitHub" link with a live star count. Counts are cached in localStorage for an
// hour so we don't hit GitHub's unauthenticated rate limit (60/hr) on every mount, and the
// count degrades gracefully to just the link if the API is unreachable or the repo is private.
import { useState, useEffect } from 'react'

const REPO = 'itssarthak/astrologer'
const REPO_URL = `https://github.com/${REPO}`
const CACHE_KEY = 'astro:githubStars'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

export default function GitHubLink({ className = '' }) {
  const [stars, setStars] = useState(null)

  useEffect(() => {
    let cancelled = false
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached && typeof cached.count === 'number') setStars(cached.count)
      if (cached && Date.now() - cached.at < CACHE_TTL) return // fresh enough, skip fetch
    } catch { /* ignore */ }

    fetch(`https://api.github.com/repos/${REPO}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data || typeof data.stargazers_count !== 'number') return
        setStars(data.stargazers_count)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ count: data.stargazers_count, at: Date.now() }))
        } catch { /* ignore */ }
      })
      .catch(() => { /* keep the link, just no count */ })

    return () => { cancelled = true }
  }, [])

  return (
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
      title="View source on GitHub"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-white text-text-2 text-xs font-medium hover:border-border-strong hover:text-text transition-colors ${className}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <span>Star</span>
      {stars != null && (
        <span className="flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-border text-text">
          <span aria-hidden="true">★</span>
          <span aria-label={`${stars} stars`}>{formatStars(stars)}</span>
        </span>
      )}
    </a>
  )
}
