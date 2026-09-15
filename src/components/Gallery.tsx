'use client'

import { useEffect, useRef, useState } from 'react'

import { GalleryImage } from '@/components/GalleryImage'
import { IShortCode } from '@/interfaces/IShortCode'
import styles from '@/app/page.module.css'

const PAGE_SIZE = 20

interface IGalleryProps {
	codes: IShortCode[]
	username: string
}

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

export function Gallery({ codes, username }: IGalleryProps) {
	const [visible, setVisible] = useState(PAGE_SIZE)
	const [pics, setPics] = useState<Record<string, string[]>>({})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const requestedRef = useRef<Set<string>>(new Set())

	// Новый поиск → сброс пагинации, кэша картинок и журнала запросов
	useEffect(() => {
		setVisible(PAGE_SIZE)
		setPics({})
		requestedRef.current.clear()
	}, [codes])

	// Последовательная загрузка: карточка появляется, только когда фото пришли
	useEffect(() => {
		const queue = codes
			.slice(0, visible)
			.filter(code => !requestedRef.current.has(code.shortCode))

		if (!queue.length) return

		const controller = new AbortController()
		let cancelled = false

		queue.forEach(code => requestedRef.current.add(code.shortCode))
		setLoading(true)
		setError('')

		const run = async () => {
			for (const code of queue) {
				if (cancelled) break

				const params = new URLSearchParams({
					type: code.type,
					shortCode: code.shortCode,
				})

				try {
					const response = await fetch(
						`/api/instagram/get_pic_by_short_code/?${params.toString()}`,
						{ cache: 'no-store', signal: controller.signal },
					)
					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`)
					}

					const urls = extractPics(await response.json())
					if (!cancelled) {
						setPics(prev => ({ ...prev, [code.shortCode]: urls }))
					}
				} catch (err) {
					if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
						// запрос прерван — снимаем отметку, чтобы повторить при следующем прогоне
						requestedRef.current.delete(code.shortCode)
						break
					}
					// одна упавшая карточка не должна останавливать остальные
					setPics(prev => ({ ...prev, [code.shortCode]: [] }))
					setError(err instanceof Error ? err.message : 'Ошибка при загрузке фото')
				}
			}

			if (!cancelled) setLoading(false)
		}

		run()

		return () => {
			cancelled = true
			controller.abort()
		}
	}, [codes, visible])

	return (
		<>
			<h2 className={styles.gallery_title}>
				{username} — {codes.length}
				{loading && <span className={styles.card_index}> Loading…</span>}
			</h2>

			{error && <p className={styles.error_text}>{error}</p>}

			<div className={styles.gallery_grid}>
				{codes.slice(0, visible).map((code, index) => {
					const urls = pics[code.shortCode]

					// Пока фото этого поста не пришли (или их нет) — ничего не рендерим
					if (!urls?.length) return null

					return (
						<article key={code.shortCode} className={styles.card}>
							<span className={styles.card_title}>
								<span className={styles.card_index}>{index + 1}</span>
								{code.type === 'reel' && (
									<span className={styles.reel_badge}>Reel</span>
								)}
								{code.type === 'p' && (
									<span className={styles.p_badge}>P</span>
								)}
								{code.shortCode}
							</span>

							<div className={styles.images}>
								{urls.map((url, i) => (
									<GalleryImage
										key={`${code.shortCode}_${i}`}
										src={url}
										alt={`${code.shortCode} — ${i + 1}`}
									/>
								))}
							</div>
						</article>
					)
				})}
			</div>

			{visible < codes.length && (
				<button
					type='button'
					className={styles.load_more}
					onClick={() => setVisible(v => v + PAGE_SIZE)}
				>
					Показать ещё ({codes.length - visible})
				</button>
			)}
		</>
	)
}