import { v4 as uuidv4 } from 'uuid'

const TURNS_PER_PLAYER = 5
const TURN_DURATION_MS = 30000

const rooms = new Map()

export function createRoom(hostSocketId, nickname, topic) {
  const roomId = uuidv4().slice(0, 6).toUpperCase()
  const room = {
    id: roomId,
    topic,
    players: [{ id: hostSocketId, nickname }],
    spectators: [],
    state: 'waiting',
    currentTurnIndex: 0,
    turnCount: 0,
    messages: [],
    timer: null,
  }
  rooms.set(roomId, room)
  return room
}

export function joinRoom(roomId, socketId, nickname) {
  const room = rooms.get(roomId)
  if (!room) return { error: '방을 찾을 수 없습니다.' }
  if (room.players.length >= 2) return { error: '방이 꽉 찼습니다.' }
  if (room.state !== 'waiting') return { error: '이미 시작된 게임입니다.' }

  room.players.push({ id: socketId, nickname })
  return { room }
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null
}

export function getRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === socketId)) return room
  }
  return null
}

export function getRoomList() {
  return [...rooms.values()]
    .filter(r => r.state === 'waiting' && r.players.length < 2)
    .map(r => ({ id: r.id, topic: r.topic, playerCount: r.players.length }))
}

export function startGame(room) {
  room.state = 'battling'
  room.currentTurnIndex = 0
  room.turnCount = 0
}

export function addMessage(room, socketId, text) {
  const player = room.players.find(p => p.id === socketId)
  if (!player) return false

  const expectedPlayer = room.players[room.currentTurnIndex]
  if (expectedPlayer.id !== socketId) return false

  room.messages.push({
    nickname: player.nickname,
    text,
    turn: room.turnCount,
    playerIndex: room.currentTurnIndex,
  })
  return true
}

export function nextTurn(room) {
  room.turnCount++
  const totalTurns = TURNS_PER_PLAYER * 2

  if (room.turnCount >= totalTurns) {
    room.state = 'judging'
    return { finished: true }
  }

  room.currentTurnIndex = room.turnCount % 2
  return { finished: false, currentTurnIndex: room.currentTurnIndex }
}

export function getBattlingRoomList() {
  return [...rooms.values()]
    .filter(r => r.state === 'battling' || r.state === 'judging')
    .map(r => ({
      id: r.id,
      topic: r.topic,
      players: r.players.map(p => p.nickname),
      turnCount: r.turnCount,
      spectatorCount: r.spectators.length,
    }))
}

export function addSpectator(room, socketId) {
  if (!room.spectators.includes(socketId)) {
    room.spectators.push(socketId)
  }
}

export function removeSpectatorFromRoom(socketId) {
  for (const room of rooms.values()) {
    const idx = room.spectators.indexOf(socketId)
    if (idx !== -1) {
      room.spectators.splice(idx, 1)
      return room
    }
  }
  return null
}

export function deleteRoom(roomId) {
  const room = rooms.get(roomId)
  if (room?.timer) clearTimeout(room.timer)
  rooms.delete(roomId)
}

export function removePlayerFromRoom(socketId) {
  const room = getRoomBySocketId(socketId)
  if (!room) return null

  if (room.timer) {
    clearTimeout(room.timer)
    room.timer = null
  }

  rooms.delete(room.id)
  return room
}

export function markPlayerDisconnected(socketId) {
  const room = getRoomBySocketId(socketId)
  if (!room || room.state !== 'battling') return null

  if (room.timer) {
    clearTimeout(room.timer)
    room.timer = null
  }

  const player = room.players.find(p => p.id === socketId)
  if (player) player.disconnected = true

  return room
}

export function rejoinRoom(roomId, newSocketId, nickname) {
  const room = rooms.get(roomId)
  if (!room) return { error: '방을 찾을 수 없습니다.' }
  if (room.state !== 'battling' && room.state !== 'judging') return { error: '진행 중이 아닌 게임입니다.' }

  const player = room.players.find(p => p.nickname === nickname && p.disconnected)
  if (!player) return { error: '재접속할 수 없습니다.' }

  const oldSocketId = player.id
  player.id = newSocketId
  player.disconnected = false

  return { room, playerIndex: room.players.indexOf(player), oldSocketId }
}

export { TURN_DURATION_MS, TURNS_PER_PLAYER }
