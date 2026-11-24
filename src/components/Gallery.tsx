'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { IGalleryItem } from '@/interfaces/instagram.interfaces'
import { GalleryImage } from '@/components/GalleryImage'
import styles from '@/app/page.module.css'

const PAGE_SIZE = 10

// стабильная ссылка для дефолта — иначе deps effect'а менялись бы на каждый рендер
const NO_ITEMS: IGalleryItem[] = []

// одна группа = один id: свой заголовок, своя сетка, своя пагинация
type IGalleryGroup = {
  username: string
  items: IGalleryItem[]
}

// раскладываем плоской массив по группам в порядке появления id;
// один и тот же id из файла дважды собирается в одну группу
const buildGroups = (
  items: IGalleryItem[],
  fallback: string,
): IGalleryGroup[] => {
  const groups: IGalleryGroup[] = []
  const buckets = new Map<string, IGalleryItem[]>()

  for (const item of items) {
    const name = item.username || fallback || '—'
    const existing = buckets.get(name)

    if (existing) {
      existing.push(item)
      continue
    }

    const bucket: IGalleryItem[] = [item]
    buckets.set(name, bucket)
    groups.push({ username: name, items: bucket })
  }

  return groups
}

// ===== Внутренний компонент группы (свой хедер, сетка, пагинация) =====
function GallerySection({ group }: { group: IGalleryGroup }) {
  const [page, setPage] = useState(0)

  const lengthRef = useRef(group.items.length)

  // новый поиск по тому же id: массив стал короче — сбрасываем на первую страницу
  useEffect(() => {
    if (group.items.length < lengthRef.current) setPage(0)
    lengthRef.current = group.items.length
  }, [group.items])

  const pages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const from = current * PAGE_SIZE
  const slice = group.items.slice(from, from + PAGE_SIZE)

  const go = (next: number) => {
    setPage(Math.min(Math.max(next, 0), pages - 1))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const topRef = useRef<HTMLHeadingElement>(null)

  return (
    <section className={styles.gallery_section}>
      <h2 ref={topRef} className={styles.gallery_title}>
        {group.username} — {group.items.length}
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
            {group.items.length}
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
    </section>
  )
}

// ===== Экспортируемый компонент =====
export function Gallery({
  items = NO_ITEMS,
  username,
}: {
  items?: IGalleryItem[]
  username: string
}) {
  const groups = useMemo(() => buildGroups(items, username), [items, username])

  if (!groups.length) return null

  return (
    <>
      {groups.map(group => (
        <GallerySection key={group.username} group={group} />
      ))}
    </>
  )
}