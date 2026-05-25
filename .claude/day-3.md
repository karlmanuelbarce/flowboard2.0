# Day 3 — Production Layer: Redis, Worker, Security Hardening, Observability

**Goal:** Redis live (rate limiting + refresh token rotation), Worker consuming Redis Streams and writing AuditLog rows, security middleware stack applied, Pino logging with redaction, health/readiness endpoints returning correct status.

---

## Session 7 — Redis: Rate Limiter + Refresh Token Rotation (≈100 min)

**Objective:** Auth endpoints are rate-limited; refresh tokens stored in Redis; rotation and logout implemented; replay attack blocked.

### Tasks

- [ ] **7.1** Create `api/src/lib/redis.ts`:
  ```ts
  import Redis from 'ioredis';
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number(process.env.REDIS_PORT) ?? 6379,
  });
  redis.on('error', (err) => console.error('Redis error:', err));
  export default redis;
  ```

- [ ] **7.2** Create `api/src/middleware/rateLimiter.ts`:
  - Key: `rate:<ip>`; window: 15 min (`WINDOW_SECONDS = 900`); limit: 10 requests
  - `redis.incr(key)` → set `redis.expire(key, WINDOW_SECONDS)` only when count === 1 (first hit)
  - Over limit → `AppError 429 RATE_LIMIT_EXCEEDED`
  - **Fail-open:** wrap all Redis logic in try/catch — if Redis is down, log a warning and call `next()` (never block traffic on Redis failure)

- [ ] **7.3** Apply `rateLimiter` **only** to `POST /auth/login` and `POST /auth/register`

- [ ] **7.4** Update `POST /auth/register` and `POST /auth/login` to store refresh token in Redis:
  - Generate `tokenId = uuid()`
  - Sign refresh token JWT with payload `{ userId, tokenId }` and `JWT_REFRESH_SECRET`
  - Store: `redis.set('refresh:<userId>:<tokenId>', '1', 'EX', 7 * 24 * 60 * 60)`

- [ ] **7.5** Implement `POST /auth/refresh` in auth router:
  - Validate body: `{ refreshToken: z.string() }`
  - `jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!)` — invalid → `AppError 401 INVALID_TOKEN`
  - `await redis.exists('refresh:<userId>:<tokenId>')` → 0 means missing or already used → `AppError 401 TOKEN_REUSED`
  - `await redis.del(oldKey)` — invalidate immediately (before issuing new tokens)
  - Generate new `accessToken` (15m) + new `refreshToken` with fresh `tokenId = uuid()`
  - Store new refresh token in Redis with 7-day TTL
  - Return `{ success: true, data: { accessToken, refreshToken } }`

- [ ] **7.6** Implement `POST /auth/logout` in auth router:
  - Validate body: `{ refreshToken: z.string() }`
  - Verify JWT, extract `userId` + `tokenId`, `redis.del(key)` — best-effort (return 204 even if key is already gone)
  - Return 204 No Content

- [ ] **7.7** Test replay attack: use same refresh token twice → second call must return 401

- [ ] **7.8** Verify Redis state:
  ```bash
  docker compose exec redis redis-cli KEYS "refresh:*"
  docker compose exec redis redis-cli TTL "refresh:<userId>:<tokenId>"
  # Should show ~604800
  ```

**Commit:** `git commit -m "day-06: Redis client, rate limiter middleware"`
Then: `git commit -m "day-07: refresh token rotation, logout endpoint"`

---

## Session 8 — Background Worker: Redis Streams + AuditLog + DLQ (≈100 min)

**Objective:** Task mutations publish events to Redis Stream; Worker container consumes them, writes AuditLog rows, handles retries and dead-letter.

### Tasks

**API side**

- [ ] **8.1** Create `api/src/lib/events.ts`:
  ```ts
  import redis from './redis';

  interface TaskEvent {
    taskId: string;
    action: 'CREATED' | 'UPDATED' | 'DELETED';
    userId: string;
    payload: Record<string, unknown>;
  }

  export const publishTaskEvent = async (event: TaskEvent): Promise<void> => {
    await redis.xadd(
      'tasks:events', '*',
      'action',  event.action,
      'taskId',  event.taskId,
      'userId',  event.userId,
      'payload', JSON.stringify(event.payload),
      'ts',      Date.now().toString()
    );
  };
  ```

- [ ] **8.2** Call `publishTaskEvent` after each successful task mutation in task route handlers:
  - After `prisma.task.create` → action `CREATED`
  - After `prisma.task.update` → action `UPDATED`
  - After `prisma.task.delete` → action `DELETED`

- [ ] **8.3** Verify events reach the stream:
  ```bash
  docker compose exec redis redis-cli XLEN tasks:events
  ```

**Worker side**

- [ ] **8.4** Create `worker/src/lib/prisma.ts` and `worker/src/lib/redis.ts` — same singleton pattern as API

- [ ] **8.5** Create event handlers:
  - `worker/src/handlers/taskCreated.ts` — `prisma.auditLog.create({ data: { userId, action: 'CREATED', entity: 'Task', entityId: taskId } })`
  - `worker/src/handlers/taskUpdated.ts` — same with `action: 'UPDATED'`
  - `worker/src/handlers/taskDeleted.ts` — same with `action: 'DELETED'`

- [ ] **8.6** Create `worker/src/index.ts` — consumer loop:
  - On startup: `XGROUP CREATE tasks:events audit-group $ MKSTREAM` — catch and ignore `BUSYGROUP` error (group already exists)
  - Loop indefinitely: `XREADGROUP GROUP audit-group worker-1 COUNT 10 BLOCK 5000 STREAMS tasks:events >`
  - For each message: parse fields, dispatch to correct handler
  - On success: `XACK tasks:events audit-group <messageId>`
  - On handler error: increment `redis.hincrby('retry:<messageId>', 'count', 1)`:
    - Count < 3 → log and leave in pending (will be re-read on next loop)
    - Count >= 3 → move to DLQ:
      ```
      XADD tasks:events:dlq * originalId <id> action <action> taskId <taskId> error <message> failedAt <now>
      ```
      Then `XACK` the original and `redis.del('retry:<messageId>')`

- [ ] **8.7** Rebuild and restart worker: `docker compose up -d --build worker`
  Check logs: `docker compose logs -f worker` — confirm stream connection and group creation

- [ ] **8.8** End-to-end test: create a task via API, then verify AuditLog row in DB:
  ```bash
  docker compose exec db psql -U flowboard -c 'SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 5;'
  ```

- [ ] **8.9** Verify consumer group exists:
  ```bash
  docker compose exec redis redis-cli XINFO GROUPS tasks:events
  ```

**Commit:** `git commit -m "day-08: Redis Stream events, worker consumer, AuditLog integration"`

---

## Session 9 — Security Hardening, Pino Logging, Health Checks (≈80 min)

**Objective:** Security middleware stack applied, structured logging with redaction, ownership enforced on all mutations, health/readiness endpoints working and tested.

### Tasks

- [ ] **9.1** Apply security middleware in `app.ts` — add before route mounts, in this order:
  ```ts
  app.use(helmet())
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  }))
  app.use(express.json({ limit: '10kb' }))
  app.set('trust proxy', 1)
  ```

- [ ] **9.2** Create `api/src/lib/logger.ts`:
  ```ts
  import pino from 'pino';
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', 'body.password', 'body.token'],
    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  });
  export default logger;
  ```

- [ ] **9.3** Add `pino-http` middleware in `app.ts` (after helmet/cors, before routes):
  ```ts
  import pinoHttp from 'pino-http';
  app.use(pinoHttp({ logger }))
  ```

- [ ] **9.4** Replace all `console.log` / `console.error` calls in `api/src/` with `logger.info` / `logger.error`

- [ ] **9.5** Enforce ownership checks on task and board mutations:
  - `PATCH /tasks/:id` and `DELETE /tasks/:id`:
    - Fetch task first; if `task.ownerId !== req.user!.id` → `AppError 403 FORBIDDEN`
  - `GET /boards/:id` and `DELETE /boards/:id`:
    - Same pattern on `board.ownerId`

- [ ] **9.6** Confirm `globalErrorHandler` hides stack traces when `NODE_ENV === 'production'`

- [ ] **9.7** Create `api/src/routes/health.ts`:
  - `GET /health` → `{ status: 'ok', uptime: process.uptime() }` — pure liveness, no DB or Redis calls
  - `GET /ready`:
    ```ts
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ready', db: 'ok', redis: 'ok' });
    // catch → next(new AppError('Service not ready', 503, 'NOT_READY'))
    ```

- [ ] **9.8** Mount health router in `app.ts` at `/` with **no** `authenticate` middleware

- [ ] **9.9** Test `/ready` resilience:
  ```bash
  docker compose stop redis
  curl http://localhost/api/ready   # expect 503
  docker compose start redis
  curl http://localhost/api/ready   # expect 200
  ```

- [ ] **9.10** Verify Helmet headers in Postman: confirm `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN` in any response

- [ ] **9.11** Verify log redaction: make a login request, check API logs — `authorization` value must not appear in plain text:
  ```bash
  docker compose logs api | grep authorization
  ```

- [ ] **9.12** Test ownership enforcement: with User A's token, try `PATCH` on User B's task → confirm 403

- [ ] **9.13** Run final typecheck: `docker compose exec api npx tsc --noEmit` — zero errors

**Commit:** `git commit -m "week-03 complete: OWASP hardening, production patterns, Security Gate ready"`

---

## End-of-Day 3 Verification

| Check | Command |
|---|---|
| TypeScript clean | `docker compose exec api npx tsc --noEmit` |
| All 5 services up | `docker compose ps` |
| Migration applied | `docker compose exec api npx prisma migrate status` |
| Stream receiving events | `docker compose exec redis redis-cli XLEN tasks:events` |
| Consumer group exists | `docker compose exec redis redis-cli XINFO GROUPS tasks:events` |
| Refresh token in Redis | `docker compose exec redis redis-cli KEYS "refresh:*"` |
| AuditLog rows in DB | `docker compose exec db psql -U flowboard -c 'SELECT * FROM "AuditLog" LIMIT 5;'` |
| Health endpoint | `curl http://localhost/api/health` |
| Readiness endpoint | `curl http://localhost/api/ready` |
| Rate limit triggers | 11 POSTs to `/auth/login` → request 11 returns 429 |
| Replay attack blocked | Use same refresh token twice → second returns 401 |
| Ownership enforced | PATCH another user's task → returns 403 |
| No stack in prod | `NODE_ENV=production` + trigger error → no stack in response body |
| Logs redacted | Login request → authorization not visible in API logs |
