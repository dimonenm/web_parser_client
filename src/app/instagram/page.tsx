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

type TaskStage = 'running' | 'done' | null

interface ITaskState {
  stage: TaskStage
  status: IStatusData | null
}

const API = 'http://localhost:3000/instagram'
const POLL_INTERVAL = 2000

const EMPTY_TASK: ITaskState = { stage: null, status: null }

type TimerRef = { current: ReturnType<typeof setTimeout> | null }

const percentOf = (status: IStatusData | null): number =>
  status && status.total > 0
    ? Math.min(100, Math.round((status.current / status.total) * 100))
    : 0

// Индикатор одной задачи. Вынесен на уровень модуля, чтобы не пересоздавался
// при каждом рендере страницы.
const TaskIndicator = ({
  title,
  task,
}: {
  title: string
  task: ITaskState
}) => {
  if (!task.stage && !task.status) return null

  const running = task.stage === 'running'
  const percent = percentOf(task.status)

  return (
    <div className={`${styles.loading} ${styles.loading_column}`}>
      <div className={styles.loading_row}>
        {running && <span className={styles.spinner} />}
        <span className={styles.loading_title}>{title}</span>
        <span className={running ? styles.loading_text : styles.loading_done}>
          {running ? 'в работе…' : 'Готово'}
        </span>
      </div>

      {task.status && (
        <div className={styles.progress_wrap}>
          <div
            className={styles.progress_track}
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={task.status.total}
            aria-valuenow={task.status.current}
          >
            <div
              className={styles.progress_bar}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className={styles.loading_text}>
            {task.status.current} / {task.status.total} ({percent}%)
          </span>
        </div>
      )}
    </div>
  )
}

export default function InstagramShortCodesPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [codes, setCodes] = useState<IShortCode[]>([])
  const [error, setError] = useState('')

  // две независимые задачи — два независимых состояния
  const [codesTask, setCodesTask] = useState<ITaskState>(EMPTY_TASK)
  const [postsTask, setPostsTask] = useState<ITaskState>(EMPTY_TASK)

  const codesTimerRef = useRef<TimerRef['current']>(null)
  const postsTimerRef = useRef<TimerRef['current']>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // console.log('codes: ', codes)

  // ===== инфраструктура опроса =====

  const clearTimers = () => {
    if (codesTimerRef.current) clearTimeout(codesTimerRef.current)
    if (postsTimerRef.current) clearTimeout(postsTimerRef.current)
    codesTimerRef.current = null
    postsTimerRef.current = null
  }

  const stopAll = () => {
    clearTimers()
    abortRef.current?.abort()
    abortRef.current = null
  }

  // sleep привязан к таймеру своей задачи — опросы не затирают друг друга
  const sleep = (timerRef: TimerRef, ms: number) =>
    new Promise<void>(resolve => {
      timerRef.current = setTimeout(resolve, ms)
    })

  const fetchJson = async <T,>(
    url: string,
    signal: AbortSignal,
  ): Promise<T> => {
    const response = await fetch(url, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    return (await response.json()) as T
  }

  const pollStatus = async (opts: {
    url: string
    signal: AbortSignal
    timerRef: TimerRef
    onStatus: (status: IStatusData) => void
  }): Promise<void> => {
    for (;;) {
      const status = await fetchJson<IStatusData>(opts.url, opts.signal)
      opts.onStatus(status)

      if (!status.running) return

      await sleep(opts.timerRef, POLL_INTERVAL)
    }
  }

  // ===== две независимые цепочки =====

  const runCodesTask = async (username: string, signal: AbortSignal) => {
    setCodesTask({ stage: 'running', status: null })

    const start = await fetchJson(
      `${API}/start_get_all_short_codes_v2?id=${encodeURIComponent(username)}`,
      signal,
    )
    console.log('startGetAllShortCodesV2: ', start)

    await pollStatus({
      url: `${API}/get_short_codes_status`,
      signal,
      timerRef: codesTimerRef,
      onStatus: status => setCodesTask(prev => ({ ...prev, status })),
    })

    const file = await fetchJson<IShortCode[]>(
      `${API}/get_short_codes_file?id=${encodeURIComponent(username)}`,
      signal,
    )
    setCodes(file)
    setCodesTask(prev => ({ stage: 'done', status: prev.status }))
  }

  const runPostsTask = async (username: string, signal: AbortSignal) => {
    setPostsTask({ stage: 'running', status: null })

    const start = await fetchJson(
      `${API}/start_get_all_posts?id=${encodeURIComponent(username)}`,
      signal,
    )
    console.log('startGetAllPosts: ', start)

    await pollStatus({
      url: `${API}/get_posts_status`,
      signal,
      timerRef: postsTimerRef,
      onStatus: status => setPostsTask(prev => ({ ...prev, status })),
    })

    setPostsTask(prev => ({ stage: 'done', status: prev.status }))
  }

  // ===== обработчики =====

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const username = query.trim()
    if (!username) return

    stopAll() // повторный сабмит не должен плодить второй комплект опросов
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setCodes([])
    setCodesTask(EMPTY_TASK)
    setPostsTask(EMPTY_TASK)
    setError('')

    // ошибка в любой цепочке показывает текст и останавливает вторую
    const guard = (task: Promise<void>) =>
      task.catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Ошибка при загрузке данных',
        )
        controller.abort()
      })

    try {
      // обе задачи стартуют и опрашиваются параллельно
      // await Promise.all([
      //   guard(runCodesTask(username, controller.signal)),
      //   guard(runPostsTask(username, controller.signal)),
      // ])

      // сначала short codes, посты — только после того как файл со шорткодами готов
      await guard(runCodesTask(username, controller.signal))
      if (!controller.signal.aborted)
        await guard(runPostsTask(username, controller.signal))
      
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        clearTimers()
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
    stopAll()
    setQuery('')
    setCodes([])
    setCodesTask(EMPTY_TASK)
    setPostsTask(EMPTY_TASK)
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

  useEffect(
    () => () => {
      // при unmount чистим оба таймера и незавершённые запросы
      if (codesTimerRef.current) clearTimeout(codesTimerRef.current)
      if (postsTimerRef.current) clearTimeout(postsTimerRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const showTasks =
    loading ||
    !!codesTask.stage ||
    !!postsTask.stage ||
    !!codesTask.status ||
    !!postsTask.status

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

        {/* Два независимых индикатора */}
        {showTasks && (
          <div className={styles.tasks_column}>
            <TaskIndicator title='Short codes' task={codesTask} />
            <TaskIndicator title='Posts' task={postsTask} />
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
