# Campus Notification Platform — System Design

---

## Stage 1

### Core Actions

The notification platform needs to support these fundamental operations:

- Fetch all notifications for a student (paginated, filterable by type and read status)
- Get a single notification by ID
- Mark one notification as read
- Mark all notifications as read
- Create a notification (admin/system action)
- Bulk-send a notification to all students
- Stream real-time notifications to connected clients

---

### REST API Endpoints

#### 1. Get Notifications

```
GET /api/v1/notifications
```

**Headers**
```
Authorization: Bearer <token>
```

**Query Parameters**
| Param | Type | Description |
|---|---|---|
| page | integer | Page number, default 1 |
| limit | integer | Items per page, default 20 |
| notification_type | string | `Placement`, `Event`, or `Result` |
| is_read | boolean | Filter by read status |

**Response 200**
```json
{
  "data": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Placement",
      "message": "Microsoft is hiring — apply by Friday",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "hasMore": true
  }
}
```

---

#### 2. Get Single Notification

```
GET /api/v1/notifications/:id
```

**Headers**
```
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "type": "Placement",
  "message": "Microsoft is hiring — apply by Friday",
  "isRead": false,
  "createdAt": "2026-04-22T17:51:30Z"
}
```

**Response 404**
```json
{ "error": "Notification not found" }
```

---

#### 3. Mark Notification as Read

```
PATCH /api/v1/notifications/:id/read
```

**Headers**
```
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "isRead": true,
  "updatedAt": "2026-04-22T18:00:00Z"
}
```

---

#### 4. Mark All Notifications as Read

```
PATCH /api/v1/notifications/read-all
```

**Headers**
```
Authorization: Bearer <token>
```

**Response 200**
```json
{ "updated": 42 }
```

---

#### 5. Create Notification (Admin)

```
POST /api/v1/notifications
```

**Headers**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**
```json
{
  "studentIds": ["uuid-1", "uuid-2"],
  "type": "Placement",
  "message": "TCS is hiring — report to hall A at 10am"
}
```

**Response 201**
```json
{
  "id": "new-uuid",
  "type": "Placement",
  "message": "TCS is hiring — report to hall A at 10am",
  "createdAt": "2026-04-22T18:00:00Z"
}
```

---

#### 6. Bulk Notify All Students (Admin)

```
POST /api/v1/notifications/bulk-send
```

**Headers**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**
```json
{
  "type": "Placement",
  "message": "Placement drive tomorrow at 9am"
}
```

**Response 202** *(Accepted — async job started)*
```json
{
  "jobId": "job-uuid",
  "status": "queued",
  "totalRecipients": 50000
}
```

---

### Real-Time Notification Mechanism

**Choice: WebSocket (via Socket.io)**

When a student logs in, the client opens a WebSocket connection to the server. The server places each client in a room keyed by their student ID (`room:student-<id>`). When a new notification is created, the server emits a `new_notification` event to the relevant room(s).

```
Client → Server : connect (with auth token)
Server → Client : connected, joined room:student-<id>
Server → Client : new_notification { id, type, message, createdAt }
Client → Server : notification_ack { id }
```

This approach supports:
- Instant delivery without polling
- Acknowledgment tracking
- Automatic reconnection on disconnect
- Fallback to long-polling (built into Socket.io)

---

## Stage 2

### Database Choice: PostgreSQL

**Reasons:**
- Strong ACID guarantees — critical for ensuring no notification is silently lost or double-inserted
- Native `ENUM` type for `notification_type` — enforces data integrity at the DB layer
- Excellent composite indexing and partial indexes (essential for the unread filter query)
- Table partitioning support for scaling to millions of rows
- Widely available managed hosting (RDS, Supabase, Neon)

---

### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');

CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  roll_no    VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- indexes added upfront based on expected query patterns
CREATE INDEX idx_notif_student       ON notifications(student_id);
CREATE INDEX idx_notif_student_unread ON notifications(student_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notif_type          ON notifications(type);
CREATE INDEX idx_notif_created       ON notifications(created_at DESC);
```

---

### Scaling Problems at High Volume

| Problem | Description |
|---|---|
| Table bloat | 50k students × avg 200 notifications = 10M+ rows in a single table |
| Slow unread scan | Without partial index, scanning all rows per student is O(n) |
| Write amplification | Bulk notify inserts 50k rows at once — locks can cascade |
| Index maintenance | Every insert updates all indexes — slows writes at scale |
| Read replica lag | Analytics queries on primary DB compete with app reads |

**Solutions:**

1. **Partition by `created_at`** — monthly range partitions keep each partition small
2. **Archive old notifications** — move notifications older than 6 months to a cold storage table
3. **Partial index on `is_read = false`** — shrinks as notifications are read; very fast
4. **Read replicas** — route all `SELECT` queries to replicas, writes to primary
5. **Cache unread counts** in Redis to avoid count queries on every page load

---

### SQL Queries

**Fetch paginated notifications for a student:**
```sql
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

**Fetch unread notifications:**
```sql
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT $2;
```

**Mark notification as read:**
```sql
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE id = $1 AND student_id = $2;
```

**Mark all as read:**
```sql
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE student_id = $1 AND is_read = false;
```

**Count unread per student:**
```sql
SELECT COUNT(*) FROM notifications
WHERE student_id = $1 AND is_read = false;
```

---

## Stage 3

### Query Analysis

**Original query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

**Is it accurate?**

Mostly, but with two issues:
1. `ORDER BY createdAt ASC` returns oldest-first. For a notification inbox users almost always want newest-first (`DESC`).
2. No `LIMIT` � can return thousands of rows to the application layer.

**Why is it slow at 50k students / 5M notifications?**

1. No composite index on `(studentID, isRead)` � full scan of student's rows then filter in memory.
2. `SELECT *` fetches every column including large `message` TEXT fields.
3. `ORDER BY createdAt` triggers an in-memory sort on the filtered result set.
4. No `LIMIT` � all matching rows transferred to the application.

**What to change:**
```sql
SELECT id, type, message, created_at
FROM notifications
WHERE student_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT 50;
```

Add a partial index:
```sql
CREATE INDEX idx_notif_unread_student
ON notifications(student_id, created_at DESC)
WHERE is_read = false;
```

Cost before: O(n) full scan. Cost after: O(log n + k) index seek.

**Is indexing every column a good idea?** No. Every index slows INSERT/UPDATE/DELETE, consumes disk, and confuses the query planner. Only index columns used in WHERE, JOIN ON, ORDER BY of frequent queries.

**Students with Placement notification in the last 7 days:**
```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
INNER JOIN notifications n ON n.student_id = s.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Caching Strategy

**Problem:** Every page load hits the DB with a SELECT per student.

**Strategy 1: Redis Cache**
Cache notification list per student, TTL 60s. Invalidate on new notification or read change.
- Pro: Near-zero DB load; sub-millisecond responses
- Con: Stale data up to TTL; Redis infra overhead; invalidation complexity

**Strategy 2: HTTP ETags**
ETag from latest notification timestamp. Return 304 Not Modified on match.
- Pro: Zero bandwidth for unchanged data; no extra infra
- Con: Still hits server for ETag check

**Strategy 3: Cursor-based Pagination**
Fetch pages using a cursor (last seen created_at) instead of offset.
- Pro: Smaller queries; each page independently cacheable
- Con: Cannot jump to page N; requires client state

**Strategy 4: Client-side Cache**
Store in localStorage/IndexedDB, refresh in background.
- Pro: Instant perceived load; works offline
- Con: Stale across devices; unbounded growth

**Recommended:** Redis + cursor pagination. Cache each page independently, invalidate on write.

---

## Stage 5

### Bulk Notification � Redesign

**Shortcomings in original pseudocode:**
1. Sequential loop over 50k students is unacceptably slow (~42 min at 50ms/student)
2. One failure blocks all remaining students � no error isolation
3. No retry for transient failures
4. No way to identify which 200 students failed without re-running everything
5. Email down = in-app notifications also blocked (tight coupling)
6. HR has no progress feedback

**Should DB write and email happen together?** No.
- DB write is synchronous and must succeed (source of truth for in-app)
- Email is best-effort async � coupling them means a flaky email API blocks all in-app notifications

**Redesigned pseudocode:**
```python
function notify_all(message, type):
  student_ids = fetch_all_student_ids()
  job_id = create_job(len(student_ids))
  try:
    begin_transaction()
    for batch in chunk(student_ids, 1000):
      bulk_insert_notifications(batch, message, type)
      bulk_insert_email_queue(batch, message, job_id)  # outbox pattern
    commit_transaction()
  except Exception as e:
    rollback_transaction()
    return { error: "failed to queue notifications" }
  emit_to_all_connected_clients(message, type)
  return { jobId: job_id, status: "processing" }

# Separate worker
function process_email_queue():
  while True:
    batch = fetch_pending_emails(500)
    for item in batch:
      try:
        send_email(item.student_id, item.message)
        mark_email_sent(item.id)
      except:
        if item.retry_count < 3:
          requeue_with_backoff(item)
        else:
          mark_email_failed(item.id)
```

---

## Stage 6

### Priority Inbox

**Scoring formula:**
```
typeWeight: Placement=3, Result=2, Event=1
recencyScore = 1000 / (minutesSinceCreated + 1)
priorityScore = typeWeight * 100 + recencyScore
```

Recent Placement always outranks older Placement. A very recent Result can outrank a stale Placement.

**Efficient top-N with new notifications arriving:**
Use a min-heap of size N. On each new notification:
1. Compute score
2. If heap has fewer than N items � push
3. If score > heap minimum � replace minimum with new item
4. O(log N) per insertion � efficient at any throughput

Implementation is in `stage6_priority/index.ts`.