'use client'

import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import styles from '@/app/page.module.css'

const HINT_DEFAULT = 'Средняя кнопка — сохранить · Esc — закрыть'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

// <a download> игнорируется для cross-origin, поэтому качаем через blob
function triggerDownload(href: string, name: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function fileNameFromUrl(url: string, mime = ''): string {
  const path = url.split('?')[0].split('#')[0]
  const base = path.slice(path.lastIndexOf('/') + 1) || 'instagram'
  return /\.[a-z0-9]{2,5}$/i.test(base)
    ? base
    : `${base}.${EXT_BY_MIME[mime.split(';')[0].trim()] ?? 'jpg'}`
}

export function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [opened, setOpened] = useState(false) // открыт ли lightbox
  const [hint, setHint] = useState(HINT_DEFAULT)

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showHint = useCallback((text: string, ms = 2000) => {
    setHint(text)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => setHint(HINT_DEFAULT), ms)
  }, [])

  useEffect(
    () => () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    },
    [],
  )

  const close = useCallback(() => {
    setOpened(false)
    setHint(HINT_DEFAULT)
  }, [])

  // фон страницы не должен скроллиться, когда открыт лайтбокс
  useEffect(() => {
    if (!opened) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [opened])

  // Esc — закрываем
  useEffect(() => {
    if (!opened) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opened, close])

  const saveToDisk = async () => {
    showHint('Сохраняем…', 6000)

    try {
      const response = await fetch(src, {
        mode: 'cors',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok) throw new Error(String(response.status))

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      triggerDownload(url, fileNameFromUrl(src, blob.type))
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      showHint('Сохранено')
    } catch {
      // CORS не пустил — открываем в новой вкладке, там сохраняют вручную
      window.open(src, '_blank', 'noopener')
      showHint('Скачивание заблокировано CORS — открыли в новой вкладке', 4000)
    }
  }

  // средняя кнопка — сохранение на диск
  const handleImgMouseDown = (e: MouseEvent<HTMLImageElement>) => {
    if (e.button !== 1) return
    // иначе Chrome/Firefox включают режим панорамирования
    e.preventDefault()
    e.stopPropagation()
    void saveToDisk()
  }

  if (!src || failedSrc === src) {
    return <div className={`${styles.image} ${styles.image_broken}`}>⚠</div>
  }

  return (
    <>
      <img
        className={styles.image}
        src={src}
        alt={alt}
        title='Клик — открыть'
        loading='lazy'
        referrerPolicy='no-referrer'
        draggable={false}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          setOpened(true)
        }}
        onError={() => setFailedSrc(src)}
      />

      {opened &&
        createPortal(
          <div
            className={styles.lightbox}
            role='dialog'
            aria-label={alt}
            onClick={close}
          >
            <div className={styles.lightbox_stage}>
              <img
                className={styles.lightbox_img}
                src={src}
                alt={alt}
                title='Средняя кнопка — сохранить · Esc — закрыть'
                referrerPolicy='no-referrer'
                draggable={false}
                onMouseDown={handleImgMouseDown}
                onError={() => {
                  setFailedSrc(src)
                  close()
                }}
              />
            </div>

            <button
              className={styles.lightbox_close}
              onClick={e => {
                e.stopPropagation()
                close()
              }}
              aria-label='Закрыть'
            >
              ✕
            </button>

            <span
              className={styles.lightbox_hint}
              onClick={e => e.stopPropagation()}
            >
              {hint}
            </span>
          </div>,
          document.body,
        )}
    </>
  )
}
