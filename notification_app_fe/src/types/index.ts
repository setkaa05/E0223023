export type NotificationType = 'Placement' | 'Event' | 'Result'

export interface Notification {
  ID: string
  Type: NotificationType
  Message: string
  Timestamp: string
}

export interface PaginatedResponse {
  notifications: Notification[]
}

export interface PriorityNotification extends Notification {
  score: number
}
