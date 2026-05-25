# Day 2 — Data Layer: Prisma, Full CRUD, Authentication

**Goal:** Prisma schema live in PostgreSQL, all CRUD routes wired to real DB calls, JWT auth in place with a working authenticate middleware protecting all board and task routes.

---

## Session 4 — Prisma Schema, Migration, and Seed (≈90 min)

**Objective:** Full data model in PostgreSQL; typed Prisma Client generated; seed data loads without errors.

### Tasks

- [ ] **4.1** Create `api/prisma/schema.prisma`:
  ```prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  model User {
    id        String     @id @default(uuid())
    email     String     @unique
    password  String
    createdAt DateTime   @default(now())
    boards    Board[]
    tasks     Task[]
    auditLogs AuditLog[]
  }

  model Board {
    id        String   @id @default(uuid())
    name      String
    ownerId   String
    owner     User     @relation(fields: [ownerId], references: [id])
    tasks     Task[]
    createdAt DateTime @default(now())
  }

  model Task {
    id          String     @id @default(uuid())
    title       String
    description String?
    status      TaskStatus @default(TODO)
    priority    Priority   @default(MEDIUM)
    boardId     String
    board       Board      @relation(fields: [boardId], references: [id])
    ownerId     String
    owner       User       @relation(fields: [ownerId], references: [id])
    createdAt   DateTime   @default(now())
    updatedAt   DateTime   @updatedAt
  }

  model AuditLog {
    id        String   @id @default(uuid())
    userId    String
    user      User     @relation(fields: [userId], references: [id])
    action    String
    entity    String
    entityId  String
    createdAt DateTime @default(now())
  }

  enum TaskStatus { TODO IN_PROGRESS REVIEW DONE }
  enum Priority   { LOW MEDIUM HIGH }
  ```

  > `Task` has an explicit `ownerId → User` relation (not in the handbook schema). Required for ownership checks on Day 3.

- [ ] **4.2** Run migration: `docker compose exec api npx prisma migrate dev --name init`
- [ ] **4.3** Generate client: `docker compose exec api npx prisma generate`
- [ ] **4.4** Create `api/prisma/seed.ts`:
  - Hash password with bcrypt cost 12
  - `prisma.user.upsert` on `dev@flowboard.test` (safe to run multiple times)
  - Create 2 boards and 3 tasks only if they don't already exist
- [ ] **4.5** Add seed script to `package.json`: `"seed": "ts-node prisma/seed.ts"`
- [ ] **4.6** Run: `docker compose exec api npm run seed`
- [ ] **4.7** Verify in Prisma Studio or psql: all records present
  ```bash
  docker compose exec db psql -U flowboard -c 'SELECT * FROM "User";'
  ```

**Verify:** `docker compose exec api npx prisma migrate status` shows no pending migrations.

**Commit:** `git commit -m "day-03: prisma schema, migration, seed data"`

---

## Session 5 — Wire Prisma into Task + Board Routes (≈90 min)

**Objective:** Replace all stubs with real Prisma calls; boards CRUD added; all routes testable in Postman.

### Tasks

- [ ] **5.1** Create `api/src/lib/prisma.ts` — singleton `PrismaClient` export:
  ```ts
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  export default prisma;
  ```

- [ ] **5.2** Replace task route stubs with real Prisma calls:
  - `GET /tasks/:id` → `prisma.task.findUnique`; `null` → `AppError 404 TASK_NOT_FOUND`
  - `POST /tasks` → `prisma.task.create`; include `ownerId: req.user!.id` (stub until Session 6 wires auth)
  - `PATCH /tasks/:id` → `prisma.task.update`; catch Prisma `P2025` error code → rethrow as `AppError 404`
  - `DELETE /tasks/:id` → `prisma.task.delete`; return 204; catch `P2025` → `AppError 404`

- [ ] **5.3** Create `api/src/routes/boards.ts` with full CRUD:
  - `CreateBoardSchema` → `name` (string 1–100)
  - `BoardIdParam` → UUID
  - `GET /boards` → list boards where `ownerId === req.user!.id`
  - `POST /boards` → `prisma.board.create` with `ownerId`
  - `GET /boards/:id` → findUnique; 404 if null
  - `DELETE /boards/:id` → check `ownerId !== req.user!.id` → `AppError 403 FORBIDDEN`; then delete

- [ ] **5.4** Mount boards router in `app.ts` under `/boards`

- [ ] **5.5** Test all eight routes in Postman — confirm correct status codes and `{ success, data }` response shapes

- [ ] **5.6** Run `docker compose exec api npx tsc --noEmit` — zero errors

**Commit:** `git commit -m "day-04: boards CRUD, full route layer"`

---

## Session 6 — Auth: Register, Login, JWT Middleware, Protect Routes (≈90 min)

**Objective:** Users can register and log in; all board/task routes require a valid JWT; ownership is wired to the real user.

### Tasks

- [ ] **6.1** Create `api/src/routes/auth.ts`:
  - `RegisterSchema` → `email` (Zod `.email()`), `password` (`.min(8)`)
  - `POST /auth/register`:
    - Validate body; `bcrypt.hash(password, 12)`
    - `prisma.user.create`; catch Prisma `P2002` → `AppError 409 EMAIL_IN_USE`
    - Sign `accessToken` (`15m`) with `JWT_SECRET` and `refreshToken` (`7d`) with `JWT_REFRESH_SECRET`
    - Return `{ success: true, data: { accessToken, refreshToken } }`
    - Note: Redis token storage added in Day 3 Session 7
  - `POST /auth/login`:
    - Find user by email; `null` → `AppError 401 INVALID_CREDENTIALS`
    - `bcrypt.compare`; mismatch → `AppError 401 INVALID_CREDENTIALS`
    - Return same token pair

- [ ] **6.2** Create `api/src/middleware/authenticate.ts`:
  - Extract `Bearer <token>` from `Authorization` header; missing → `AppError 401 MISSING_TOKEN`
  - `jwt.verify(token, process.env.JWT_SECRET!)`; catch any error → `AppError 401 INVALID_TOKEN`
  - Attach `req.user = { id, email }` from verified JWT payload

- [ ] **6.3** Apply `authenticate` middleware to all board and task routes in `app.ts`

- [ ] **6.4** Mount auth router in `app.ts` under `/auth` — **no** `authenticate` on this router

- [ ] **6.5** Update task and board handlers — replace any hardcoded `ownerId` stubs with `req.user!.id`

- [ ] **6.6** Test the auth flow end-to-end in Postman:
  - `POST /auth/register` → get tokens
  - `GET /boards` without token → 401
  - `GET /boards` with token → 200

**Commit:** `git commit -m "week-01 complete: API, auth foundation, Prisma schema"`
