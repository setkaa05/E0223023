/**
 * Stage 6 — Priority Inbox
 *
 * Fetches notifications from the evaluation API and prints the top N
 * ranked by type weight (Placement > Result > Event) combined with recency.
 *
 * Run:  npm start
 */

import axios from 'axios'
import { initLogger, Log } from '../logging_middleware/src/index'

const AUTH_URL = 'http://4.224.186.213/evaluation-service/auth'
const NOTIF_URL = 'http://4.224.186.213/evaluation-service/notifications'

const CREDENTIALS = {
  email: 'msethukannan05@gmail.com',
  name: 'sethukannan m',
  rollNo: 'e0223023',
  accessCode: 'DvwEDZ',
  clientID: 'ea8cb4db-f256-4c2e-8ebb-18e8f3c8f2ff',
  clientSecret: 'ftTnWZBReBVuTMMr'
}

// init logging middleware with credentials
initLogger(CREDENTIALS)

type NotifType = 'Placement' | 'Event' | 'Result'

interface Notification {
  ID: string
  Type: NotifType
  Message: string
  Timestamp: string
}

interface ScoredNotification extends Notification {
  score: number
  rank: number
}

const TYPE_WEIGHT: Record<NotifType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1
}

function minutesAgo(ts: string): number {
  return (Date.now() - new Date(ts).getTime()) / 60000
}

function calcScore(n: Notification): number {
  return TYPE_WEIGHT[n.Type] * 100 + 1000 / (minutesAgo(n.Timestamp) + 1)
}

/**
 * Keeps the top N highest-scored notifications.
 * On each add() call, replaces the lowest-scored item if the new one ranks higher.
 * O(N) per insertion — efficient for streaming use cases.
 */
class PriorityInbox {
  private items: ScoredNotification[] = []
  private readonly n: number

  constructor(n: number) {
    this.n = n
  }

  add(notif: Notification) {
    const s = calcScore(notif)
    const item: ScoredNotification = { ...notif, score: s, rank: 0 }

    if (this.items.length < this.n) {
      this.items.push(item)
    } else {
      const minIdx = this.items.reduce(
        (mi, x, i, arr) => (x.score < arr[mi].score ? i : mi),
        0
      )
      if (s > this.items[minIdx].score) {
        this.items[minIdx] = item
      }
    }
  }

  getTopN(): ScoredNotification[] {
    return [...this.items]
      .sort((a, b) => b.score - a.score)
      .map((n, i) => ({ ...n, rank: i + 1 }))
  }
}

async function main() {
  await Log('backend', 'info', 'domain', 'priority inbox script started')

  // authenticate
  let token: string
  try {
    const authRes = await axios.post(AUTH_URL, CREDENTIALS, {
      headers: { 'Content-Type': 'application/json' }
    })
    token = authRes.data.access_token
    await Log('backend', 'info', 'controller', 'auth token obtained')
  } catch (err) {
    await Log('backend', 'fatal', 'controller', `auth failed: ${err}`)
    throw err
  }

  // fetch notifications
  let notifications: Notification[]
  try {
    const notifRes = await axios.get(NOTIF_URL, {
      headers: { Authorization: `Bearer ${token}` }
    })
    notifications = notifRes.data.notifications
    await Log('backend', 'info', 'controller', `fetched ${notifications.length} notifications from api`)
  } catch (err) {
    await Log('backend', 'error', 'controller', `failed to fetch notifications: ${err}`)
    throw err
  }

  // build priority inbox by streaming notifications one at a time
  const TOP_N = 10
  const inbox = new PriorityInbox(TOP_N)

  await Log('backend', 'debug', 'domain', `scoring ${notifications.length} notifications, keeping top ${TOP_N}`)

  for (const n of notifications) {
    inbox.add(n)
  }

  const results = inbox.getTopN()
  await Log('backend', 'info', 'domain', `top ${TOP_N} computed — highest score: ${results[0]?.score.toFixed(2)}, lowest: ${results[results.length - 1]?.score.toFixed(2)}`)

  // write results to stdout directly — not a logger, just terminal output
  const out = (line: string) => process.stdout.write(line + '\n')

  out(`\n=========== Top ${TOP_N} Priority Notifications ===========`)
  out(`Ranking: Placement (w=3) > Result (w=2) > Event (w=1) + recency\n`)

  for (const n of results) {
    const type = n.Type.padEnd(9)
    const score = n.score.toFixed(2).padStart(9)
    out(`#${n.rank}  [${type}]  score=${score}  |  "${n.Message}"  (${n.Timestamp})`)
  }

  await Log('backend', 'info', 'domain', 'priority inbox script done')
}

main().catch(async (err) => {
  await Log('backend', 'fatal', 'domain', `script crashed: ${err.message}`)
  process.stderr.write(`Error: ${err.message}\n`)
  process.exit(1)
})
