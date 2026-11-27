'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { BatchProgress } from '@/components/BatchProgress'
import { Gallery } from '@/components/Gallery'

import styles from '../page.module.css'
import {
  IBatchTask,
  IGalleryItem,
  IPost,
  IStatusData,
} from '@/interfaces/instagram.interfaces'
import { formatDuration } from '@/utils/format'

const API = 'http://localhost:3000/instagram'
const POLL_INTERVAL = 2000
// реальный прогон на бэкенде ~5-10 мин, старых 5 мин не хватало
const POLL_TIMEOUT = 20 * 60_000

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

const parsePosts = (data: unknown): IGalleryItem[] => {
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
  const [tasks, setTasks] = useState<IBatchTask[]>([])
  const [status, setStatus] = useState<IStatusData | null>(null)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // номер пакетного прогона: Clear или новый поиск останавливает старый цикл файла
  const batchRunRef = useRef(0)

  const updateTask = (taskIndex: number, patch: Partial<IBatchTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.index === taskIndex ? { ...task, ...patch } : task,
      ),
    )
  }

  // GET {API}/get_posts_status → IStatusData
  const fetchStatus = async (
    signal: AbortSignal,
    username: string,
  ): Promise<IStatusData> => {
    const response = await fetch(`${API}/get_posts_status`, {
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = (await response.json()) as IStatusData
    // прогресс чужого профиля показывать нельзя
    if (data.id === username) setStatus(data)
    return data
  }

  // ===== обработчики =====

  // общий запуск: и из формы, и по ?id=, прилетевшему с главной,
  // и построчный прогон id из файла
  // append=true — дописываем посты к уже показанным, а не затираем галерею
  // taskIndex — номер строки в файле, к которой относится этот запуск
  const loadGallery = async (
    username: string,
    append = false,
    taskIndex?: number,
  ) => {
    if (!username) return

    // одиночный запуск отменяет пакетный прогон файла
    if (taskIndex === undefined) {
      batchRunRef.current += 1
      setTasks([])
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const taskStartedAt = Date.now()

    if (taskIndex !== undefined) {
      updateTask(taskIndex, { state: 'running', error: null })
    }

    setLoading(true)
    setError('')
    setGelleryItems(prev => (append ? prev : []))
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
        return parsePosts(await response.json()).map(post => ({
          ...post,
          username,
        }))
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
      let latest: IStatusData | null = null

      try {
        const deadline = Date.now() + POLL_TIMEOUT
        let current = await fetchStatus(controller.signal, username)

        if (current.id === username) {
          latest = current
          if (taskIndex !== undefined) {
            updateTask(taskIndex, {
              current: current.current,
              total: current.total,
              elapsedMs: current.elapsedMs,
            })
          }
        }

        while (!arrived && Date.now() < deadline) {
          // наш прогон завершился — дальше ждать смысла нет
          if (current.id === username && !current.running) break

          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
          if (controller.signal.aborted) return
          current = await fetchStatus(controller.signal, username)

          if (current.id === username) {
            latest = current
            if (taskIndex !== undefined) {
              updateTask(taskIndex, {
                current: current.current,
                total: current.total,
                elapsedMs: current.elapsedMs,
              })
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('get_posts_status недоступен:', err)
      }

      // 3) вот здесь дожидаемся реального ответа с постами
      const posts = await postsPromise

      // после ответа статус уже финальный — забираем его для строки прогресса
      let finalStatus = latest
      if (!controller.signal.aborted) {
        try {
          const data = await fetchStatus(controller.signal, username)
          if (data.id === username) finalStatus = data
        } catch {
          // статус — косметика, ошибку загрузки постов он не отменяет
        }
      }

      if (finalStatus?.error) {
        setError(`Бэкенд: ${finalStatus.error}`)
        if (taskIndex !== undefined) {
          updateTask(taskIndex, {
            state: 'error',
            error: finalStatus.error,
            current: finalStatus.current,
            total: finalStatus.total,
            elapsedMs: finalStatus.elapsedMs || Date.now() - taskStartedAt,
          })
        }
        return
      }

      if (!posts.length) {
        // при пакетном прогоне пустой профиль не должен стирать уже собранное
        if (!append) setError('Бэкенд вернул пустой список постов')
        else console.warn(`Нет постов для: ${username}`)

        if (taskIndex !== undefined) {
          // 0 постов — это не успех: страница профиля не загрузилась
          // (ERR_QUIC_PROTOCOL_ERROR, селектор поста не найден и т.п.)
          const message =
            finalStatus?.error ??
            (finalStatus?.total === 0
              ? 'Профиль не загрузился: 0 постов из 0'
              : `Не собрано ни одного поста из ${finalStatus?.total ?? 0}`)

          updateTask(taskIndex, {
            state: 'error',
            error: message,
            current: 0,
            total: finalStatus?.total ?? 0,
            elapsedMs: finalStatus?.elapsedMs || Date.now() - taskStartedAt,
            postsCount: 0,
          })
        }
        return
      }

      setGelleryItems(prev => {
        if (!append) return posts

        // переиндексируем, чтобы ключи/номера в галерее не дублировались
        const offset = prev.length
        return [
          ...prev,
          ...posts.map((post, i) => ({ ...post, index: offset + i })),
        ]
      })

      if (taskIndex !== undefined) {
        updateTask(taskIndex, {
          state: 'success',
          current: posts.length,
          total: finalStatus?.total || posts.length,
          elapsedMs: finalStatus?.elapsedMs || Date.now() - taskStartedAt,
          postsCount: posts.length,
        })
      }
    } catch (err) {
      if (controller.signal.aborted) return

      const message =
        err instanceof Error ? err.message : 'Ошибка при загрузке данных'
      setError(message)

      if (taskIndex !== undefined) {
        updateTask(taskIndex, {
          state: 'error',
          error: message,
          elapsedMs: Date.now() - taskStartedAt,
        })
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await loadGallery(query.trim())
  }

  // открываем системный диалог выбора файла
  const handleDownloadFile = () => {
    if (loading) return
    fileInputRef.current?.click()
  }

  const handleClear = () => {
    batchRunRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setQuery('')
    setGelleryItems([])
    setTasks([])
    setStatus(null)
    setError('')
    setLoading(false)
    setDownloading(false)
  }

  // читаем id из файла построчно и прогоняем каждый через loadGallery
  const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // сброс, чтобы повторный выбор того же файла снова сработал
    if (!file) return

    setError('')

    try {
      const text = await file.text()
      const ids = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

      if (!ids.length) throw new Error('В файле нет id')

      const runId = ++batchRunRef.current

      // сразу показываем все строки файла, ещё до старта обработки
      setTasks(
        ids.map((id, i) => ({
          index: i + 1,
          id,
          state: 'pending',
          current: 0,
          total: 0,
          elapsedMs: 0,
          postsCount: 0,
          error: null,
        })),
      )

      setDownloading(true)

      for (let i = 0; i < ids.length; i++) {
        // Clear или новый поиск прервал этот пакетный прогон
        if (batchRunRef.current !== runId) break

        const id = ids[i]
        console.log(`[${i + 1}/${ids.length}] Загружаем: ${id}`)

        setQuery(id)
        await loadGallery(id, i > 0, i + 1)
      }

      console.log('Обработка файла завершена')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл')
    } finally {
      setDownloading(false)
    }
  }

  // /instagram?id=nasa — открываем галерею сразу, без клика по Search
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')?.trim()
    if (!id) return

    setQuery(id)
    void loadGallery(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // уход со страницы — отменяем незавершённые запросы
  useEffect(() => () => abortRef.current?.abort(), [])

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
        className={`${styles.main_content} ${gelleryItems.length || tasks.length ? styles.main_content_top : ''}`}
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

        {/* Пакетный прогресс по id из файла — сразу под формой */}
        {tasks.length > 0 && <BatchProgress tasks={tasks} />}

        {/* Одиночный индикатор — только когда нет пакетного списка */}
        {loading && status && tasks.length === 0 && (
          <div className={`${styles.loading} ${styles.loading_column}`}>
            <div className={styles.loading_row}>
              <span className={styles.spinner} />
              <span className={styles.loading_text}>
                {status.id}: {status.current} / {status.total} · раунд{' '}
                {status.round} · пройдено {status.scanned}
                {status.lastShortCode && ` · ${status.lastShortCode}`}
                {status.elapsedMs > 0 &&
                  ` · ${formatDuration(status.elapsedMs)}`}
              </span>
            </div>

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
                {percent}% · осталось ~
                {status.running && status.current > 0
                  ? formatDuration(
                      ((status.total - status.current) / status.current) *
                        status.elapsedMs,
                    )
                  : '—'}
              </span>
            </div>
          </div>
        )}

        {error && <p className={styles.error_text}>{error}</p>}
      </main>

      {gelleryItems.length > 0 && (
        <Gallery items={gelleryItems} username={query} />
      )}
    </div>
  )
}