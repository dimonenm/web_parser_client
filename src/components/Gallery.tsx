'use client'

import { useEffect, useRef, useState } from 'react'

import { IGalleryItem } from '@/interfaces/instagram.interfaces'
import { GalleryImage } from '@/components/GalleryImage'
import styles from '@/app/page.module.css'

const PAGE_SIZE = 20

// стабильная ссылка для дефолта — иначе effect сброса триггерится на каждый рендер
const NO_ITEMS: IGalleryItem[] = []

export function Gallery({
  items = NO_ITEMS,
  username,
}: {
  items?: IGalleryItem[]
  username: string
}) {
  const [page, setPage] = useState(0)

  // Новый поиск → родитель передаёт новый массив → возвращаемся на первую страницу
  useEffect(() => {
    setPage(0)
  }, [items])

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  // страховка: items мог измениться, пока page указывал за границу
  const current = Math.min(page, pages - 1)
  const from = current * PAGE_SIZE
  const slice = items.slice(from, from + PAGE_SIZE)

  const go = (next: number) => {
    setPage(Math.min(Math.max(next, 0), pages - 1))
    // на новой странице смотрим сверху, а не с середины предыдущей
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const topRef = useRef<HTMLHeadingElement>(null)

  return (
    <>
      <h2 ref={topRef} className={styles.gallery_title}>
        {username} — {items.length}
      </h2>

      <div className={styles.gallery_grid}>
        {slice.map((item, index) => {
          const urls = item.picUrls ?? []

          return (
            <article key={item.shortCode} className={styles.card}>
              <span className={styles.card_title}>
                <span className={styles.card_index}>{from + index + 1}</span>
                {item.type === 'reel' && (
                  <span className={styles.reel_badge}>Reel</span>
                )}
                {item.type === 'p' && <span className={styles.p_badge}>P</span>}
                {item.shortCode}
              </span>

              <div className={styles.images}>
                {urls.length ? (
                  urls.map((url, i) => (
                    <GalleryImage
                      key={`${item.shortCode}_${i}`}
                      src={url}
                      alt={`${item.shortCode} — ${i + 1}`}
                    />
                  ))
                ) : (
                  <div className={`${styles.image} ${styles.image_broken}`}>
                    ⚠
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {pages > 1 && (
        <div className={styles.pager}>
          <button
            type='button'
            className={styles.load_more}
            onClick={() => go(current - 1)}
            disabled={current === 0}
          >
            Назад
          </button>

          <span className={styles.pager_info}>
            {current + 1} / {pages} · {from + 1}–{from + slice.length} из{' '}
            {items.length}
          </span>

          <button
            type='button'
            className={styles.load_more}
            onClick={() => go(current + 1)}
            disabled={current >= pages - 1}
          >
            Далее
          </button>
        </div>
      )}
    </>
  )
}
