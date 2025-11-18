// src/lib/time.ts

export type EventPhase = "before_wait" | "open" | "closed";

// 예식 시작 몇 ms 전부터 메시지를 받을지 (기본 1시간 전)
const OPEN_BEFORE_MS_DEFAULT = 60 * 60 * 1000;
// 예식 종료 몇 ms 전에 메시지 접수를 마감할지 (기본 10분 전)
const CLOSE_BEFORE_MS_DEFAULT = 10 * 60 * 1000;

/**
 * 현재 시각(now), 예식 시작/종료(start, end)를 기준으로
 * 화면 상태(before_wait / open / closed)를 계산
 */
export function getEventPhase(
  now: Date,
  start: Date,
  end: Date,
  options?: {
    openBeforeMs?: number;
    closeBeforeMs?: number;
  }
): EventPhase {
  const openBefore = options?.openBeforeMs ?? OPEN_BEFORE_MS_DEFAULT;
  const closeBefore = options?.closeBeforeMs ?? CLOSE_BEFORE_MS_DEFAULT;

  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();

  // 이상한 값 들어왔을 때 방어
  if (isNaN(startMs) || isNaN(endMs)) {
    console.warn("[time.ts] Invalid start/end date", { start, end });
    return "open";
  }

  // 예식 시작 openBeforeMs 이전까지 → 대기 화면
  if (nowMs < startMs - openBefore) {
    return "before_wait";
  }

  // 예식 종료 closeBeforeMs 이전까지 → 메시지 입력/재생
  if (nowMs < endMs - closeBefore) {
    return "open";
  }

  // 그 이후 → 접수 종료
  return "closed";
}
