import { Router, Request, Response } from 'express'
import axios from 'axios'
import { Log } from '../../lib/logger'

const router = Router()

// proxy auth so frontend can get a fresh token without exposing credentials in browser
router.get('/token', async (_req: Request, res: Response) => {
  try {
    const r = await axios.post('http://4.224.186.213/evaluation-service/auth', {
      email: process.env.EMAIL,
      name: process.env.NAME,
      rollNo: process.env.ROLL_NO,
      accessCode: process.env.ACCESS_CODE,
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET
    }, { headers: { 'Content-Type': 'application/json' } })

    await Log('backend', 'info', 'controller', 'token refreshed for frontend')
    return res.json({ token: r.data.access_token })
  } catch (err) {
    await Log('backend', 'error', 'controller', `Token refresh failed: ${err}`)
    return res.status(500).json({ error: 'Could not fetch token' })
  }
})

export default router
