import {
  createRoom, joinRoom, getRoom, getRoomBySocketId,
  getRoomList, getBattlingRoomList, startGame, addMessage,
  removePlayerFromRoom, markPlayerDisconnected, rejoinRoom,
  addSpectator, removeSpectatorFromRoom,
} from './gameManager.js'
import { TURNS_PER_PLAYER, BOT_JOIN_DELAY_MS, RECONNECT_GRACE_MS, TURN_DURATION_MS } from './constants.js'

// key: oldSocketId, value: { timer, roomId }
const pendingDisconnects = new Map()

export function registerSocketHandlers(socket, io, engine) {
  const { startTurnTimer, handleTurnEnd, handleOpponentQuit, joinBotToRoom, buildGameStartPayload, broadcastCountdown } = engine

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
      botDelay: BOT_JOIN_DELAY_MS,
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

    broadcastCountdown(room)
    setTimeout(() => {
      room.turnDurationMs = TURN_DURATION_MS
      startGame(room)
      io.to(room.id).emit('game-start', buildGameStartPayload(room))
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
      turnDuration: Math.floor((room.turnDurationMs ?? TURN_DURATION_MS) / 1000),
    })

    socket.to(room.id).emit('opponent-reconnected', { nickname: nickname.trim() })

    if (room.state === 'battling' && !room.timer) {
      const currentPlayer = room.players[room.currentTurnIndex]
      if (currentPlayer?.isBot) {
        // handleBotTurn 이미 실행 중 → safety timer만 복구 (중복 실행 방지)
        const elapsed = room.turnStartedAt ? Date.now() - room.turnStartedAt : 0
        const remaining = Math.max(5000, (room.turnDurationMs ?? TURN_DURATION_MS) - elapsed)
        room.timer = setTimeout(() => handleTurnEnd(room, true), remaining)
      } else {
        startTurnTimer(room)
      }
    }

    console.log(`재접속: ${nickname} → 방 ${roomId}`)
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
    engine.handleTurnEnd(room)
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
    const initVotedProfiles = [0, 1].map(pidx =>
      (room.votes || []).filter(v => v.playerIndex === pidx).map(v => {
        const s = room.spectators.find(sp => sp.id === v.socketId)
        return s ? { nickname: s.nickname, photoURL: s.photoURL } : null
      }).filter(Boolean)
    )
    socket.emit('spectate-state', {
      players: room.players.map(p => p.nickname),
      topic: room.topic,
      messages: room.messages,
      currentTurnIndex: room.currentTurnIndex,
      currentNickname: room.players[room.currentTurnIndex]?.nickname,
      turnCount: room.turnCount,
      totalTurns: TURNS_PER_PLAYER * 2,
      state: room.state,
      turnDuration: Math.floor((room.turnDurationMs ?? TURN_DURATION_MS) / 1000),
      spectators: room.spectators.map(s => ({ nickname: s.nickname, photoURL: s.photoURL })),
      voteOpen: !!room.voteOpen,
      voteCount: [
        (room.votes || []).filter(v => v.playerIndex === 0).length,
        (room.votes || []).filter(v => v.playerIndex === 1).length,
      ],
      votedProfiles: initVotedProfiles,
    })
    io.to(room.id).emit('spectator-list', room.spectators.map(s => ({ nickname: s.nickname, photoURL: s.photoURL })))
    if (room.state === 'done' && room.lastResult) {
      socket.emit('game-result', room.lastResult)
    }
    console.log(`관람자 입장: ${socket.id} → 방 ${roomId}`)
  })

  socket.on('submit-vote', ({ roomId, playerIndex }) => {
    if (playerIndex !== 0 && playerIndex !== 1) return
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

  socket.on('request-bot', ({ roomId }) => {
    const room = getRoom(roomId?.trim())
    if (!room || room.state !== 'waiting' || room.players.length !== 1) return
    if (room.botJoinTimer) { clearTimeout(room.botJoinTimer); room.botJoinTimer = null }
    joinBotToRoom(room)
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

      const leavingNickname = room.players.find(p => p.id === socket.id)?.nickname
      const timer = setTimeout(async () => {
        pendingDisconnects.delete(socket.id)
        const removedRoom = removePlayerFromRoom(socket.id)
        if (removedRoom) {
          await handleOpponentQuit(removedRoom, leavingNickname)
          io.emit('room-list', getRoomList())
          io.emit('battling-list', getBattlingRoomList())
        }
      }, RECONNECT_GRACE_MS)

      pendingDisconnects.set(socket.id, { timer, roomId: room.id })
    } else {
      const removedRoom = removePlayerFromRoom(socket.id)
      if (removedRoom) {
        if (removedRoom.state === 'judging' || removedRoom.state === 'done') {
          // 게임 마무리 중 → game-result가 올 것이므로 opponent-left 미발송
        } else {
          if (removedRoom.botJoinTimer) clearTimeout(removedRoom.botJoinTimer)
          io.to(removedRoom.id).emit('opponent-left')
        }
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
}
