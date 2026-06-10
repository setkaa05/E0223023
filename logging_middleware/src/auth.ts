import axios from 'axios'
import { AuthConfig } from './types'

const AUTH_URL = 'http://4.224.186.213/evaluation-service/auth'

let cachedToken = ''
let tokenExpiry = 0

export async function getToken(config: AuthConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // reuse token if still valid with a 60s buffer
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken
  }

  const res = await axios.post(AUTH_URL, {
    email: config.email,
    name: config.name,
    rollNo: config.rollNo,
    accessCode: config.accessCode,
    clientID: config.clientID,
    clientSecret: config.clientSecret
  }, {
    headers: { 'Content-Type': 'application/json' }
  })

  cachedToken = res.data.access_token
  tokenExpiry = res.data.expires_in
  return cachedToken
}

export function setToken(token: string, expiry: number) {
  cachedToken = token
  tokenExpiry = expiry
}
