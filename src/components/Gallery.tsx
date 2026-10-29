'use client'

import { useEffect, useRef, useState } from 'react'

import { IGalleryItem } from '@/interfaces/instagram.interfaces'
import { GalleryImage } from '@/components/GalleryImage'
import styles from '@/app/page.module.css'

const PAGE_SIZE = 20
const API = 'http://localhost:3000/instagram'

// стабильная ссылка для дефолта — иначе effect пересобирается на каждый рендер
const NO_ITEMS: IGalleryItem[] = []

// Бэкенд может вернуть строки, объекты с url или поле picUrls — сводим к string[]
const extractPics = (data: unknown): string[] => {
  const source = data as Record<string, unknown> | unknown[]
  const list = Array.isArray(source)
    ? source
    : Array.isArray(source?.picUrls)
      ? (source.picUrls as unknown[])
      : source?.url
        ? [source.url]
        : []

  return list
    .map(item =>
      typeof item === 'string' ? item : (item as Record<string, unknown>)?.url,
    )
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
}

export function Gallery({
  items = NO_ITEMS,
  username,
}: {
  items?: IGalleryItem[]
  username: string
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  // shortCode -> фото; [] значит «запрос выполнен, фото нет / ошибка»
  const [pics, setPics] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // журнал завершённых shortCode: не завязан на state, поэтому эффект не перезапускается
  const doneRef = useRef<Set<string>>(new Set())

  // Новый поиск → сброс пагинации, кэша фото и журнала
  useEffect(() => {
    doneRef.current = new Set()
    setVisible(PAGE_SIZE)
    setPics({})
    setError('')
  }, [items])

  // Карточки без picUrls в JSON докачиваем параллельно одной пачкой
  useEffect(() => {
    const pending = items
      .slice(0, visible)
      .filter(
        item => !item.picUrls?.length && !doneRef.current.has(item.shortCode),
      )

    if (!pending.length) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const run = async () => {
      const results = await Promise.allSettled(
        pending.map(async item => {
          const params = new URLSearchParams({
            type: item.type,
            shortCode: item.shortCode,
          })

          const response = await fetch(
            `${API}/get_pic_by_short_code?${params.toString()}`,
            { cache: 'no-store', signal: controller.signal },
          )
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          return extractPics(await response.json())
        }),
      )

      if (controller.signal.aborted) return

      const patch: Record<string, string[]> = {}

      results.forEach((result, i) => {
        const { shortCode } = pending[i]
        doneRef.current.add(shortCode)

        if (result.status === 'fulfilled') {
          patch[shortCode] = result.value
        } else {
          // одна упавшая карточка не должна останавливать остальные
          patch[shortCode] = []
          setError(
            result.reason instanceof Error
              ? result.reason.message
              : 'Ошибка при загрузке фото',
          )
        }
      })

      setPics(prev => ({ ...prev, ...patch }))
      setLoading(false)
    }

    run()

    return () => controller.abort()
  }, [items, visible])

  return (
    <>
      <h2 className={styles.gallery_title}>
        {username} — {items.length}
        {loading && <span className={styles.card_index}> Loading…</span>}
      </h2>

      {error && <p className={styles.error_text}>{error}</p>}

      <div className={styles.gallery_grid}>
        {items.slice(0, visible).map((item, index) => {
          // фото либо приехали с JSON поста, либо докачаны; undefined — ещё грузятся
          const urls = item.picUrls?.length
            ? item.picUrls
            : pics[item.shortCode]

          return (
            <article key={item.shortCode} className={styles.card}>
              <span className={styles.card_title}>
                <span className={styles.card_index}>{index + 1}</span>
                {item.type === 'reel' && (
                  <span className={styles.reel_badge}>Reel</span>
                )}
                {item.type === 'p' && <span className={styles.p_badge}>P</span>}
                {item.shortCode}
              </span>

              <div className={styles.images}>
                {urls?.length ? (
                  urls.map((url, i) => (
                    <GalleryImage
                      key={`${item.shortCode}_${i}`}
                      src={url}
                      alt={`${item.shortCode} — ${i + 1}`}
                    />
                  ))
                ) : (
                  <div className={`${styles.image} ${styles.image_broken}`}>
                    {urls ? '⚠' : '⏳'}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {visible < items.length && (
        <button
          type='button'
          className={styles.load_more}
          onClick={() => setVisible(v => v + PAGE_SIZE)}
        >
          Показать ещё ({items.length - visible})
        </button>
      )}
    </>
  )
}
