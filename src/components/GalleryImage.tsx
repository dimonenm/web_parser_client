'use client'

import { MouseEvent, useState } from 'react'

import styles from '@/app/page.module.css'

export function GalleryImage({ src, alt }: { src: string; alt: string }) {
  // храним именно упавший src, чтобы новый src снова мог отрендериться
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  // src === '' → <img> не создаём вообще: нет warning'а и нет пустого запроса
  if (!src || failedSrc === src) {
    return <div className={`${styles.image} ${styles.image_broken}`}>⚠</div>
  }

  // двойной клик — оригинал в новой вкладке
  const handleDoubleClick = (e: MouseEvent<HTMLImageElement>) => {
    e.preventDefault() // не даём выделить картинку/текст вокруг
    e.stopPropagation()
    window.open(src, '_blank', 'noopener')
  }

  return (
    <img
      className={styles.image}
      src={src}
      alt={alt}
      title='Двойной клик — открыть в новой вкладке'
      loading='lazy'
      referrerPolicy='no-referrer'
      draggable={false}
      onDoubleClick={handleDoubleClick}
      onError={() => setFailedSrc(src)}
    />
  )
}
