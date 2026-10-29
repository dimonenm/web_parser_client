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

export interface IStatusData {
  current: number;
  total: number;
  running: boolean;
}
