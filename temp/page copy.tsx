'use client'

import { useState } from 'react'
import styles from "./page.module.css"

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  console.log('result: ', result)
  //helen_vamp

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/instagram/get_all_pics/?id=${encodeURIComponent(query)}`,
        {
          cache: 'no-store',
          keepalive: true
        },
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : 'Ошибка при загрузке данных',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <a href='/' className={styles.logo}>
          <div className={styles.logo_icon}>W</div>
          <span className={styles.logo_text}>Web Parser</span>
        </a>

        <nav className={styles.nav}>
          <a href='/instagram' className={styles.nav_link}>
            Instagram
          </a>
          <a href='/top-instagram' className={styles.nav_link}>
            Reserv
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className={styles.main_content}>
        <h1 className={styles.title}>Instagram viewer and downloader</h1>
        <p className={styles.subtitle}>
          Help view and download Instagram photos and videos from profiles,
          posts and stories.
        </p>

        {/* Search Form */}
        <form className={styles.search_form} onSubmit={handleSubmit}>
          <input
            type='text'
            className={styles.search_input}
            placeholder='Search or paste the Instagram URL'
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button
            type='submit'
            className={styles.search_button}
            disabled={loading}
          >
            <svg
              className={styles.search_icon}
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <circle cx='11' cy='11' r='8' />
              <path d='m21 21-4.35-4.35' />
            </svg>
            {loading ? 'Loading...' : 'Search'}
          </button>
        </form>
      </main>
    </div>
  )
}