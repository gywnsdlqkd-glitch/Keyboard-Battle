import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocketId,
  getRoomList,
  getBattlingRoomList,
  startGame,
  addMessage,
  nextTurn,
  removePlayerFromRoom,
  markPlayerDisconnected,
  rejoinRoom,
  addSpectator,
  removeSpectatorFromRoom,
  saveResult,
  getResult,
  TURN_DURATION_MS,
  TURNS_PER_PLAYER,
} from './gameManager.js'
import { judge } from './aiJudge.js'
import { BOT_NICKNAME, generateBotMessage } from './aiBot.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// key: oldSocketId, value: { timer, roomId }
const pendingDisconnects = new Map()

const BOT_JOIN_DELAY_MS = 30 * 1000       // 봇 참여 대기 시간
const BOT_LAST_TURN_DELAY_MS = 5 * 1000  // 봇 마지막 턴 후 읽기 대기 시간

// 투표/판정 비중 설정 (합계 1.0)
const VOTE_DURATION_MS = 15000   // 관람자 투표 창 15초
const AI_RESULT_WEIGHT = 0.5     // AI 판정 비중 50%
const VOTE_RESULT_WEIGHT = 0.5   // 관람자 투표 비중 50%

app.get('/health', (_, res) => res.json({ ok: true }))

app.get('/api/result/:roomId', (req, res) => {
  const result = getResult(req.params.roomId)
  if (!result) return res.status(404).json({ error: '결과를 찾을 수 없습니다.' })
  res.json(result)
})

app.get('/api/room/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId)
  if (!room) return res.json({ exists: false })
  res.json({ exists: true, state: room.state })
})

function startTurnTimer(room) {
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

  await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000))
  if (room.state !== 'battling') return
  if (room.turnCount !== capturedTurnCount) return

  const humanPlayer = room.players.find(p => !p.isBot)
  if (humanPlayer?.disconnected) return

  const bot = room.players[room.currentTurnIndex]
  if (!bot?.isBot) return

  const text = await generateBotMessage(room.topic, room.messages)
  if (room.state !== 'battling') return
  if (room.turnCount !== capturedTurnCount) return

  room.messages.push({ nickname: bot.nickname, text, turn: room.turnCount, playerIndex: room.currentTurnIndex })
  io.to(room.id).emit('message-added', { nickname: bot.nickname, text, playerIndex: room.currentTurnIndex })

  await new Promise(r => setTimeout(r, 800))
  if (room.turnCount !== capturedTurnCount) return
  if (room.state === 'battling') handleTurnEnd(room)
}

function joinBotToRoom(room) {
  if (room.players.length !== 1 || room.state !== 'waiting') return
  const botId = `bot-${room.id}`
  room.players.push({ id: botId, nickname: BOT_NICKNAME, isBot: true })
  io.to(room.id).emit('player-joined', { nickname: BOT_NICKNAME })
  io.emit('room-list', getRoomList())
  ;[3, 2, 1].forEach((n, i) =>
    setTimeout(() => {
      if (room.players[1]?.isBot) io.to(room.id).emit('countdown', { count: n })
    }, i * 1000)
  )
  setTimeout(() => {
    if (!room.players[1]?.isBot) return  // 사람이 봇을 교체한 경우 봇 게임 시작 취소
    startGame(room)
    io.to(room.id).emit('game-start', {
      players: room.players.map(p => p.nickname),
      topic: room.topic,
      currentTurnIndex: 0,
      currentNickname: room.players[0].nickname,
      turnCount: 0,
      totalTurns: TURNS_PER_PLAYER * 2,
    })
    io.emit('room-list', getRoomList())
    io.emit('battling-list', getBattlingRoomList())
    startTurnTimer(room)
  }, 3000)
  console.log(`AI봇 입장: ${room.id}`)
}

async function handleTurnEnd(room, isTimeout = false) {
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
    room.state = 'ending'
    io.to(room.id).emit('game-ending')
    await new Promise(r => setTimeout(r, 10000))

    io.to(room.id).emit('game-judging')

    // 투표 초기화
    room.votes = []
    room.voteOpen = true
    room.votedSocketIds = new Set()

    io.to(room.id).emit('vote-start', {
      players: room.players.map(p => p.nickname),
      duration: VOTE_DURATION_MS,
    })

    // 투표 마감 타이머 (VOTE_DURATION_MS 후 투표 닫고 vote-closed 브로드캐스트)
    const closeVotes = new Promise(resolve => {
      setTimeout(() => {
        room.voteOpen = false
        io.to(room.id).emit('vote-closed')
        resolve()
      }, VOTE_DURATION_MS)
    })

    // AI 판정과 투표 병렬 실행 (둘 다 끝날 때까지 대기)
    const [judgment] = await Promise.all([
      judge(room.topic, room.players, room.messages),
      closeVotes,
    ])

    // 최종 점수 계산
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
      bestMessage: judgment.bestMessage,
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

io.on('connection', socket => {
  console.log('접속:', socket.id)

  socket.emit('room-list', getRoomList())
  socket.emit('battling-list', getBattlingRoomList())

  socket.on('create-room', ({ nickname, topic }) => {
    if (!nickname?.trim() || !topic?.trim()) return

    const room = createRoom(socket.id, nickname.trim(), topic.trim())
    socket.join(room.id)

    socket.emit('room-created', {
      roomId: room.id,
      topic: room.topic,
      nickname: nickname.trim(),
      playerIndex: 0,
    })

    io.emit('room-list', getRoomList())
    room.botJoinTimer = setTimeout(() => joinBotToRoom(room), BOT_JOIN_DELAY_MS)
    socket.emit('bot-timer-started', { delay: BOT_JOIN_DELAY_MS })
    console.log(`방 생성: ${room.id} | 주제: ${topic} | 방장: ${nickname}`)
  })

  socket.on('join-room', ({ nickname, roomId }) => {
    if (!nickname?.trim() || !roomId?.trim()) return

    const result = joinRoom(roomId.trim(), socket.id, nickname.trim())

    if (result.error) {
      socket.emit('join-error', { message: result.error })
      return
    }

    const room = result.room
    if (room.botJoinTimer) { clearTimeout(room.botJoinTimer); room.botJoinTimer = null }
    socket.join(room.id)

    socket.to(room.id).emit('player-joined', { nickname: nickname.trim() })

    socket.emit('room-joined', {
      roomId: room.id,
      topic: room.topic,
      nickname: nickname.trim(),
      opponent: room.players[0].nickname,
      playerIndex: 1,
    })

    io.emit('room-list', getRoomList())

    ;[3, 2, 1].forEach((n, i) => {
      setTimeout(() => io.to(room.id).emit('countdown', { count: n }), i * 1000)
    })
    setTimeout(() => {
      startGame(room)

      io.to(room.id).emit('game-start', {
        players: room.players.map(p => p.nickname),
        topic: room.topic,
        currentTurnIndex: 0,
        currentNickname: room.players[0].nickname,
        turnCount: 0,
        totalTurns: TURNS_PER_PLAYER * 2,
      })

      io.emit('room-list', getRoomList())
      io.emit('battling-list', getBattlingRoomList())

      startTurnTimer(room)
    }, 3000)

    console.log(`방 입장: ${room.id} | ${nickname} 합류`)
  })

  socket.on('rejoin-room', ({ roomId, nickname }) => {
    if (!roomId?.trim() || !nickname?.trim()) return

    const result = rejoinRoom(roomId.trim(), socket.id, nickname.trim())

    if (result.error) {
      socket.emit('rejoin-error', { message: result.error })
      return
    }

    const { room, playerIndex, oldSocketId } = result

    const pending = pendingDisconnects.get(oldSocketId)
    if (pending) {
      clearTimeout(pending.timer)
      pendingDisconnects.delete(oldSocketId)
    }

    socket.join(room.id)

    socket.emit('rejoin-success', {
      players: room.players.map(p => p.nickname),
      topic: room.topic,
      messages: room.messages,
      currentTurnIndex: room.currentTurnIndex,
      currentNickname: room.players[room.currentTurnIndex]?.nickname,
      turnCount: room.turnCount,
      totalTurns: TURNS_PER_PLAYER * 2,
      playerIndex,
      state: room.state,
      turnElapsedMs: room.turnStartedAt ? Date.now() - room.turnStartedAt : 0,
    })

    socket.to(room.id).emit('opponent-reconnected', { nickname: nickname.trim() })

    if (room.state === 'battling' && !room.timer) {
      startTurnTimer(room)
    }

    console.log(`재접속: ${nickname} → 방 ${roomId}`)
  })

  socket.on('send-message', ({ text }) => {
    if (!text?.trim()) return

    const room = getRoomBySocketId(socket.id)
    if (!room || room.state !== 'battling') return

    const added = addMessage(room, socket.id, text.trim())
    if (!added) return

    socket.to(room.id).emit('message-added', {
      nickname: room.players.find(p => p.id === socket.id).nickname,
      text: text.trim(),
      playerIndex: room.currentTurnIndex,
    })
  })

  socket.on('end-turn', () => {
    const room = getRoomBySocketId(socket.id)
    if (!room || room.state !== 'battling') {
      socket.emit('end-turn-rejected')
      return
    }
    if (room.players[room.currentTurnIndex].id !== socket.id) {
      socket.emit('end-turn-rejected')
      return
    }
    handleTurnEnd(room)
  })

  socket.on('typing', () => {
    const room = getRoomBySocketId(socket.id)
    if (!room || room.state !== 'battling') return

    const player = room.players.find(p => p.id === socket.id)
    if (!player) return

    socket.to(room.id).emit('typing-indicator', { nickname: player.nickname })
  })

  socket.on('get-room-list', () => {
    socket.emit('room-list', getRoomList())
    socket.emit('battling-list', getBattlingRoomList())
  })

  socket.on('watch-room', ({ roomId, nickname, photoURL }) => {
    const room = getRoom(roomId)
    if (!room || (room.state !== 'battling' && room.state !== 'judging' && room.state !== 'done')) {
      socket.emit('watch-error', { message: '관람할 수 없는 방입니다.' })
      return
    }
    addSpectator(room, socket.id, nickname || '익명', photoURL || null)
    socket.join(room.id)
    socket.emit('spectate-state', {
      players: room.players.map(p => p.nickname),
      topic: room.topic,
      messages: room.messages,
      currentTurnIndex: room.currentTurnIndex,
      currentNickname: room.players[room.currentTurnIndex]?.nickname,
      turnCount: room.turnCount,
      totalTurns: TURNS_PER_PLAYER * 2,
      state: room.state,
      spectators: room.spectators.map(s => ({ nickname: s.nickname, photoURL: s.photoURL })),
    })
    io.to(room.id).emit('spectator-list', room.spectators.map(s => ({ nickname: s.nickname, photoURL: s.photoURL })))
    if (room.state === 'done' && room.lastResult) {
      socket.emit('game-result', room.lastResult)
    }
    console.log(`관람자 입장: ${socket.id} → 방 ${roomId}`)
  })

  socket.on('submit-vote', ({ roomId, playerIndex }) => {
    const room = getRoom(roomId)
    if (!room || !room.voteOpen) return

    const isSpectator = room.spectators.some(s => s.id === socket.id)
    if (!isSpectator) return

    room.votes = room.votes.filter(v => v.socketId !== socket.id)
    room.votedSocketIds.add(socket.id)
    room.votes.push({ socketId: socket.id, playerIndex })

    const voteCount = [
      room.votes.filter(v => v.playerIndex === 0).length,
      room.votes.filter(v => v.playerIndex === 1).length,
    ]
    const votedProfiles = [0, 1].map(pidx =>
      room.votes
        .filter(v => v.playerIndex === pidx)
        .map(v => {
          const s = room.spectators.find(sp => sp.id === v.socketId)
          return s ? { nickname: s.nickname, photoURL: s.photoURL } : null
        })
        .filter(Boolean)
    )
    io.to(room.id).emit('vote-update', { voteCount, votedProfiles })
  })

  socket.on('leave-waiting-room', ({ roomId }) => {
    const room = getRoom(roomId)
    if (!room || room.state !== 'waiting') return

    const removedRoom = removePlayerFromRoom(socket.id)
    if (removedRoom) {
      if (removedRoom.botJoinTimer) clearTimeout(removedRoom.botJoinTimer)
      io.to(removedRoom.id).emit('opponent-left')
      io.emit('room-list', getRoomList())
    }
  })

  socket.on('disconnect', () => {
    const room = markPlayerDisconnected(socket.id)

    if (room) {
      io.to(room.id).emit('opponent-disconnected')

      const timer = setTimeout(() => {
        pendingDisconnects.delete(socket.id)
        const removedRoom = removePlayerFromRoom(socket.id)
        if (removedRoom) {
          io.to(removedRoom.id).emit('opponent-left')
          io.emit('room-list', getRoomList())
          io.emit('battling-list', getBattlingRoomList())
        }
      }, 15000)

      pendingDisconnects.set(socket.id, { timer, roomId: room.id })
    } else {
      const removedRoom = removePlayerFromRoom(socket.id)
      if (removedRoom) {
        if (removedRoom.botJoinTimer) clearTimeout(removedRoom.botJoinTimer)
        io.to(removedRoom.id).emit('opponent-left')
        io.emit('room-list', getRoomList())
        io.emit('battling-list', getBattlingRoomList())
      } else {
        const spectateRoom = removeSpectatorFromRoom(socket.id)
        if (spectateRoom) {
          io.to(spectateRoom.id).emit('spectator-list', spectateRoom.spectators.map(s => ({ nickname: s.nickname, photoURL: s.photoURL })))
        }
      }
    }
    console.log('접속 종료:', socket.id)
  })
})

if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '../../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_, res) => res.sendFile(join(clientDist, 'index.html')))
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
})
