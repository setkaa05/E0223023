import { Router, Request, Response } from 'express'
import axios from 'axios'
import { Log } from '../../lib/logger'

const router = Router()
const NOTIF_URL = 'http://4.224.186.213/evaluation-service/notifications'

let cachedToken = ''
let tokenExpiry = 0

async function getFreshToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && tokenExpiry > now + 60) return cachedToken

  const res = await axios.post('http://4.224.186.213/evaluation-service/auth', {
    email: process.env.EMAIL,
    name: process.env.NAME,
    rollNo: process.env.ROLL_NO,
    accessCode: process.env.ACCESS_CODE,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
  }, { headers: { 'Content-Type': 'application/json' } })

  cachedToken = res.data.access_token
  tokenExpiry = res.data.expires_in
  return cachedToken
}

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const token = await getFreshToken()
    const params: Record<string, string> = {}

    if (req.query.limit)             params.limit = req.query.limit as string
    if (req.query.page)              params.page  = req.query.page as string
    if (req.query.notification_type) params.notification_type = req.query.notification_type as string

    const r = await axios.get(NOTIF_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params
    })

    await Log('backend', 'info', 'controller',
      `proxied notifications (${r.data.notifications?.length ?? 0} items)`)

    return res.json(r.data)
  } catch (err) {
    await Log('backend', 'error', 'controller', `proxy notifications failed: ${err}`)
    return res.status(502).json({ error: 'failed to fetch from upstream' })
  }
})

router.post('/log', async (req: Request, res: Response) => {
  try {
    const token = await getFreshToken()
    await axios.post('http://4.224.186.213/evaluation-service/logs', req.body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    return res.status(204).send()
  } catch (err) {
    return res.status(502).json({ error: 'log proxy failed' })
  }
})

export default router
