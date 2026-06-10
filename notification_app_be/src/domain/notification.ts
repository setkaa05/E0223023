export type NotificationType = 'Placement' | 'Event' | 'Result'

export interface Notification {
  id: string
  studentId: string
  type: NotificationType
  message: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateNotificationDto {
  studentIds: string[]
  type: NotificationType
  message: string
}

export interface BulkSendDto {
  type: NotificationType
  message: string
}

export interface PaginationQuery {
  page?: number
  limit?: number
  notification_type?: NotificationType
  is_read?: boolean
}
