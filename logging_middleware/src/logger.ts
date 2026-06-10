import axios from 'axios'
import { AuthConfig, Level, LogPayload, Package, Stack } from './types'
import { getToken } from './auth'

const LOG_URL = 'http://4.224.186.213/evaluation-service/logs'

let globalConfig: AuthConfig | null = null

export function initLogger(config: AuthConfig) {
  globalConfig = config
}

export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<void> {
  if (!globalConfig) {
    return
  }

  try {
    const token = await getToken(globalConfig)

    const payload: LogPayload = {
      stack,
      level,
      package: pkg,
      message
    }

    await axios.post(LOG_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
  } catch {
    // silently swallow — logging must never crash the app
  }
}
