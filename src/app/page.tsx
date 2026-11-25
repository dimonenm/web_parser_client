'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import styles from './page.module.css'
import { GalleryImage } from '@/components/GalleryImage'
import { IDownloadedPosts, IPost } from '@/interfaces/instagram.interfaces'

const API = 'http://localhost:3000/instagram'
const PAGE_SIZE = 12

// 'search' — прогон парсера по id профиля, 'downloaded' — готовый файл на диске
type GallerySource = 'search' | 'downloaded'

// бэкенд отдаёт JSON.stringify(posts) — на всякий случай разворачиваем строку
const unwrapJson = (data: unknown): unknown => {
  let value = data
  for (let i = 0; i < 2 && typeof value === 'string'; i++) {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

const parsePosts = (data: unknown): IPost[] => {
  const source = unwrapJson(data)
  const raw = Array.isArray(source)
    ? source
    : (source as { posts?: unknown })?.posts
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is IPost => {
      const post = item as Partial<IPost> | null
      return typeof post?.shortCode === 'string' && post.shortCode.length > 0
    })
    .map(post => ({
      type: typeof post.type === 'string' ? post.type : 'p',
      shortCode: post.shortCode,
      picUrls: Array.isArray(post.picUrls) ? post.picUrls : [],
    }))
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<IPost[]>([])
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [downloaded, setDownloaded] = useState<IDownloadedPosts[]>([])
  const [source, setSource] = useState<GallerySource>('search')
  const [deleting, setDeleting] = useState('')

  const galleryRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // Единая точка входа для галереи: и поиск, и клик по уже скачанной плитке
  const loadGallery = async (username: string, from: GallerySource) => {
    if (!username) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setSource(from)
    setError('')
    setPosts([])
    setVisible(PAGE_SIZE)

    // скачанное читаем с диска — это мгновенно и не трогает парсер
    const url =
      from === 'downloaded'
        ? `${API}/get_downloaded_posts?id=${encodeURIComponent(username)}`
        : `/api/instagram/get_all_pics/?id=${encodeURIComponent(username)}`

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const list = parsePosts(await response.json())

      if (!list.length) {
        setError(
          from === 'downloaded'
            ? 'В скачанной галерее нет постов'
            : 'Бэкенд вернул пустой список постов',
        )
        return
      }

      setPosts(list)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(
        err instanceof Error ? err.message : 'Ошибка при загрузке данных',
      )
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void loadGallery(extractUsername(query), 'search')
  }

  // удаляем файл галереи с диска и убираем плитку из списка
  const deleteDownloaded = async (id: string) => {
    if (!window.confirm(`Удалить скачанную галерею «${id}» с диска?`)) return

    setDeleting(id)
    setError('')

    try {
      const response = await fetch(
        `${API}/delete_downloaded_posts?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setDownloaded(list => list.filter(item => item.id !== id))

      // удалили ту же галерею, что открыта прямо сейчас — сворачиваем её
      if (source === 'downloaded' && extractUsername(query) === id) {
        setPosts([])
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось удалить галерею',
      )
    } finally {
      setDeleting('')
    }
  }

  // уже скачанные галереи — один раз при заходе на страницу
  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API}/get_all_downloaded_posts`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then((data: unknown) => {
        // бэкенд отдаёт массив либо объект-обёртку
        const raw = Array.isArray(data)
          ? data
          : (data as { posts?: unknown })?.posts
        if (!Array.isArray(raw)) return

        setDownloaded(
          raw.filter(
            (item): item is IDownloadedPosts =>
              typeof (item as IDownloadedPosts | null)?.id === 'string',
          ),
        )
      })
      .catch(err => {
        if (controller.signal.aborted) return
        console.warn('get_all_downloaded_posts недоступен:', err)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (posts.length && galleryRef.current) {
      galleryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [posts])

  // уход со страницы — отменяем незавершённый запрос
  useEffect(() => () => abortRef.current?.abort(), [])

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
              {source === 'downloaded'
                ? 'Открываем скачанную галерею…'
                : 'Собираем фото… это может занять несколько минут'}
            </span>
          </div>
        )}

        {error && <p className={styles.error_text}>{error}</p>}

        {/* Уже скачанные галереи — пока нет результатов поиска */}
        {!posts.length && downloaded.length > 0 && (
          <div className={styles.downloaded_block}>
            <h2 className={styles.gallery_title}>
              Уже скачано — {downloaded.length}
            </h2>

            <div className={styles.downloaded_grid}>
              {downloaded.map(item => (
                <div
                  key={item.id}
                  className={styles.downloaded_card}
                  title={item.id}
                >
                  <button
                    type='button'
                    className={styles.downloaded_open}
                    disabled={loading}
                    onClick={() => {
                      setQuery(item.id)
                      void loadGallery(item.id, 'downloaded')
                    }}
                  >
                    {item.firstPicUrl ? (
                      <img
                        className={styles.downloaded_img}
                        src={item.firstPicUrl}
                        alt={item.id}
                        loading='lazy'
                        referrerPolicy='no-referrer'
                        draggable={false}
                        onError={e => {
                          e.currentTarget.style.visibility = 'hidden'
                        }}
                      />
                    ) : (
                      <div
                        className={`${styles.downloaded_img} ${styles.image_broken}`}
                      >
                        ⚠
                      </div>
                    )}
                    <span className={styles.downloaded_title}>{item.id}</span>
                  </button>

                  <button
                    type='button'
                    className={styles.downloaded_delete}
                    title={`Удалить ${item.id} с диска`}
                    aria-label={`Удалить ${item.id} с диска`}
                    disabled={deleting === item.id}
                    onClick={e => {
                      e.stopPropagation()
                      void deleteDownloaded(item.id)
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
                  {post.type === 'reel' && (
                    <span className={styles.reel_badge}>Reel</span>
                  )}
                  {post.shortCode}
                </span>

                <div className={styles.images}>
                  {post.picUrls.length ? (
                    post.picUrls.map((url, i) => (
                      <GalleryImage
                        key={`${post.shortCode}_${i}`}
                        src={url}
                        alt={`${post.shortCode} — ${i + 1}`}
                      />
                    ))
                  ) : (
                    <div className={`${styles.image} ${styles.image_broken}`}>
                      ⚠
                    </div>
                  )}
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
