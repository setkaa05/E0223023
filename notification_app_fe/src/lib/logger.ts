import axios from 'axios'

type Stack = 'backend' | 'frontend'
type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
type Package = 'component' | 'hook' | 'service' | 'api' | 'store'

const BACKEND_URL = 'http://localhost:5000/api/v1'

export async function Log(stack: Stack, level: Level, pkg: Package, message: string): Promise<void> {
  try {
    await axios.post(`${BACKEND_URL}/proxy/log`, { stack, level, package: pkg, message })
  } catch {
    // silently swallow
  }
}
