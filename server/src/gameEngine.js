import { judge } from './aiJudge.js'
import { BOT_NICKNAME, generateBotMessage } from './aiBot.js'
import {
  getRoomList, getBattlingRoomList, startGame, nextTurn, saveResult,
} from './gameManager.js'
import {
  TURNS_PER_PLAYER, TURN_DURATION_MS, VOTE_DURATION_MS,
  AI_RESULT_WEIGHT, VOTE_RESULT_WEIGHT,
  BOT_RESPONSE_DELAY_MIN, BOT_RESPONSE_DELAY_RANGE,
  BOT_TYPING_INTERVAL_MS, BOT_MESSAGE_PAUSE_MS,
} from './constants.js'

export function createGameEngine(io) {
  // 카운트다운 브로드캐스트 (join-room과 joinBotToRoom 양쪽에서 재사용)
  function broadcastCountdown(room, validator = () => true) {
    ;[3, 2, 1].forEach((n, i) =>
      setTimeout(() => {
        if (validator()) io.to(room.id).emit('countdown', { count: n })
      }, i * 1000)
    )
  }

  // game-start 이벤트 payload 생성 (join-room과 joinBotToRoom 양쪽에서 재사용)
  function buildGameStartPayload(room) {
    return {
      players: room.players.map(p => p.nickname),
      topic: room.topic,
      currentTurnIndex: 0,
      currentNickname: room.players[0].nickname,
      turnCount: 0,
      totalTurns: TURNS_PER_PLAYER * 2,
    }
  }

  function startTurnTimer(room) {
    room.isProcessingTurnEnd = false
    if (room.timer) clearTimeout(room.timer)

    room.turnStartedAt = Date.now()
    room.timer = setTimeout(() => {
      handleTurnEnd(room, true)
    }, TURN_DURATION_MS)

    const currentPlayer = room.players[room.currentTurnIndex]
    if (currentPlayer?.isBot) handleBotTurn(room)
  }

  async function handleBotTurn(room) {
    const capturedTurnCount = room.turnCount

    await new Promise(r => setTimeout(r, BOT_RESPONSE_DELAY_MIN + Math.random() * BOT_RESPONSE_DELAY_RANGE))
    if (room.state !== 'battling') return
    if (room.turnCount !== capturedTurnCount) return

    const humanPlayer = room.players.find(p => !p.isBot)
    if (humanPlayer?.disconnected) return

    const bot = room.players[room.currentTurnIndex]
    if (!bot?.isBot) return

    io.to(room.id).emit('typing-indicator', { nickname: bot.nickname })
    const typingInterval = setInterval(() => {
      if (room.turnCount !== capturedTurnCount || room.state !== 'battling') {
        clearInterval(typingInterval)
        return
      }
      io.to(room.id).emit('typing-indicator', { nickname: bot.nickname })
    }, BOT_TYPING_INTERVAL_MS)

    const text = await generateBotMessage(room.topic, room.messages, humanPlayer?.nickname)
    clearInterval(typingInterval)

    if (room.state !== 'battling') return
    if (room.turnCount !== capturedTurnCount) return

    room.messages.push({ nickname: bot.nickname, text, turn: room.turnCount, playerIndex: room.currentTurnIndex })
    io.to(room.id).emit('message-added', { nickname: bot.nickname, text, playerIndex: room.currentTurnIndex })

    await new Promise(r => setTimeout(r, BOT_MESSAGE_PAUSE_MS))
    if (room.turnCount !== capturedTurnCount) return
    const isLastTurn = room.turnCount + 1 >= TURNS_PER_PLAYER * 2
    if (room.state === 'battling' && !isLastTurn) handleTurnEnd(room)
  }

  function joinBotToRoom(room) {
    if (room.players.length !== 1 || room.state !== 'waiting') return
    const botId = `bot-${room.id}`
    room.players.push({ id: botId, nickname: BOT_NICKNAME, isBot: true })
    io.to(room.id).emit('player-joined', { nickname: BOT_NICKNAME })
    io.emit('room-list', getRoomList())
    broadcastCountdown(room, () => room.players[1]?.isBot)
    setTimeout(() => {
      if (!room.players[1]?.isBot) return  // 사람이 봇을 교체한 경우 봇 게임 시작 취소
      startGame(room)
      io.to(room.id).emit('game-start', buildGameStartPayload(room))
      io.emit('room-list', getRoomList())
      io.emit('battling-list', getBattlingRoomList())
      startTurnTimer(room)
    }, 3000)
    console.log(`AI봇 입장: ${room.id}`)
  }

  async function handleOpponentQuit(room, leavingNickname) {
    const remainingPlayer = room.players.find(p => p.nickname !== leavingNickname)
    io.to(room.id).emit('game-judging')
    try {
      const judgment = await judge(room.topic, room.players, room.messages)
      const winner = remainingPlayer?.nickname || judgment.winner
      const comment = judgment.comment + `\n\n[탈주 판정] ${leavingNickname}이(가) 게임 도중 나갔습니다. 탈주 플레이어는 자동 패배 처리됩니다.`
      const remainingIsP1 = remainingPlayer?.nickname === room.players[0].nickname
      const winnerTexts = room.messages.filter(m => m.nickname === winner).map(m => m.text)
      const validatedBestMessage = winnerTexts.includes(judgment.bestMessage) ? judgment.bestMessage : ''
      const resultPayload = {
        winner,
        comment,
        player1Score: remainingIsP1 ? 100 : 0,
        player2Score: remainingIsP1 ? 0 : 100,
        aiPlayer1Score: judgment.player1Score,
        aiPlayer2Score: judgment.player2Score,
        votePlayer1: 50,
        votePlayer2: 50,
        totalVotes: 0,
        players: room.players.map(p => p.nickname),
        messages: room.messages,
        topic: room.topic,
        bestMessage: validatedBestMessage,
      }
      saveResult(room.id, resultPayload)
      room.lastResult = resultPayload
      room.state = 'done'
      io.to(room.id).emit('game-result', resultPayload)
    } catch {
      const remainingIsP1 = remainingPlayer?.nickname === room.players[0].nickname
      const fallbackPayload = {
        winner: remainingPlayer?.nickname || room.players[0].nickname,
        comment: `[탈주 판정] ${leavingNickname}이(가) 게임 도중 나갔습니다. 탈주 플레이어는 자동 패배 처리됩니다.`,
        player1Score: remainingIsP1 ? 100 : 0,
        player2Score: remainingIsP1 ? 0 : 100,
        aiPlayer1Score: 50, aiPlayer2Score: 50,
        votePlayer1: 50, votePlayer2: 50, totalVotes: 0,
        players: room.players.map(p => p.nickname),
        messages: room.messages, topic: room.topic, bestMessage: '',
      }
      saveResult(room.id, fallbackPayload)
      room.lastResult = fallbackPayload
      room.state = 'done'
      io.to(room.id).emit('game-result', fallbackPayload)
    }
  }

  async function handleTurnEnd(room, isTimeout = false) {
    if (room.isProcessingTurnEnd) return
    room.isProcessingTurnEnd = true

    if (room.timer) {
      clearTimeout(room.timer)
      room.timer = null
    }

    if (isTimeout) {
      io.to(room.id).emit('turn-timeout', {
        nickname: room.players[room.currentTurnIndex].nickname,
      })
    }

    const result = nextTurn(room)

    if (result.finished) {
      io.to(room.id).emit('game-judging')

      io.to(room.id).emit('vote-start', {
        players: room.players.map(p => p.nickname),
        duration: VOTE_DURATION_MS,
      })

      // AI 판정과 투표 마감을 병렬로 실행
      const closeVotes = new Promise(resolve => {
        setTimeout(() => {
          room.voteOpen = false
          io.to(room.id).emit('vote-closed')
          resolve()
        }, VOTE_DURATION_MS)
      })

      const [judgment] = await Promise.all([
        judge(room.topic, room.players, room.messages),
        closeVotes,
      ])

      const totalVotes = room.votes.length
      const votesFor0 = room.votes.filter(v => v.playerIndex === 0).length
      const voteScore0 = totalVotes > 0 ? Math.round((votesFor0 / totalVotes) * 100) : 50
      const voteScore1 = 100 - voteScore0

      const finalScore0 = Math.round(AI_RESULT_WEIGHT * judgment.player1Score + VOTE_RESULT_WEIGHT * voteScore0)
      const finalScore1 = Math.round(AI_RESULT_WEIGHT * judgment.player2Score + VOTE_RESULT_WEIGHT * voteScore1)
      // AI 점수 기반으로 winner 재검증 (AI가 winner 필드와 점수를 불일치하게 반환하는 케이스 방어)
      const scoreBasedWinner = judgment.player1Score >= judgment.player2Score
        ? room.players[0].nickname
        : room.players[1].nickname
      const finalWinner = finalScore0 > finalScore1 ? room.players[0].nickname
                        : finalScore1 > finalScore0 ? room.players[1].nickname
                        : scoreBasedWinner

      // bestMessage는 최종 승자의 메시지에서만 선별; 동점이면 없음
      const isDraw = finalScore0 === finalScore1
      const winnerTexts = room.messages.filter(m => m.nickname === finalWinner).map(m => m.text)
      const validatedBestMessage = isDraw || !winnerTexts.includes(judgment.bestMessage)
        ? ''
        : judgment.bestMessage

      const resultPayload = {
        winner: finalWinner,
        comment: judgment.comment,
        player1Score: finalScore0,
        player2Score: finalScore1,
        aiPlayer1Score: judgment.player1Score,
        aiPlayer2Score: judgment.player2Score,
        votePlayer1: voteScore0,
        votePlayer2: voteScore1,
        totalVotes,
        players: room.players.map(p => p.nickname),
        messages: room.messages,
        topic: room.topic,
        bestMessage: validatedBestMessage,
      }
      saveResult(room.id, resultPayload)
      room.lastResult = resultPayload
      room.state = 'done'
      io.to(room.id).emit('game-result', resultPayload)
      return
    }

    io.to(room.id).emit('turn-update', {
      currentTurnIndex: result.currentTurnIndex,
      currentNickname: room.players[result.currentTurnIndex].nickname,
      turnCount: room.turnCount,
      messages: room.messages,
    })

    startTurnTimer(room)
  }

  return { startTurnTimer, handleTurnEnd, joinBotToRoom, handleOpponentQuit, buildGameStartPayload, broadcastCountdown }
}
