export interface IGalleryItem {
  type: string;
  shortCode: string;
  picUrls: string[];
  index: number; // позиция якоря в сетке, чтобы кликнуть по нему позже
}

export interface IPost {
  type: string;
  shortCode: string;
  picUrls: string[];
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
