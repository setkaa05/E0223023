import { Notification, NotificationType, PriorityNotification } from '../types'

const TYPE_WEIGHT: Record<NotificationType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1
}

function minutesAgo(timestamp: string): number {
  const diff = Date.now() - new Date(timestamp).getTime()
  return diff / 60000
}

function calcScore(n: Notification): number {
  const weight = TYPE_WEIGHT[n.Type] ?? 1
  const recency = 1000 / (minutesAgo(n.Timestamp) + 1)
  return weight * 100 + recency
}

export function getTopN(notifications: Notification[], n: number): PriorityNotification[] {
  return notifications
    .map(notif => ({ ...notif, score: calcScore(notif) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}
