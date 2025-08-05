import './localization';
import { Roulette } from './roulette';
import options from './options';

const roulette = new Roulette();

// eslint-disable-next-line
(window as any).roullete = roulette;
// eslint-disable-next-line
(window as any).options = options;

// ─────────────────────────────────────────────────────────────────────────────
// History-bias hook (append at the end of src/index.ts)
// ─────────────────────────────────────────────────────────────────────────────
import { addWin, resetHistory, buildWinCountMap, normalize } from './history';

type Entry = { name: string; weight: number; count: number };

// "치킨/2*3" 같은 토큰을 객체로
function parseToken(token: string): Entry {
  const weightMatch = token.match(/\/(\d+)/);
  const countMatch = token.match(/\*(\d+)/);
  const nameMatch = token.match(/^\s*([^\/*]+)?/);

  const name = (nameMatch?.[1] ?? '').trim();
  const weight = weightMatch ? Math.max(1, Number(weightMatch[1])) : 1;
  const count = countMatch ? Math.max(1, Number(countMatch[1])) : 1;
  return { name, weight, count };
}

// 다시 문자열 토큰으로
function stringifyToken(e: Entry): string {
  const base = e.weight > 1 ? `${e.name}/${e.weight}` : e.name;
  return e.count > 1 ? `${base}*${e.count}` : base;
}

// strength: 0~1 -> decay = 1 - 0.5*strength
function applyHistoryDecayToTokens(tokens: string[], strength: number, windowDays: number): string[] {
  const decay = 1 - 0.5 * Math.min(Math.max(strength, 0), 1);
  const winMap = buildWinCountMap(windowDays);
  return tokens.map(t => {
    const info = parseToken(t);
    const cnt = winMap[normalize(info.name)] || 0;
    const adjusted = Math.max(1, Math.floor(info.count * Math.pow(decay, cnt)));
    info.count = adjusted;
    return stringifyToken(info);
  });
}

// UI에서 값 읽기 (index.html의 id 기준)
function getBiasOptions() {
  const doc: any = document;
  const useHistory = !!doc?.getElementById('useHistory')?.checked ?? true;
  const strength = Number(doc?.getElementById('biasStrength')?.value ?? '0.5');
  const windowDays = Number(doc?.getElementById('historyWindowDays')?.value ?? '0') | 0;
  return { useHistory, strength, windowDays };
}

function hookWhenReady() {
  const w = (window as any);
  if (!w.roullete || !w.roullete.isReady) {
    setTimeout(hookWhenReady, 100);
    return;
  }

  const roullete: any = w.roullete;

  // 1) setMarbles 래핑: 입력 토큰에 감쇠 적용 후 원본 호출
  if (!roullete.__setMarblesPatched) {
    const origSetMarbles = roullete.setMarbles?.bind(roullete);
    if (typeof origSetMarbles === 'function') {
      roullete.setMarbles = (names: string[]) => {
        let tokens = names.slice();
        const { useHistory, strength, windowDays } = getBiasOptions();
        if (useHistory) tokens = applyHistoryDecayToTokens(tokens, strength, windowDays);
        return origSetMarbles(tokens);
      };
      roullete.__setMarblesPatched = true;
      // console.debug('[history-bias] setMarbles patched');
    }
  }

  // 2) goal 이벤트에서 당첨자 기록
  if (!roullete.__goalHooked) {
    roullete.addEventListener?.('goal', (e: any) => {
      let winner: string | null = null;
      // 이벤트 detail에서 시도
      if (e && e.detail) {
        winner = e.detail.name || e.detail.winner || e.detail.title || null;
      }
      // API에서 시도
      try {
        if (!winner && typeof roullete.getWinnerName === 'function') winner = roullete.getWinnerName();
        if (!winner && typeof roullete.getWinners === 'function') {
          const arr = roullete.getWinners();
          if (Array.isArray(arr) && arr.length) winner = String(arr[0]);
        }
      } catch {}

      if (winner && winner.trim()) {
        addWin(winner);
        // console.debug('[history-bias] saved winner:', winner);
      }
    });
    roullete.__goalHooked = true;
  }

  // 3) Reset 버튼 (선택)
  const resetBtn = document.getElementById('resetHistory');
  if (resetBtn && !resetBtn.hasAttribute('data-history-bound')) {
    resetBtn.addEventListener('click', () => {
      resetHistory();
      alert('히스토리를 초기화했습니다.');
    });
    resetBtn.setAttribute('data-history-bound', '1');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hookWhenReady);
} else {
  hookWhenReady();
}
