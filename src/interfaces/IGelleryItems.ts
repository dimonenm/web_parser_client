import { IShortCode } from './IShortCode'

export interface IGalleryItem extends IShortCode {
  index: number // позиция якоря в сетке, чтобы кликнуть по нему позже
  previewUrl?: string // src превью-картинки (для reel берём прямо из сетки)
  picUrls?: string[] // ссылки пришли сразу в JSON поста — докачивать не надо
}
