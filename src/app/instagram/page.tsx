'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { Gallery } from '@/components/Gallery'

import styles from '../page.module.css'
import {
  IGalleryItem,
  IPost,
  IStatusData,
} from '@/interfaces/instagram.interfaces'

const API = 'http://localhost:3000/instagram'
const POLL_INTERVAL = 3000
const POLL_TIMEOUT = 5 * 60_000

// GET get_all_posts_from_gallary → JSON.stringify(IPost[]);
// приводим к карточкам сетки, добавляя index
const parsePosts = (data: unknown): IGalleryItem[] => {
  const raw = Array.isArray(data) ? data : (data as { posts?: unknown }).posts
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is IPost => {
      const post = item as Partial<IPost> | null
      return typeof post?.shortCode === 'string' && post.shortCode.length > 0
    })
    .map((post, index) => ({
      shortCode: post.shortCode,
      type: typeof post.type === 'string' ? post.type : 'p',
      picUrls: Array.isArray(post.picUrls) ? post.picUrls : [],
      index,
    }))
}

export default function InstagramGelleryPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [gelleryItems, setGelleryItems] = useState<IGalleryItem[]>([])
  const [status, setStatus] = useState<IStatusData | null>(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // GET {API}/get_short_codes_status → { current, total, running }
  const fetchStatus = async (signal: AbortSignal): Promise<IStatusData> => {
    const response = await fetch(`${API}/get_short_codes_status`, {
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = (await response.json()) as IStatusData
    setStatus(data)
    return data
  }

  // ===== обработчики =====

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const username = query.trim()
    if (!username) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError('')
    setGelleryItems([])
    setStatus(null)

    try {
      // 1) запускаем основной запрос и НЕ ждём его — бэкенд отдаст JSON,
      //    когда соберёт все посты
      const postsPromise = fetch(
        `${API}/get_all_posts_from_gallary?id=${encodeURIComponent(username)}`,
        { cache: 'no-store', signal: controller.signal },
      ).then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return parsePosts(await response.json())
      })

      // страхуем от unhandled rejection на время поллинга:
      // настоящая ошибка будет достанется через await ниже
      postsPromise.catch(() => undefined)

      let arrived = false
      postsPromise.then(
        () => {
          arrived = true
        },
        () => {
          arrived = true
        },
      )

      // 2) параллельно опрашиваем прогресс. Это косметика —
      //    ронять загрузку галереи из-за него нельзя
      try {
        const deadline = Date.now() + POLL_TIMEOUT
        let current = await fetchStatus(controller.signal)

        while (current.running && !arrived && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
          if (controller.signal.aborted) return
          current = await fetchStatus(controller.signal)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('get_short_codes_status недоступен:', err)
      }

      // 3) вот здесь дожидаемся реально ответа с постами
      const posts = await postsPromise

      if (!posts.length) {
        setError('Бэкенд вернул пустой список постов')
        return
      }

      setGelleryItems(posts)
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

  // открываем системный диалог выбора файла
  const handleDownloadFile = () => {
    if (loading) return
    fileInputRef.current?.click()
  }

  const handleClear = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setQuery('')
    setGelleryItems([])
    setStatus(null)
    setError('')
    setLoading(false)
    setDownloading(false)
  }

  // читаем выбранный файл и подставляем id в поле поиска
  const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // сброс, чтобы повторный выбор того же файла снова сработал
    if (!file) return

    setDownloading(true)
    setError('')

    try {
      const text = await file.text()
      const id =
        text
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(Boolean) ?? ''

      if (!id) throw new Error('В файле нет данных')

      setQuery(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл')
    } finally {
      setDownloading(false)
    }
  }

  // уход со страницы — отменяем незавершённые запросы
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
        className={`${styles.main_content} ${gelleryItems.length ? styles.main_content_top : ''}`}
      >
        <h1 className={styles.title}>Instagram short codes</h1>
        <p className={styles.subtitle}>
          Get the list of short codes for all posts and reels of a profile.
        </p>

        {/* Search Form */}
        <form className={styles.search_form} onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type='file'
            accept='.txt,text/plain'
            className={styles.hidden}
            onChange={handleFileChosen}
          />

          <button
            type='button'
            className={styles.download_button}
            onClick={handleDownloadFile}
            disabled={loading || downloading}
          >
            <svg
              className={styles.search_icon}
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M12 3v12' />
              <path d='m7 10 5 5 5-5' />
              <path d='M5 21h14' />
            </svg>
            {downloading ? 'Downloading...' : 'Download file'}
          </button>

          <div className={styles.search_field}>
            <input
              type='text'
              className={styles.search_input}
              placeholder='Search or paste the Instagram URL'
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            {query && (
              <button
                type='button'
                className={styles.clear_button}
                onClick={handleClear}
                aria-label='Сбросить'
              >
                <svg
                  className={styles.clear_icon}
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                >
                  <path d='M18 6 6 18' />
                  <path d='m6 6 12 12' />
                </svg>
              </button>
            )}
          </div>

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

        {error && <p className={styles.error_text}>{error}</p>}
      </main>

      {loading && status && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <span className={styles.loading_text}>
            Обработка: {status.current} / {status.total}
          </span>
        </div>
      )}

      {gelleryItems.length > 0 && (
        <section className={styles.gallery_section}>
          <Gallery items={gelleryItems} username={query} />
        </section>
      )}
    </div>
  )
}
