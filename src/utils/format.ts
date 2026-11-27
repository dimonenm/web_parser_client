export const formatDuration = (ms: number): string =>
  `${Math.floor(ms / 60_000)}м ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}с`