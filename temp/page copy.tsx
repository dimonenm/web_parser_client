'use client'

import { ChangeEvent, SubmitEvent, useEffect, useRef, useState } from 'react'
import { IShortCode } from '@/interfaces/IShortCode'
import { Gallery } from '@/components/Gallery'

import styles from '../page.module.css'

interface IStatusData {
  current: number
  total: number
  running: boolean
}

export default function InstagramShortCodesPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [codes, setCodes] = useState<IShortCode[]>([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState<IStatusData | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postsPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // console.log('codes: ', codes)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setCodes([])
    setStatus(null)

    try {
      const response = await fetch(
        `http://localhost:3000/instagram/start_get_all_short_codes_v2?id=${encodeURIComponent(query)}`,
        { cache: 'no-store' },
      )
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)

      const resResponse = await response.json()
      console.log('startGetAllShortCodesV2: ', resResponse)

      await getShortCodesStatus() // лоадер закрывается внутри опроса

      try {
        const response = await fetch(
          `http://localhost:3000/instagram/start_get_all_posts?id=${encodeURIComponent(query)}`,
          { cache: 'no-store' },
        )
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`)

        const resResponse = await response.json()
        console.log('startGetAllPosts: ', resResponse)

        await getPostsStatus()
        
      } catch (err) {
        console.log('err: ', err)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка при загрузке данных',
      )
      setLoading(false)
    }
  }

  // открываем системный диалог выбора файла
  const handleDownloadFile = () => {
    if (loading) return
    fileInputRef.current?.click()
  }

  const handleClear = () => {
    stopPolling()
    setQuery('')
    setCodes([])
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

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }
  const stopPollingPostsTimer = () => {
    if (postsPollTimerRef.current) {
      clearTimeout(postsPollTimerRef.current)
      postsPollTimerRef.current = null
    }
  }

  const getShortCodesStatus = async () => {
    try {
      const response = await fetch(
        'http://localhost:3000/instagram/get_short_codes_status',
        { cache: 'no-store' },
      )
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)

      const data = (await response.json()) as IStatusData
      setStatus(data)

      if (!data.running) {
        stopPolling()
        setLoading(false) // только здесь снимаем лоадер
        getShortCodesFile()
        return
      }

      pollTimerRef.current = setTimeout(getShortCodesStatus, 2000)
    } catch (err) {
      stopPolling()
      setLoading(false)
      setError(
        err instanceof Error ? err.message : 'Ошибка при загрузке данных',
      )
    }
  }
  const getPostsStatus = async () => {
    try {
      const response = await fetch(
        'http://localhost:3000/instagram/get_posts_status',
        { cache: 'no-store' },
      )
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)

      const data = (await response.json()) as IStatusData
      setStatus(data)

      if (!data.running) {
        stopPollingPostsTimer()
        setLoading(false) // только здесь снимаем лоадер
        return
      }

      postsPollTimerRef.current = setTimeout(getPostsStatus, 2000)
    } catch (err) {
      stopPollingPostsTimer()
      setLoading(false)
      setError(
        err instanceof Error ? err.message : 'Ошибка при загрузке данных',
      )
    }
  }
  const getShortCodesFile = async (): Promise<void> => {
    if (!query.trim()) return

    try {
      const response = await fetch(
        `http://localhost:3000/instagram/get_short_codes_file?id=${encodeURIComponent(query)}`,
        {
          cache: 'no-store',
        },
      )
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`)

      const data = (await response.json()) as IShortCode[]
      setCodes(data)
    } catch (err) {
      stopPolling()
      setLoading(false)
      setError(
        err instanceof Error ? err.message : 'Ошибка при загрузке данных',
      )
    }
  }

  useEffect(() => () => stopPolling(), [])

  const percent =
    status && status.total > 0
      ? Math.min(100, Math.round((status.current / status.total) * 100))
      : 0

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
        className={`${styles.main_content} ${codes.length ? styles.main_content_top : ''}`}
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

        {/* {(loading || status) && (
          <div className={styles.loading}>
            {status?.running && <span className={styles.spinner} />}
            <span className={styles.loading_text}>
              {status?.running
                ? 'Собираем short codes… это может занять несколько минут'
                : 'Готово'}
            </span>
            {status && (
              <span className={styles.loading_text}>
                {status.current} / {status.total}
              </span>
            )}
          </div>
        )} */}

        {(loading || status) && (
          <div className={`${styles.loading} ${styles.loading_column}`}>
            <div className={styles.loading_row}>
              {status?.running && <span className={styles.spinner} />}
              <span className={styles.loading_text}>
                {status?.running
                  ? 'Собираем short codes… это может занять несколько минут'
                  : 'Готово'}
              </span>
            </div>

            {status && (
              <div className={styles.progress_wrap}>
                <div
                  className={styles.progress_track}
                  role='progressbar'
                  aria-valuemin={0}
                  aria-valuemax={status.total}
                  aria-valuenow={status.current}
                >
                  <div
                    className={styles.progress_bar}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className={styles.loading_text}>
                  {status.current} / {status.total} ({percent}%)
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className={styles.error_text}>{error}</p>}
      </main>

      {/* Short codes list */}
      {/*codes.length > 0 && (
				<section className={styles.gallery_section}>
					<Gallery codes={codes} username={query} />
				</section>
			)*/}
    </div>
  )
}
