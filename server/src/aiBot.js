import { GoogleGenerativeAI } from '@google/generative-ai'

export const BOT_NICKNAME = 'AI봇'

// ── 봇 설정 변수 ──────────────────────────────────────────
const BOT_MODEL = 'gemini-2.5-flash'
const BOT_MAX_TOKENS = 250        // 응답 최대 토큰 수 (높을수록 더 길게 말함)
const BOT_THINKING_BUDGET = 1000  // 사고 예산 (높을수록 논리적이나 느려짐, 0=비활성)
// ─────────────────────────────────────────────────────────

function createModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI.getGenerativeModel({
    model: BOT_MODEL,
    generationConfig: {
      thinkingConfig: { thinkingBudget: BOT_THINKING_BUDGET },
      maxOutputTokens: BOT_MAX_TOKENS,
    },
  })
}

export async function generateBotMessage(topic, messages) {
  const chatLog = messages.map(m => `[${m.nickname}]: ${m.text}`).join('\n')
  const prompt = `너는 키보드 배틀 참가자야. 주제는 "${topic}"이고, 반드시 이 주제에 대해서만 말해야 해.

지금까지 대화:
${chatLog || '(아직 대화 없음)'}

지시사항:
- 상대방의 마지막 주장을 정확히 파악하고, 그 논리적 약점이나 반례를 짚어 반박해
- 근거나 예시를 한 가지 들어 주장을 강화해 (통계, 상식, 일반적 사례 등)
- 한국어 반말로, 2-3문장 이내로 간결하게 써
- 주제와 무관한 말은 절대 하지 마
- 텍스트만 반환`
  try {
    const model = createModel()
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch {
    return '...'
  }
}
