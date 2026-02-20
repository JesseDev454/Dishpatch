# Dishpatch - Sprint 1

Dishpatch is a multi-tenant Food Ordering and Restaurant Management SaaS for restaurants in Nigeria.

Sprint 1 delivers:
- Restaurant registration and login
- Protected dashboard
- Tenant-scoped category CRUD
- Tenant-scoped item CRUD with availability toggle
- Clear inline errors and success/error toast alerts in UI

## Tech Stack
- Backend: Node.js, Express, TypeORM, MySQL
- Frontend: React, Vite, TypeScript
- Auth: JWT access token + refresh token (refresh token in secure `httpOnly` cookie)

## Project Structure
- `backend` - API, auth, entities, migrations
- `frontend` - web app (register/login/dashboard)

## Prerequisites
- Node.js 20+
- npm 10+
- MySQL 8+

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
2. Ensure MySQL test server is available (default test config: `localhost:3307`).
3. Run backend tests:
   ```bash
   npm run test:backend
   ```

Notes:
- Tests run with `NODE_ENV=test`.
- Test DB defaults to `dishpatch_test` (never the dev DB).
- Schema is created automatically before tests by running TypeORM migrations in Jest global setup.
- Each test starts from a clean DB state (tables truncated in FK-safe order).
- DB config supports both `DB_USER` and `DB_USERNAME`.

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
3. Paystack redirects to `/payment/callback` with `reference`.
4. The callback page calls `/public/payments/paystack/verify` and shows status.
5. For webhook testing, register `POST /webhooks/paystack` in Paystack dashboard and confirm signature verification.

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
4. Create MySQL database:
   ```sql
   CREATE DATABASE dishpatch;
   ```
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
- `FRONTEND_URL` (default `http://localhost:5173`)
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_USERNAME` (optional alternative to `DB_USER`)
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES` (default `15m`)
- `JWT_REFRESH_EXPIRES` (default `7d`)

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

## Notes
- Passwords are hashed with `bcryptjs`.
- Access tokens are sent in `Authorization: Bearer <token>`.
- Refresh tokens are set in `httpOnly` cookie and used to restore auth after refresh.
