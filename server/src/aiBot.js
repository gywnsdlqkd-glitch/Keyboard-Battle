import { GoogleGenerativeAI } from '@google/generative-ai'

export const BOT_NICKNAME = 'AI봇'
const MODEL = 'gemini-2.5-flash'

function createModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 150 },
  })
}

export async function generateBotMessage(topic, messages) {
  const chatLog = messages.map(m => `[${m.nickname}]: ${m.text}`).join('\n')
  const prompt = `너는 키보드 배틀 참가자야. 반드시 주제 "${topic}"에 대해서만 말해야 해. 주제와 무관한 말은 절대 하지 마.
지금까지 대화:
${chatLog || '(아직 대화 없음)'}
위 대화에서 상대방의 주장을 "${topic}" 주제 안에서 반박하는, 짧고 킹받는 말을 한국어 반말로 2-3문장 이내로 써. 텍스트만 반환.`
  try {
    const model = createModel()
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch {
    return '...'
  }
}
