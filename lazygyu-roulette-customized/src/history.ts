const HISTORY_KEY = 'roulette_wins_v1';

export type WinEntry = { name: string; ts: number }; // UTC ms
export type WinHistory = WinEntry[];

export function getHistory(): WinHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) as WinHistory : [];
  } catch {
    return [];
  }
}

export function addWin(name: string) {
  const h = getHistory();
  h.push({ name: normalize(name), ts: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export function resetHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** name별 최근 N일(0이면 전체) 승수 집계 */
export function buildWinCountMap(windowDays: number): Record<string, number> {
  const cutoff = windowDays > 0 ? Date.now() - windowDays * 86400_000 : 0;
  const map: Record<string, number> = {};
  for (const { name, ts } of getHistory()) {
    if (cutoff && ts < cutoff) continue;
    const key = normalize(name);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}
