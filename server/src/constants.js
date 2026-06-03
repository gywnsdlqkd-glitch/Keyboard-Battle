export const TURNS_PER_PLAYER         = 5
export const TURN_DURATION_MS         = 30_000
export const BOT_TURN_DURATION_MS     = 180_000
export const VOTE_DURATION_MS         = 15_000
export const BOT_JOIN_DELAY_MS        = 30_000
export const RECONNECT_GRACE_MS       = 15_000
export const WAITING_GRACE_MS         = 60_000  // 대기방 호스트 연결 끊김 유예 (재접속 대기)
export const AI_RESULT_WEIGHT         = 0.5
export const VOTE_RESULT_WEIGHT       = 0.5

export const ROOM_CLEANUP_DELAY_MS    = 30 * 60 * 1000  // 완료 방 30분 후 자동 정리

// Bot turn 타이밍
export const BOT_RESPONSE_DELAY_MIN   = 1500
export const BOT_RESPONSE_DELAY_RANGE = 2000
export const BOT_TYPING_INTERVAL_MS   = 2000
export const BOT_MESSAGE_PAUSE_MS     = 800
export const BOT_TURN_END_DELAY_MS    = 10_000  // 봇 턴 시작 후 자동 종료까지 대기 시간
export const BOT_SCORE_HANDICAP       = 20      // AI 판정 시 봇 점수 차감량
