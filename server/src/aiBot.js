import { GoogleGenerativeAI } from '@google/generative-ai'

export const BOT_NICKNAME = 'AI봇'

// ── 봇 설정 변수 ──────────────────────────────────────────
const BOT_MODEL = 'gemini-2.5-flash'
const BOT_MAX_TOKENS = 300        // 응답 최대 토큰 수 (높을수록 더 길게 말함)
const BOT_THINKING_BUDGET = 0     // 사고 예산 (0=비활성, >0이면 maxOutputTokens 공유 주의)
const BOT_MAX_ATTEMPTS = 3        // 재시도 횟수 (429/503 등 일시적 오류 대응)
const RETRYABLE_CODES = ['503', '429', '500']
// ─────────────────────────────────────────────────────────

// 모델 인스턴스를 모듈 레벨에서 한 번만 생성
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const botModel = genAI.getGenerativeModel({
  model: BOT_MODEL,
  generationConfig: {
    thinkingConfig: { thinkingBudget: BOT_THINKING_BUDGET },
    maxOutputTokens: BOT_MAX_TOKENS,
  },
})

export async function generateBotMessage(topic, messages, humanNickname, botNickname) {
  const chatLog = messages.map(m => `[${m.nickname}]: ${m.text}`).join('\n')

  // 봇의 첫 번째 발언을 추출해 이후 턴에서 입장을 명시적으로 고정
  const botFirstMessage = messages.find(m => m.nickname === botNickname)?.text
  const positionInstruction = botFirstMessage
    ? `너는 이미 이런 입장을 선언했다: "${botFirstMessage.slice(0, 120)}"\n이 핵심 입장(어느 편을 지지하는지)을 절대 바꾸지 마라. 같은 편을 계속 지지하며 논리를 강화해.`
    : `상대방(${humanNickname})이 지지하는 입장과 정반대 입장을 선택하고, 이후 절대 바꾸지 마라.`

  const prompt = `너는 키보드 배틀 참가자야. 주제는 "${topic}"이야.

지금까지 대화:
${chatLog || '(아직 대화 없음)'}

지시사항:
- 반드시 주제 "${topic}"에 대해서만 말해. 주제와 무관한 말은 절대 하지 마.
- ${positionInstruction}
- 대화가 있다면: 상대방의 마지막 주장을 정면으로 반박하고, 논리적 약점이나 반례를 짚어.
- 대화가 없다면: 주제에 대한 뚜렷한 입장을 먼저 밝혀.
- 근거나 예시를 한 가지 들어 주장을 강화해 (통계, 상식, 일반적 사례 등).
- 한국어 반말로, 2-3문장 이내로 간결하게 써.
- 순수한 텍스트만 반환. 닉네임, 대괄호([]), 콜론(:) 같은 접두사를 절대 붙이지 마.`

  for (let attempt = 1; attempt <= BOT_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await botModel.generateContent(prompt)
      return result.response.text().trim().replace(/^\[.*?\]:\s*/, '')
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.some(code => err?.message?.includes(code))
      console.error(`[aiBot] 메시지 생성 실패 (시도 ${attempt}/${BOT_MAX_ATTEMPTS}):`, err?.message ?? err)
      if (!isRetryable || attempt === BOT_MAX_ATTEMPTS) break
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000))  // 2초, 4초
    }
  }
  return null  // 재시도 후에도 실패하면 null → 봇 턴 조용히 종료
}
