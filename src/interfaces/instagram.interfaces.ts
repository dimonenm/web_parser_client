export type TBatchTaskState = 'pending' | 'running' | 'success' | 'error'

export interface IBatchTask {
  index: number // номер строки в файле, с 1
  id: string
  state: TBatchTaskState
  current: number
  total: number
  elapsedMs: number
  postsCount: number
  error: string | null
}

export interface IGalleryItem {
  type: string
  shortCode: string
  picUrls: string[]
  index: number // позиция якоря в сетке, чтобы кликнуть по нему позже
  username?: string // id профиля, для группировки при пакетной загрузке
}

export interface IPost {
  type: string
  shortCode: string
  picUrls: string[]
}

export interface IDownloadedPosts {
  id: string
  firstPicUrl: string
}

export interface IStatusData {
  id: string
  running: boolean
  current: number
  total: number
  scanned: number
  round: number
  lastShortCode: string | null
  startedAt: number | null
  finishedAt: number | null
  elapsedMs: number
  error: string | null
}