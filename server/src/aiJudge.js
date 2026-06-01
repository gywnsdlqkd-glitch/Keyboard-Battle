import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-2.5-flash'

// 판정 기준 가중치 (합계 100)
export const JUDGE_WEIGHTS = {
  LOGIC: 60,      // 논리
  CREATIVITY: 30, // 창의성
  HUMOR: 10,      // 유머러스
}
const RETRYABLE_CODES = ['503', '429', '500']
const MAX_ATTEMPTS = 4

// 모델 인스턴스를 모듈 레벨에서 한 번만 생성
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const judgeModel = genAI.getGenerativeModel({
  model: MODEL,
  generationConfig: {
    thinkingConfig: { thinkingBudget: 0 },
    maxOutputTokens: 600,
  },
})

async function tryGenerate(model, prompt) {
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('Gemini 응답:', text)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 없음: ' + text)
  return JSON.parse(jsonMatch[0])
}

export async function judge(topic, players, messages) {
  if (messages.length === 0) {
    return {
      winner: players[0].nickname,
      comment: '배틀 기록이 없어 판정할 수 없습니다.',
      player1Score: 50,
      player2Score: 50,
      bestMessage: '',
    }
  }

  const chatLog = messages
    .map(m => `[${m.nickname}]: ${m.text}`)
    .join('\n')

  const prompt = `키보드 배틀 AI 심판. 아래 배점 기준으로 두 플레이어를 평가하라.

배점 기준: 논리 ${JUDGE_WEIGHTS.LOGIC}%, 창의성 ${JUDGE_WEIGHTS.CREATIVITY}%, 유머러스 ${JUDGE_WEIGHTS.HUMOR}%

주제: "${topic}"
채팅 기록:
${chatLog}

규칙:
- bestMessage는 반드시 winner가 입력한 채팅 기록 중 실제 원문을 그대로 인용해야 한다.
- 채팅 기록에 없는 내용은 절대 만들거나 변형하지 않는다.
- player1Score === player2Score(동점)이면 bestMessage는 빈 문자열을 반환한다.
- winner는 반드시 player1Score와 player2Score 중 더 높은 점수를 받은 플레이어여야 한다. player1Score가 높으면 winner는 ${players[0].nickname}, player2Score가 높으면 winner는 ${players[1].nickname}.
- comment의 평가 내용도 반드시 점수가 높은 플레이어를 긍정적으로 묘사해야 한다.

JSON으로만 답해:
{"winner":"${players[0].nickname} 또는 ${players[1].nickname}","comment":"판정 코멘트 2-3줄","player1Score":숫자,"player2Score":숫자,"bestMessage":"채팅 기록 중 실제 메시지 원문, 없으면 빈 문자열"}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await tryGenerate(judgeModel, prompt)
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.some(code => err?.message?.includes(code))
      console.error(`AI 판정 오류 (시도 ${attempt}/${MAX_ATTEMPTS}):`, err?.message ?? err)
      if (!isRetryable || attempt === MAX_ATTEMPTS) break
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
    }
  }

  return {
    winner: players[0].nickname,
    comment: 'AI 판정 중 오류가 발생했습니다. 임시로 선공 플레이어를 승자로 선정합니다.',
    player1Score: 50,
    player2Score: 50,
    bestMessage: '',
  }
}
