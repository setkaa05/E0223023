export type Stack = 'backend' | 'frontend'

export type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type Package =
  | 'cache'
  | 'controller'
  | 'cron_job'
  | 'db'
  | 'domain'
  | 'component'
  | 'hook'
  | 'service'
  | 'api'
  | 'store'

export interface AuthConfig {
  email: string
  name: string
  rollNo: string
  accessCode: string
  clientID: string
  clientSecret: string
}

export interface LogPayload {
  stack: Stack
  level: Level
  package: Package
  message: string
}
