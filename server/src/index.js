import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocketId,
  getRoomList,
  startGame,
  addMessage,
  nextTurn,
  removePlayerFromRoom,
  TURN_DURATION_MS,
} from './gameManager.js'
import { judge } from './aiJudge.js'

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.get('/health', (_, res) => res.json({ ok: true }))

function startTurnTimer(room) {
  if (room.timer) clearTimeout(room.timer)

  room.timer = setTimeout(() => {
    handleTurnEnd(room, true)
  }, TURN_DURATION_MS)
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
    io.to(room.id).emit('game-judging')

    const judgment = await judge(room.topic, room.players, room.messages)

    io.to(room.id).emit('game-result', {
      winner: judgment.winner,
      comment: judgment.comment,
      player1Score: judgment.player1Score,
      player2Score: judgment.player2Score,
      players: room.players.map(p => p.nickname),
      messages: room.messages,
    })
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

  socket.on('create-room', ({ nickname, topic }) => {
    if (!nickname?.trim() || !topic?.trim()) return

    const room = createRoom(socket.id, nickname.trim(), topic.trim())
    socket.join(room.id)

    socket.emit('room-created', {
      roomId: room.id,
      topic: room.topic,
      nickname: nickname.trim(),
    })

    io.emit('room-list', getRoomList())
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
    socket.join(room.id)

    socket.to(room.id).emit('player-joined', { nickname: nickname.trim() })

    socket.emit('room-joined', {
      roomId: room.id,
      topic: room.topic,
      nickname: nickname.trim(),
      opponent: room.players[0].nickname,
    })

    io.emit('room-list', getRoomList())

    setTimeout(() => {
      startGame(room)

      io.to(room.id).emit('game-start', {
        players: room.players.map(p => p.nickname),
        topic: room.topic,
        currentTurnIndex: 0,
        currentNickname: room.players[0].nickname,
        turnCount: 0,
        totalTurns: 10,
      })

      startTurnTimer(room)
    }, 1000)

    console.log(`방 입장: ${room.id} | ${nickname} 합류`)
  })

  socket.on('send-message', ({ text }) => {
    if (!text?.trim()) return

    const room = getRoomBySocketId(socket.id)
    if (!room || room.state !== 'battling') return

    const added = addMessage(room, socket.id, text.trim())
    if (!added) return

    io.to(room.id).emit('message-added', {
      nickname: room.players.find(p => p.id === socket.id).nickname,
      text: text.trim(),
      playerIndex: room.currentTurnIndex,
    })

    handleTurnEnd(room)
  })

  socket.on('get-room-list', () => {
    socket.emit('room-list', getRoomList())
  })

  socket.on('disconnect', () => {
    const room = removePlayerFromRoom(socket.id)
    if (room) {
      io.to(room.id).emit('opponent-left')
      io.emit('room-list', getRoomList())
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
