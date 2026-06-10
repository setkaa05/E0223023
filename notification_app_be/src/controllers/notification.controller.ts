import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/connection'
import { BulkSendDto, CreateNotificationDto, NotificationType } from '../domain/notification'
import { Log } from '../../lib/logger'

const VALID_TYPES: NotificationType[] = ['Placement', 'Event', 'Result']

export async function getNotifications(req: Request, res: Response) {
  try {
    const db = getDb()
    const studentId = req.query.studentId as string || 'stu-001'
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const type = req.query.notification_type as NotificationType | undefined
    const isRead = req.query.is_read

    const offset = (page - 1) * limit

    let query = `SELECT id, student_id, type, message, is_read, created_at, updated_at
                 FROM notifications WHERE student_id = ?`
    const params: (string | number)[] = [studentId]

    if (type && VALID_TYPES.includes(type)) {
      query += ` AND type = ?`
      params.push(type)
    }

    if (isRead !== undefined) {
      query += ` AND is_read = ?`
      params.push(isRead === 'true' ? 1 : 0)
    }

    const countRow = db.prepare(
      query.replace('SELECT id, student_id, type, message, is_read, created_at, updated_at', 'SELECT COUNT(*) as total')
    ).get(...params) as { total: number }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const rows = db.prepare(query).all(...params) as any[]

    const data = rows.map(r => ({
      id: r.id,
      studentId: r.student_id,
      type: r.type,
      message: r.message,
      isRead: r.is_read === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))

    await Log('backend', 'info', 'controller',
      `Fetched ${data.length} notifications for student ${studentId} (page ${page})`)

    res.json({
      data,
      pagination: {
        page,
        limit,
        total: countRow.total,
        hasMore: offset + data.length < countRow.total
      }
    })
  } catch (err) {
    await Log('backend', 'error', 'controller', `Failed to fetch notifications: ${err}`)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getNotificationById(req: Request, res: Response) {
  try {
    const db = getDb()
    const row = db.prepare(
      `SELECT id, student_id, type, message, is_read, created_at, updated_at
       FROM notifications WHERE id = ?`
    ).get(req.params.id) as any

    if (!row) {
      await Log('backend', 'warn', 'controller', `Notification not found: ${req.params.id}`)
      return res.status(404).json({ error: 'Notification not found' })
    }

    await Log('backend', 'debug', 'controller', `Fetched notification ${req.params.id}`)

    return res.json({
      id: row.id,
      studentId: row.student_id,
      type: row.type,
      message: row.message,
      isRead: row.is_read === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  } catch (err) {
    await Log('backend', 'error', 'controller', `getNotificationById failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const db = getDb()
    const now = new Date().toISOString()

    const result = db.prepare(
      `UPDATE notifications SET is_read = 1, updated_at = ? WHERE id = ?`
    ).run(now, req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    await Log('backend', 'info', 'controller', `Marked notification ${req.params.id} as read`)
    return res.json({ id: req.params.id, isRead: true, updatedAt: now })
  } catch (err) {
    await Log('backend', 'error', 'controller', `markAsRead failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function markAllRead(req: Request, res: Response) {
  try {
    const db = getDb()
    const studentId = (req.query.studentId as string) || 'stu-001'
    const now = new Date().toISOString()

    const result = db.prepare(
      `UPDATE notifications SET is_read = 1, updated_at = ?
       WHERE student_id = ? AND is_read = 0`
    ).run(now, studentId)

    await Log('backend', 'info', 'controller',
      `Marked all ${result.changes} notifications read for student ${studentId}`)

    return res.json({ updated: result.changes })
  } catch (err) {
    await Log('backend', 'error', 'controller', `markAllRead failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createNotification(req: Request, res: Response) {
  try {
    const body = req.body as CreateNotificationDto

    if (!body.studentIds?.length || !body.type || !body.message) {
      return res.status(400).json({ error: 'studentIds, type, and message are required' })
    }

    if (!VALID_TYPES.includes(body.type)) {
      return res.status(400).json({ error: 'Invalid notification type' })
    }

    const db = getDb()
    const now = new Date().toISOString()
    const insert = db.prepare(
      `INSERT INTO notifications (id, student_id, type, message, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )

    const insertMany = db.transaction((ids: string[]) => {
      for (const sid of ids) {
        insert.run(uuidv4(), sid, body.type, body.message, now, now)
      }
    })

    insertMany(body.studentIds)

    await Log('backend', 'info', 'controller',
      `Created ${body.message} notification for ${body.studentIds.length} students`)

    return res.status(201).json({
      type: body.type,
      message: body.message,
      recipients: body.studentIds.length,
      createdAt: now
    })
  } catch (err) {
    await Log('backend', 'error', 'controller', `createNotification failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function bulkSend(req: Request, res: Response) {
  try {
    const body = req.body as BulkSendDto

    if (!body.type || !body.message) {
      return res.status(400).json({ error: 'type and message are required' })
    }

    if (!VALID_TYPES.includes(body.type)) {
      return res.status(400).json({ error: 'Invalid notification type' })
    }

    const db = getDb()
    const students = db.prepare('SELECT id FROM students').all() as { id: string }[]
    const now = new Date().toISOString()
    const jobId = uuidv4()

    const insert = db.prepare(
      `INSERT INTO notifications (id, student_id, type, message, is_read, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )

    const insertAll = db.transaction(() => {
      for (const s of students) {
        insert.run(uuidv4(), s.id, body.type, body.message, now, now)
      }
    })

    insertAll()

    await Log('backend', 'info', 'controller',
      `Bulk send job ${jobId}: sent "${body.message}" to ${students.length} students`)

    return res.status(202).json({
      jobId,
      status: 'completed',
      totalRecipients: students.length
    })
  } catch (err) {
    await Log('backend', 'fatal', 'db', `Bulk send failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function deleteNotification(req: Request, res: Response) {
  try {
    const db = getDb()
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    await Log('backend', 'info', 'controller', `Deleted notification ${req.params.id}`)
    return res.status(204).send()
  } catch (err) {
    await Log('backend', 'error', 'controller', `deleteNotification failed: ${err}`)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
