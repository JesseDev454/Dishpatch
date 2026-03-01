# Dishpatch

Dishpatch is a multi-tenant Food Ordering and Restaurant Management SaaS for restaurants in Nigeria.

Current implementation delivers:
- Restaurant registration and login
- Protected dashboard for categories/items
- Tenant-scoped category CRUD
- Tenant-scoped item CRUD with availability toggle
- Item image upload + removal (Cloudinary-backed) and public menu image display
- Public menu + order creation
- Paystack payment initialization/verification/webhook
- Transactional email receipts and paid-order notifications via Resend
- Automatic pending-order expiry (30 minutes default) with realtime `order:updated` events
- Live Orders realtime dashboard via Socket.IO
- Analytics dashboard (overview, timeseries, top items) with tenant-safe aggregation
- Clear inline errors and success/error toast alerts in UI

## Tech Stack
- Backend: Node.js, Express, TypeORM, PostgreSQL (Neon in production)
- Frontend: React, Vite, TypeScript
- Auth: JWT access token + refresh token (refresh token in secure `httpOnly` cookie)

## Project Structure
- `backend` - API, auth, entities, migrations
- `frontend` - web app (register/login/dashboard)

## Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL 14+ (local dev/test) or Neon database URL

## Quick Start (Run Both Apps From Root)
1. From project root:
   ```bash
   npm install
   npm run install:all
   npm run dev
   ```
   `npm run dev` auto-creates `backend/.env` from `backend/.env.example` if missing.
2. Backend runs on `http://localhost:4000`
3. Frontend runs on `http://localhost:5173`

## Testing
### Backend (Jest + Supertest integration)
1. Copy backend test env template:
   ```bash
   # macOS/Linux
   cp backend/.env.test.example backend/.env.test
   # Windows PowerShell
   Copy-Item backend/.env.test.example backend/.env.test
   ```
2. Set `DATABASE_URL` in `backend/.env.test` (example):
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/dishpatch_test
   ```
3. Run backend tests:
   ```bash
   npm run test:backend
   ```

Notes:
- Tests run with `NODE_ENV=test`.
- Test DB must be a dedicated database (`dishpatch_test` recommended, never dev DB).
- Schema is created automatically before tests by running TypeORM migrations in Jest global setup.
- Each test starts from a clean DB state (Postgres truncate with `RESTART IDENTITY CASCADE`).

### Frontend
Current frontend test command runs TypeScript checks:
```bash
npm run test:frontend
```

### Run Everything
```bash
npm test
```

## Paystack Integration (Sprint 3)
### Required Env Vars (Backend)
Set in `backend/.env`:
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_BASE_URL` (optional, defaults to `https://api.paystack.co`)

### Ngrok Example
Frontend callback (port 5173):
```bash
ngrok http 5173
```

Backend webhook (port 4000):
```bash
ngrok http 4000
```

Use the ngrok URLs for:
- Callback URL: `https://<frontend-ngrok-subdomain>.ngrok-free.app/payment/callback`
- Webhook URL: `https://<backend-ngrok-subdomain>.ngrok-free.app/webhooks/paystack`

### Manual UAT Flow
1. Create an order at `http://localhost:5173/r/<restaurant-slug>`.
2. Click `Pay Now` and complete the Paystack checkout.
3. Paystack redirects to `/payment/callback?reference=...` (or `trxref` fallback).
4. Callback page shows `Processing payment...`, verifies via `/public/payments/paystack/verify`, then redirects to `/receipt/:reference` on success.
5. If verification fails, callback page shows `Payment not confirmed` with `Retry` and `Back to restaurant` options.
6. For webhook testing, register `POST /webhooks/paystack` in Paystack dashboard and confirm signature verification.

## Item Images (Current)
### Cloudinary Env Vars (Backend)
Set in `backend/.env`:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Upload Rules
- Accepted file types: `image/jpeg`, `image/png`, `image/webp`
- Max size: `2MB`
- Endpoint expects multipart field name: `image`

### Admin Upload Flow
1. Go to dashboard -> `Items`.
2. Create an item (or edit/select an existing item).
3. Upload image from item controls.
4. Backend stores image in Cloudinary and saves `item.imageUrl`.
5. Use `Remove image` to clear `imageUrl` when needed.

## Email Notifications (Sprint 5b)
### Required Env Vars (Backend)
Set in `backend/.env`:
- `RESEND_API_KEY`
- `EMAIL_FROM` (for example: `Dishpatch <noreply@yourdomain.com>`)
- `APP_BASE_URL` (for example: `http://localhost:5173`)

### Resend Setup
1. Create a Resend account at `https://resend.com`.
2. Generate an API key from the Resend dashboard.
3. Add and verify your sending domain in Resend.
4. Set `EMAIL_FROM` to a verified sender address on that domain.

### Local Testing
1. Set the env vars above in `backend/.env`.
2. Complete a successful payment flow from `/r/:slug`.
3. Confirm customer receipt email includes:
   - Restaurant name
   - Order details and items
   - Receipt link: `${APP_BASE_URL}/receipt/:reference`
4. Trigger the same success path again (duplicate webhook/verify) and confirm emails are not sent twice.

## Realtime Orders (Sprint 4)
### What Was Added
- Backend Socket.IO server with JWT-protected handshake auth
- Per-tenant room isolation (`restaurant:<restaurantId>`)
- `order:paid` broadcast when payment is marked successful
- `order:updated` broadcast when dashboard updates order status
- Optional `orders:snapshot` event on socket connection
- New protected endpoint: `PATCH /orders/:id/status`
- `GET /orders` now supports `status`, `limit`, and `page`

### Realtime Local Run Notes
- Ensure backend `FRONTEND_URL` matches your frontend URL (default `http://localhost:5173`).
- Pending payment orders auto-expire after `ORDER_EXPIRY_MINUTES` (default `30`), and expiry sweep runs every `ORDER_EXPIRY_JOB_INTERVAL_SECONDS` (default `60`).
- Start both apps:
  ```bash
  npm run dev
  ```
- Frontend proxies both `/api` and `/socket.io` to backend.

### Manual Realtime Test Steps
1. Login to dashboard at `http://localhost:5173/login`.
2. Open `Live Orders` from dashboard header.
3. In another tab, create and pay an order from `http://localhost:5173/r/<restaurant-slug>`.
4. Confirm the paid order appears instantly in `Incoming / Paid` without manual refresh.
5. Click `Accept` -> `Start Prep` -> `Mark Ready` -> `Complete` and confirm immediate UI updates.
6. Open a second admin browser/tab for the same restaurant and confirm updates broadcast there instantly.
7. Disconnect backend briefly and confirm `Realtime disconnected` badge appears; use `Refresh` as fallback.

## Analytics (Sprint 6)
### Protected Endpoints
- `GET /analytics/overview?range=7d|30d`
- `GET /analytics/timeseries?range=7d|30d`
- `GET /analytics/top-items?range=7d|30d&limit=5`

All analytics endpoints:
- Require admin JWT (`Authorization: Bearer <token>`)
- Are strictly tenant-scoped using authenticated `restaurantId`
- Never return cross-tenant data

### Revenue Calculation Rule
Revenue metrics include only orders with status in:
- `PAID`
- `ACCEPTED`
- `PREPARING`
- `READY`
- `COMPLETED`

Revenue excludes:
- `PENDING_PAYMENT`
- `EXPIRED`
- `CANCELLED`
- `FAILED_PAYMENT`

### Manual Analytics QA
1. Login to dashboard and open `Analytics` from sidebar.
2. Switch range between `7 Days` and `30 Days` and confirm KPI + chart refresh.
3. Create orders with paid and non-paid statuses, then confirm revenue only tracks revenue statuses above.
4. Confirm top items change based on paid/completed orders only.
5. Verify a second restaurant account cannot see the first restaurant's analytics data.

## Backend Setup
1. Go to backend:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env file and update values:
   ```bash
   # macOS/Linux
   cp .env.example .env
   # Windows PowerShell
   Copy-Item .env.example .env
   ```
4. Ensure `DATABASE_URL` points to your Postgres database (local or Neon).
5. Run migrations:
   ```bash
   npm run migration:run
   ```
6. Start backend:
   ```bash
   npm run dev
   ```

Backend runs on `http://localhost:4000`.

## Frontend Setup
1. Go to frontend:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start frontend:
   ```bash
   npm run dev
   ```

Frontend runs on `http://localhost:5173`.

Vite proxies `/api/*` to backend (`http://localhost:4000`).

## Environment Variables (Backend)
Set in `backend/.env`:
- `PORT` (default `4000`)
- `FRONTEND_URL` (single URL or comma-separated URLs, default `http://localhost:5173`)
- `DATABASE_URL` (required in production)
- `DB_CONNECT_TIMEOUT_MS` (default `10000`)
- `DB_POOL_MAX` (default `10`)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES` (default `15m`)
- `JWT_REFRESH_EXPIRES` (default `7d`)
- `BCRYPT_SALT_ROUNDS` (default `10`)
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `APP_BASE_URL` (default `http://localhost:5173`)
- `RESET_PASSWORD_TOKEN_TTL_MINUTES` (default `30`)
- `RESET_PASSWORD_REQUEST_LIMIT_PER_HOUR` (default `5`)
- `RESET_PASSWORD_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ORDER_EXPIRY_MINUTES` (default `30`)
- `ORDER_EXPIRY_JOB_INTERVAL_SECONDS` (default `60`)

## Deployment (Neon + Render + Vercel)
### 1) Neon (Database)
1. Create a Neon Postgres project/database.
2. Copy Neon pooled connection string and include SSL mode:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```
3. Use this `DATABASE_URL` on Render backend.

### 2) Render (Backend)
Create a Render Web Service from this repo with:
- Root Directory: repo root
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm --prefix backend run start:migrate`
- Auto Deploy: enabled

Render env vars:
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
DB_CONNECT_TIMEOUT_MS=10000
DB_POOL_MAX=10
FRONTEND_URL=https://dishpatch.vercel.app
JWT_ACCESS_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-secret>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
BCRYPT_SALT_ROUNDS=10
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CALLBACK_URL=https://dishpatch.vercel.app/payment/callback
PAYSTACK_BASE_URL=https://api.paystack.co
RESEND_API_KEY=re_...
EMAIL_FROM="Dishpatch <onboarding@resend.dev>"
APP_BASE_URL=https://dishpatch.vercel.app
RESET_PASSWORD_TOKEN_TTL_MINUTES=30
RESET_PASSWORD_REQUEST_LIMIT_PER_HOUR=5
RESET_PASSWORD_TOKEN_SECRET=<strong-random-secret>
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
ORDER_EXPIRY_MINUTES=30
ORDER_EXPIRY_JOB_INTERVAL_SECONDS=60
```

Notes:
- Backend is Postgres-only and reads `DATABASE_URL`.
- In production with Neon, use the pooled `-pooler` host to reduce auth latency.
- In `NODE_ENV=production`, startup and migrations fail fast if `DATABASE_URL` is missing.
- `start:render` runs migrations before starting the server.
- CORS and Socket.IO origin checks use `FRONTEND_URL`.

### 3) Vercel (Frontend)
Create a Vercel project for `frontend` only:
- Framework Preset: `Vite`
- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Vercel env vars:
```env
VITE_API_BASE_URL=https://dishpatch-8g6e.onrender.com
VITE_SOCKET_URL=https://dishpatch-8g6e.onrender.com
```

After setting/changing Vercel env vars, trigger a fresh redeploy. Existing deployments keep old env values.
In production, frontend API calls must resolve to:
- `https://dishpatch-8g6e.onrender.com/auth/register`
- `https://dishpatch-8g6e.onrender.com/auth/login`

Frontend routes (`/payment/callback`, `/receipt/:reference`, etc.) are handled by SPA rewrite in `frontend/vercel.json`.

### 4) Paystack + Resend URLs
- Paystack callback URL:
  - `https://dishpatch.vercel.app/payment/callback`
- Paystack webhook URL:
  - `https://dishpatch-8g6e.onrender.com/webhooks/paystack`
- Receipt links in emails:
  - `${APP_BASE_URL}/receipt/<reference>` (set `APP_BASE_URL` to Vercel URL)

### 5) Common Vercel Monorepo Fixes
- Ensure project Root Directory is `frontend` (not repo root).
- Ensure `VITE_*` env vars are defined in Vercel Project Settings.
- Do not run backend scripts on Vercel.
- Use `import.meta.env.VITE_*` (not `process.env`) in frontend code.
- Re-deploy after changing env vars.

### 6) Current Production Wiring
- Backend (Render): `https://dishpatch-8g6e.onrender.com`
- Frontend (Vercel): `https://dishpatch.vercel.app`
- Paystack callback: `https://dishpatch.vercel.app/payment/callback`
- Paystack webhook: `https://dishpatch-8g6e.onrender.com/webhooks/paystack`
- Receipt URL pattern: `https://dishpatch.vercel.app/receipt/<reference>`

## API Endpoints
### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Categories (protected)
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

### Items (protected)
- `GET /items?categoryId=<id>`
- `POST /items`
- `PATCH /items/:id`
- `DELETE /items/:id`
- `POST /items/:id/image` (multipart upload, field name `image`)
- `DELETE /items/:id/image` (clear image URL)

### Orders (protected)
- `GET /orders?status=PAID,ACCEPTED&limit=50&page=1`
- `PATCH /orders/:id/status`

### Analytics (protected)
- `GET /analytics/overview?range=7d|30d`
- `GET /analytics/timeseries?range=7d|30d`
- `GET /analytics/top-items?range=7d|30d&limit=5`

### Public Ordering + Payments
- `GET /public/restaurants/:slug`
- `GET /public/restaurants/:slug/menu`
- `POST /public/restaurants/:slug/orders`
- `POST /public/orders/:orderId/paystack/initialize`
- `GET /public/payments/paystack/verify?reference=<reference>`
- `GET /public/receipts/:reference`
- `POST /webhooks/paystack`

## Multi-Tenancy Enforcement
- Every `User`, `Category`, and `Item` belongs to exactly one `Restaurant`.
- Authenticated user includes `restaurantId`.
- Category and Item queries always filter by the authenticated user restaurant.
- Item creation/update validates category ownership by restaurant.
- Cross-tenant reads/writes are blocked by backend checks.

## Manual QA Checklist (Sprint 1)
1. Register a new restaurant from `/register`.
2. Confirm redirect to dashboard after successful registration.
3. Refresh dashboard page and confirm session remains authenticated.
4. Logout and confirm dashboard route redirects to login.
5. Login again from `/login`.
6. Create multiple categories.
7. Edit a category name/sort order.
8. Delete a category.
9. Create item with valid category and non-negative price.
10. Edit item name/description/price/category.
11. Toggle item availability.
12. Delete item.
13. Attempt protected endpoint without token and verify `401`.
14. Attempt login with wrong password and verify `401`.
15. Attempt register with invalid email or short password and verify validation error.
16. (Tenant isolation) Create two restaurants and verify one cannot read/update/delete the other's categories/items.
17. Verify Restaurant A categories/items are never visible while logged in as Restaurant B.
18. Verify cross-tenant PATCH/DELETE requests fail (404/403) and do not mutate data.

## Manual QA Checklist (Sprint 4 Realtime)
1. Open two dashboard sessions for the same restaurant and navigate both to `Live Orders`.
2. Complete a successful payment for a new order and verify both sessions receive `order:paid` instantly.
3. Attempt invalid transition (`PENDING_PAYMENT -> ACCEPTED`) and verify API rejects it.
4. Run valid transitions (`PAID -> ACCEPTED -> PREPARING -> READY -> COMPLETED`) and verify updates broadcast in both sessions.
5. Attempt status update on another restaurant's order and verify request fails (404/403).
6. Filter `GET /orders` by status and confirm only requested statuses are returned.

## Deployment Verification Checklist
1. Open frontend on Vercel and register/login.
2. Create categories/items in dashboard.
3. Open public restaurant page and create an order.
4. Initialize Paystack and complete test payment.
5. Confirm Render receives webhook (`/webhooks/paystack`) and order moves to `PAID`.
6. Confirm Live Orders dashboard updates in realtime via Socket.IO.
7. Confirm callback redirects to receipt and `/receipt/:reference` loads.
8. Confirm Resend email includes receipt link to Vercel domain.
9. Confirm stale pending orders auto-transition to `EXPIRED` after configured threshold.

## Notes
- Passwords are hashed with `bcryptjs`.
- Access tokens are sent in `Authorization: Bearer <token>`.
- Refresh tokens are set in `httpOnly` cookie and used to restore auth after refresh.
