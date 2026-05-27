import { GoogleGenerativeAI } from '@google/generative-ai'

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

function createModel(modelName) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 500,
    },
  })
}

async function tryGenerate(model, prompt) {
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log('Gemini 응답:', text)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON 없음: ' + text)
  return JSON.parse(jsonMatch[0])
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

  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = createModel(modelName)
        return await tryGenerate(model, prompt)
      } catch (err) {
        const is503 = err?.message?.includes('503')
        console.error(`AI 판정 오류 (${modelName}, 시도 ${attempt}):`, err?.message ?? err)
        if (!is503 || attempt === 2) break
        await new Promise(r => setTimeout(r, 1500))
      }
    }
  }

  return {
    winner: players[0].nickname,
    comment: 'AI 판정 중 오류가 발생했습니다. 임시로 선공 플레이어를 승자로 선정합니다.',
    player1Score: 50,
    player2Score: 50,
  }
}
