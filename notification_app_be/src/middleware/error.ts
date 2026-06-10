import { NextFunction, Request, Response } from 'express'
import { Log } from '../../lib/logger'

export async function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  await Log('backend', 'error', 'controller', `Unhandled error: ${err.message}`)
  res.status(500).json({ error: 'Something went wrong' })
}
