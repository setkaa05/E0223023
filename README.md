# Campus Notification Platform

A full-stack campus notification system supporting real-time updates for Placements, Events, and Results.

---

## Repository Structure

├── logging_middleware/        # Reusable TypeScript logging package
├── notification_app_be/       # Express + TypeScript backend (REST API + WebSocket)
├── notification_app_fe/       # React + Material UI frontend
├── stage6_priority/           # Priority inbox standalone script (Stage 6)
└── notification_system_design.md   # System design document (Stages 1–6)



---

## Setup

### Prerequisites
- Node.js 18+
- npm

### 1. Logging Middleware

```bash
cd logging_middleware
npm install
npm run build
2. Backend

cd notification_app_be
npm install

# create .env from example
cp .env.example .env
# fill in your credentials in .env

npm run dev     # development (ts-node)
# or
npm run build && npm start   # production
Backend runs on http://localhost:5000

3. Frontend

cd notification_app_fe
npm install
npm run dev
Frontend runs on http://localhost:3000

Note: Start the backend before the frontend. The frontend proxies API calls through the backend.

4. Stage 6 — Priority Inbox Script

cd stage6_priority
npm install
npm start
API Endpoints
Method	Endpoint	Description
GET	/api/v1/notifications	Fetch notifications (paginated, filterable)
GET	/api/v1/notifications/:id	Get single notification
POST	/api/v1/notifications	Create notification
PATCH	/api/v1/notifications/:id/read	Mark as read
PATCH	/api/v1/notifications/read-all	Mark all as read
POST	/api/v1/notifications/bulk-send	Bulk notify all students
GET	/health	Health check
Query params for GET /api/v1/notifications:

page (default: 1)
limit (default: 20)
notification_type — Placement / Event / Result
is_read — true / false
Frontend Pages
/ — All Notifications: full list with type filter, pagination, new/read distinction
/priority — Priority Inbox: top N notifications ranked by type weight + recency, with N slider (5–20) and type filter
Tech Stack
Layer	Stack
Backend	Node.js, Express, TypeScript, SQLite (better-sqlite3), WebSocket (ws)
Frontend	React 18, TypeScript, Vite, Material UI v5, React Router v6
Logging	Custom middleware — posts to evaluation log API
Stage 6	TypeScript, min-heap priority queue
