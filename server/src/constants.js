export const TURNS_PER_PLAYER         = 5
export const TURN_DURATION_MS         = 30_000
export const BOT_TURN_DURATION_MS     = 60_000
export const VOTE_DURATION_MS         = 15_000
export const BOT_JOIN_DELAY_MS        = 30_000
export const RECONNECT_GRACE_MS       = 15_000
export const AI_RESULT_WEIGHT         = 0.5
export const VOTE_RESULT_WEIGHT       = 0.5

export const ROOM_CLEANUP_DELAY_MS    = 30 * 60 * 1000  // 완료 방 30분 후 자동 정리

// Bot turn 타이밍
export const BOT_RESPONSE_DELAY_MIN   = 1500
export const BOT_RESPONSE_DELAY_RANGE = 2000
export const BOT_TYPING_INTERVAL_MS   = 2000
export const BOT_MESSAGE_PAUSE_MS     = 800
export const BOT_LAST_TURN_GRACE_MS   = 30_000  // 마지막 턴 봇 메시지 후 유예 시간
