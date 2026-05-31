import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getRoom, getResult } from './gameManager.js'
import { createGameEngine } from './gameEngine.js'
import { registerSocketHandlers } from './socketHandlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

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

const engine = createGameEngine(io)

io.on('connection', socket => {
  registerSocketHandlers(socket, io, engine)
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
