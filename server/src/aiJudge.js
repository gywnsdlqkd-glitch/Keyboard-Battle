import { GoogleGenerativeAI } from '@google/generative-ai'

let cachedModel = null

function getModel() {
  if (!cachedModel) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    cachedModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 300,
      },
    })
  }
  return cachedModel
}

export async function judge(topic, players, messages) {
  const chatLog = messages
    .map(m => `[${m.nickname}]: ${m.text}`)
    .join('\n')

  const prompt = `키보드 배틀 AI 심판. 누가 더 킹받게(도발적·창의적·유머러스하게) 쳤는지 판정해.

주제: "${topic}"
${chatLog}

JSON으로만 답해:
{"winner":"${players[0].nickname} 또는 ${players[1].nickname}","comment":"판정 코멘트 2-3줄","player1Score":숫자,"player2Score":숫자}`

  try {
    const result = await getModel().generateContent(prompt)
    const text = result.response.text()
    console.log('Gemini 응답:', text)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 없음: ' + text)

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('AI 판정 오류:', err?.message ?? err)
    return {
      winner: players[0].nickname,
      comment: 'AI 판정 중 오류가 발생했습니다. 임시로 선공 플레이어를 승자로 선정합니다.',
      player1Score: 50,
      player2Score: 50,
    }
  }
}
