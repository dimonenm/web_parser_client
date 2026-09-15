'use client'

import { useState } from 'react'

import styles from '@/app/page.module.css'

export function GalleryImage({ src, alt }: { src: string; alt: string }) {
  // храним именно упавший src, чтобы новый src снова мог отрендериться
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  // src === '' → <img> не создаём вообще: нет warning'а и нет пустого запроса
  if (!src || failedSrc === src) {
    return <div className={`${styles.image} ${styles.image_broken}`}>⚠</div>
  }

  return (
    <img
      className={styles.image}
      src={src}
      alt={alt}
      loading='lazy'
      referrerPolicy='no-referrer'
      onError={() => setFailedSrc(src)}
    />
  )
}