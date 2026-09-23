'use client'

import { SubmitEvent, useEffect, useRef, useState } from 'react'

import { IShortCode } from '@/interfaces/IShortCode'

import { Gallery } from '@/components/Gallery'

import styles from '../page.module.css'


export default function InstagramShortCodesPage() {
	const [query, setQuery] = useState('')
	const [loading, setLoading] = useState(false)
	const [codes, setCodes] = useState<IShortCode[]>([])
	const [error, setError] = useState('')
	const [status, setStatus] = useState<{ current: number; total: number; running: boolean } | null>(null)

	const listRef = useRef<HTMLDivElement>(null)
	const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const extractUsername = (value: string): string => {
		const trimmed = value.trim()
		if (!trimmed.includes('/')) return trimmed
		try {
			const url = new URL(trimmed)
			return url.pathname.split('/').filter(Boolean)[0] ?? trimmed
		} catch {
			return trimmed
		}
	}
	// Бэкенд может вернуть строки либо объекты — приводим к одному виду
	const normalizeCodes = (data: unknown): IShortCode[] => {
		const source = data as Record<string, unknown> | unknown[]
		const list = Array.isArray(source)
			? source
			: Array.isArray(source?.shortCodes)
				? (source.shortCodes as unknown[])
				: []

		const seen = new Set<string>()

		return list.reduce<IShortCode[]>((acc, item) => {
			const raw = item as Record<string, unknown> | string
			const code =
				typeof raw === 'string'
					? raw
					: (raw?.shortCode ?? raw?.shortcode ?? raw?.code ?? raw?.id)

			if (typeof code !== 'string' || seen.has(code)) return acc

			seen.add(code)

			const type: IShortCode['type'] =
				typeof raw === 'object' && raw !== null && raw.type === 'reel'
					? 'reel'
					: 'p'

			acc.push({ shortCode: code, type })
			return acc
		}, [])
	}
	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault()
		if (!query.trim()) return

		setLoading(true)
		setCodes([])
		setStatus(null)

		try {
			const response = await fetch(
				`http://localhost:3000/instagram/get_all_short_codes_v2?id=${encodeURIComponent(query)}`,
				{ cache: 'no-store' },
			)
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

			const data = await response.json()
			console.log('data: ', data)
			setCodes(normalizeCodes(data))

			await getShortCodesStatus() // лоадер закрывается внутри опроса
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
			setLoading(false)
		}
	}

	const stopPolling = () => {
		if (pollTimerRef.current) {
			clearTimeout(pollTimerRef.current)
			pollTimerRef.current = null
		}
	}

	const getShortCodesStatus = async () => {
		try {
			const response = await fetch('/api/instagram/get_short_codes_status', { cache: 'no-store' })
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

			const data = (await response.json()) as { current: number; total: number; running: boolean }
			setStatus(data)

			if (!data.running) {
				stopPolling()
				setLoading(false) // только здесь снимаем лоадер
				return
			}

			pollTimerRef.current = setTimeout(getShortCodesStatus, 2000)
		} catch (err) {
			stopPolling()
			setLoading(false)
			setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
		}
	}

	useEffect(() => {
		if (codes.length && listRef.current) {
			listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}, [codes])

	useEffect(() => () => stopPolling(), [])

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
						type='text'
						className={styles.search_input}
						placeholder='Search or paste the Instagram URL'
						value={query}
						onChange={e => setQuery(e.target.value)}
					/>
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

				{(loading || status) && (
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
				)}

				{error && <p className={styles.error_text}>{error}</p>}
			</main>

			{/* Short codes list */}
			{codes.length > 0 && (
				<section className={styles.gallery_section} ref={listRef}>
					<Gallery codes={codes} username={extractUsername(query)} />
				</section>
			)}
		</div>
	)
}