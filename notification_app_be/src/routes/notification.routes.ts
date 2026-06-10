import { Router } from 'express'
import {
  bulkSend,
  createNotification,
  deleteNotification,
  getNotificationById,
  getNotifications,
  markAllRead,
  markAsRead
} from '../controllers/notification.controller'

const router = Router()

router.get('/', getNotifications)
router.get('/:id', getNotificationById)
router.post('/', createNotification)
router.post('/bulk-send', bulkSend)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markAsRead)
router.delete('/:id', deleteNotification)

export default router
