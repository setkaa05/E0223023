import { initLogger, Log as _Log, Level, Package, Stack } from '../../logging_middleware/src/index'

// initialize once with env credentials
initLogger({
  email: process.env.EMAIL || '',
  name: process.env.NAME || '',
  rollNo: process.env.ROLL_NO || '',
  accessCode: process.env.ACCESS_CODE || '',
  clientID: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || ''
})

export async function Log(stack: Stack, level: Level, pkg: Package, message: string) {
  return _Log(stack, level, pkg, message)
}
