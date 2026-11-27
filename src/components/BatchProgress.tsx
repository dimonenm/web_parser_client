'use client'

import { IBatchTask } from '@/interfaces/instagram.interfaces'
import { formatDuration } from '@/utils/format'
import styles from '@/app/page.module.css'

const percentOf = (task: IBatchTask): number => {
	if (task.total > 0) {
		return Math.min(100, Math.round((task.current / task.total) * 100))
	}
	return task.state === 'success' ? 100 : 0
}

function TaskIcon({ state }: { state: IBatchTask['state'] }) {
	if (state === 'running') {
		return <span className={styles.spinner} aria-label='В процессе' />
	}

	if (state === 'success') {
		return (
			<svg
				className={`${styles.batch_icon} ${styles.batch_icon_success}`}
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='3'
				strokeLinecap='round'
				strokeLinejoin='round'
				role='img'
				aria-label='Успешно'
			>
				<path d='M20 6 9 17l-5-5' />
			</svg>
		)
	}

	if (state === 'error') {
		return (
			<svg
				className={`${styles.batch_icon} ${styles.batch_icon_error}`}
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='3'
				strokeLinecap='round'
				role='img'
				aria-label='Ошибка'
			>
				<path d='M18 6 6 18' />
				<path d='m6 6 12 12' />
			</svg>
		)
	}

	return <span className={styles.batch_icon_pending} aria-label='Ожидание' />
}

export function BatchProgress({ tasks }: { tasks: IBatchTask[] }) {
	if (!tasks.length) return null

	return (
		<section className={styles.batch_progress}>
			{tasks.map(task => {
				const percent = percentOf(task)

				return (
					<div key={`${task.index}_${task.id}`} className={styles.batch_row} title={task.error ?? undefined}>
						<span className={styles.batch_index}>{task.index}</span>

						<span className={styles.batch_id} title={task.id}>
							{task.id}
						</span>

						<span className={styles.batch_counts}>
							{task.current} / {task.total}
						</span>

						<div
							className={styles.progress_track}
							role='progressbar'
							aria-valuemin={0}
							aria-valuemax={task.total || 100}
							aria-valuenow={task.current}
						>
							<div
								className={styles.progress_bar}
								style={{ width: `${percent}%` }}
							/>
						</div>

						<span className={styles.batch_percent}>{percent}%</span>

						<span className={styles.batch_time}>
							{task.elapsedMs > 0 ? formatDuration(task.elapsedMs) : '—'}
						</span>

						<TaskIcon state={task.state} />
					</div>
				)
			})}
		</section>
	)
}