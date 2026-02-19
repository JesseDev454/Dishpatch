# Dishpatch - Sprint 1

Dishpatch is a multi-tenant Food Ordering and Restaurant Management SaaS for restaurants in Nigeria.

Sprint 1 delivers:
- Restaurant registration and login
- Protected dashboard
- Tenant-scoped category CRUD
- Tenant-scoped item CRUD with availability toggle

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

## Manual Test Checklist
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

## Notes
- Passwords are hashed with `bcryptjs`.
- Access tokens are sent in `Authorization: Bearer <token>`.
- Refresh tokens are set in `httpOnly` cookie and used to restore auth after refresh.
