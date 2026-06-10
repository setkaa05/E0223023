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