import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import notificationRoutes from './routes/notification.routes'
import authRoutes from './routes/auth.routes'
import proxyRoutes from './routes/proxy.routes'
import { errorHandler } from './middleware/error'
import { Log } from '../lib/logger'
import { getDb } from './db/connection'
import fs from 'fs'
import path from 'path'

const PORT = parseInt(process.env.PORT || '5000')

// ensure data directory exists for SQLite
const dataDir = path.join(__dirname, '../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// init DB on startup
getDb()

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// store connected clients by student ID
const clients = new Map<string, WebSocket>()

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost`)
  const studentId = url.searchParams.get('studentId') || 'anonymous'

  clients.set(studentId, ws)
  Log('backend', 'info', 'controller', `WebSocket connected: student ${studentId}`)

  ws.on('close', () => {
    clients.delete(studentId)
    Log('backend', 'debug', 'controller', `WebSocket disconnected: student ${studentId}`)
  })
})

// make clients accessible to controllers via app locals
app.locals.wsClients = clients

app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/proxy', proxyRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

server.listen(PORT, async () => {
  await Log('backend', 'info', 'domain', `Server running on port ${PORT}`)
})

export { wss, clients }
