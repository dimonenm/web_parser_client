'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import styles from './page.module.css'

interface IPost {
  type: 'p' | 'reel'
  shortCode: string
  picUrls: string[]
}

const PAGE_SIZE = 12

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<IPost[]>([])
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const galleryRef = useRef<HTMLDivElement>(null)

  const extractUsername = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed.includes('/')) return trimmed
    try {
      const url = new URL(trimmed)
      return url.pathname.split('/').filter(Boolean)[0] ?? trimmed
    } catch {
      return trimmed
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setPosts([])
    setVisible(PAGE_SIZE)

    try {
      const response = await fetch(
        `/api/instagram/get_all_pics/?id=${encodeURIComponent(extractUsername(query))}`,
        { cache: 'no-store' },
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (posts.length && galleryRef.current) {
      galleryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [posts])

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
      <main
        className={`${styles.main_content} ${posts.length ? styles.main_content_top : ''}`}
      >
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

        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            <span className={styles.loading_text}>
              Собираем фото… это может занять несколько минут
            </span>
          </div>
        )}

        {error && <p className={styles.error_text}>{error}</p>}
      </main>

      {/* Gallery */}
      {posts.length > 0 && (
        <section className={styles.gallery_section} ref={galleryRef}>
          <h2 className={styles.gallery_title}>
            {extractUsername(query)} — {posts.length}
          </h2>

          <div className={styles.gallery_grid}>
            {posts.slice(0, visible).map(post => (
              <article key={post.shortCode} className={styles.card}>
                <span className={styles.card_title}>
                  {post.type === 'reel' && <span className={styles.reel_badge}>Reel</span>}
                  {post.shortCode}
                </span>

                <div className={styles.images}>
                  {post.picUrls.map((url, i) => (
                    <GalleryImage
                      key={`${post.shortCode}_${i}`}
                      src={url}
                      alt={`${post.shortCode} — ${i + 1}`}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>

          {visible < posts.length && (
            <button
              type='button'
              className={styles.load_more}
              onClick={() => setVisible(v => v + PAGE_SIZE)}
            >
              Показать ещё ({posts.length - visible})
            </button>
          )}
        </section>
      )}
    </div>
  )
}

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <div className={`${styles.image} ${styles.image_broken}`}>⚠</div>
  }

  return (
    <img
      className={styles.image}
      src={src}
      alt={alt}
      loading='lazy'
      referrerPolicy='no-referrer'
      onError={() => setFailed(true)}
    />
  )
}