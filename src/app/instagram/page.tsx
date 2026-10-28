'use client'

import { ChangeEvent, SubmitEvent, useEffect, useRef, useState } from 'react'
import { IShortCode } from '@/interfaces/IShortCode'
import { Gallery } from '@/components/Gallery'

import styles from '../page.module.css'
import { IGalleryItem } from '@/interfaces/IGelleryItems'

interface IStatusData {
  current: number
  total: number
  running: boolean
}

const API = 'http://localhost:3000/instagram'

export default function InstagramGelleryPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [gelleryItems, setGelleryItems] = useState<IGalleryItem[]>([])
  const [status, setStatus] = useState<IStatusData | null>(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const POLL_INTERVAL = 3000

  // GET /api/instagram/get_short_codes_status → { current, total, running }
  const fetchStatus = async (): Promise<IStatusData> => {
    const response = await fetch(`${API}/get_short_codes_status`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: IStatusData = await response.json()
    setStatus(data)
    return data
  }

  // ===== обработчики =====

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const username = query.trim()
    if (!username) return

    setLoading(true)
    setError('')
    setGelleryItems([])
    setStatus(null)

  try {
    const response = await fetch(
      `${API}/get_all_posts_from_gallary?id=${encodeURIComponent(username)}`,
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    // 1) опрашиваем статус, пока бэкенд обрабатывает посты
    let current = await fetchStatus()
    while (current.running) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
      current = await fetchStatus()
    }

    // 2) сервер ответил — раскладываем JSON сразу в gelleryItems
    const data = await response.json()
    const posts = (
      Array.isArray(data) ? data : (data.posts ?? [])
    ) as (IShortCode & {
      picUrls?: string[]
    })[]

    setGelleryItems(
      posts.map((post, index) => ({
        shortCode: post.shortCode,
        type: post.type,
        index,
        previewUrl: post.picUrls?.[0] ?? '',
        picUrls: post.picUrls ?? [],
      })),
    )
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
  } finally {
    setLoading(false)
  }
  }

  // открываем системный диалог выбора файла
  const handleDownloadFile = () => {
    if (loading) return
    fileInputRef.current?.click()
  }

  const handleClear = () => {
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

      console.log('id: ', id)
      setQuery(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл')
    } finally {
      setDownloading(false)
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
