import axios from 'axios'
import { Notification, NotificationType } from '../types'

const BACKEND_URL = 'http://localhost:5000/api/v1'

export interface FetchParams {
  page?: number
  limit?: number
  notification_type?: NotificationType | ''
}

export async function fetchNotifications(params: FetchParams = {}): Promise<Notification[]> {
  const query: Record<string, string | number> = {}
  if (params.page) query.page = params.page
  if (params.limit) query.limit = params.limit
  if (params.notification_type) query.notification_type = params.notification_type

  const res = await axios.get(`${BACKEND_URL}/proxy/notifications`, { params: query })
  return res.data.notifications as Notification[]
}
