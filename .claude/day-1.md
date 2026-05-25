# Day 1 — Scaffold Everything: Docker Stack, Project Structure, Error Handling, Typed Routes

**Goal:** All five Docker services running, project scaffolded with correct file layout, TypeScript compiles clean, AppError + global error handler wired in, typed task route stubs committed.

---

## Session 1 — Full Project Scaffold (≈2 hrs)

**Objective:** Create every file Docker and TypeScript need to build and run the stack before writing a single line of application code.

### Directory structure to create

```
flowboard2.0/
├── api/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── errors/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── lib/
│   ├── prisma/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.test.yml
├── .env.example
└── ai-context
```

### Tasks

- [ ] **1.1** Create `api/package.json`:
  ```json
  {
    "name": "flowboard-api",
    "version": "1.0.0",
    "scripts": {
      "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
      "build": "tsc",
      "start": "node dist/server.js",
      "typecheck": "tsc --noEmit",
      "test": "jest --runInBand",
      "test:coverage": "jest --coverage --runInBand"
    },
    "dependencies": {
      "@prisma/client": "^5.0.0",
      "bcrypt": "^5.0.0",
      "cors": "^2.8.5",
      "express": "^4.18.0",
      "helmet": "^7.0.0",
      "ioredis": "^5.0.0",
      "jsonwebtoken": "^9.0.0",
      "pino": "^8.0.0",
      "pino-http": "^9.0.0",
      "uuid": "^9.0.0",
      "zod": "^3.0.0"
    },
    "devDependencies": {
      "@types/bcrypt": "^5.0.0",
      "@types/cors": "^2.8.0",
      "@types/express": "^4.17.0",
      "@types/jest": "^29.0.0",
      "@types/jsonwebtoken": "^9.0.0",
      "@types/node": "^22.0.0",
      "@types/supertest": "^6.0.0",
      "@types/uuid": "^9.0.0",
      "jest": "^29.0.0",
      "pino-pretty": "^10.0.0",
      "prisma": "^5.0.0",
      "supertest": "^6.0.0",
      "ts-jest": "^29.0.0",
      "ts-node-dev": "^2.0.0",
      "typescript": "^5.0.0"
    }
  }
  ```

- [ ] **1.2** Create `api/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "lib": ["ES2022"],
      "outDir": "dist",
      "rootDir": "src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests"]
  }
  ```

- [ ] **1.3** Create `api/jest.config.ts`:
  ```ts
  export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
    coverageThreshold: { global: { lines: 80, branches: 80 } },
  };
  ```

- [ ] **1.4** Create `worker/package.json`:
  ```json
  {
    "name": "flowboard-worker",
    "version": "1.0.0",
    "scripts": {
      "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js"
    },
    "dependencies": {
      "@prisma/client": "^5.0.0",
      "ioredis": "^5.0.0",
      "pino": "^8.0.0"
    },
    "devDependencies": {
      "@types/node": "^22.0.0",
      "prisma": "^5.0.0",
      "ts-node-dev": "^2.0.0",
      "typescript": "^5.0.0"
    }
  }
  ```

- [ ] **1.5** Create `worker/tsconfig.json` (same shape as api, `rootDir: "src"`)

- [ ] **1.6** Create `api/Dockerfile`:
  ```dockerfile
  FROM node:22-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  RUN npx prisma generate
  EXPOSE 3000
  CMD ["npm", "run", "dev"]
  ```

- [ ] **1.7** Create `worker/Dockerfile`:
  ```dockerfile
  FROM node:22-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  CMD ["npm", "run", "dev"]
  ```

- [ ] **1.8** Create `nginx/nginx.conf`:
  ```nginx
  events {}
  http {
    server {
      listen 80;
      location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      }
    }
  }
  ```

- [ ] **1.9** Create `docker-compose.yml`:
  ```yaml
  services:
    api:
      build: ./api
      ports:
        - "3000:3000"
      environment:
        DATABASE_URL: ${DATABASE_URL}
        REDIS_HOST: redis
        REDIS_PORT: 6379
        JWT_SECRET: ${JWT_SECRET}
        JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
        ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
        NODE_ENV: ${NODE_ENV:-development}
        LOG_LEVEL: ${LOG_LEVEL:-info}
      volumes:
        - ./api:/app
        - /app/node_modules
      depends_on:
        - db
        - redis
      networks:
        - flowboard

    worker:
      build: ./worker
      environment:
        DATABASE_URL: ${DATABASE_URL}
        REDIS_HOST: redis
        REDIS_PORT: 6379
        NODE_ENV: ${NODE_ENV:-development}
      volumes:
        - ./worker:/app
        - /app/node_modules
      depends_on:
        - db
        - redis
      networks:
        - flowboard

    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: ${POSTGRES_USER:-flowboard}
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-flowboard}
        POSTGRES_DB: ${POSTGRES_DB:-flowboard}
      ports:
        - "5432:5432"
      volumes:
        - pgdata:/var/lib/postgresql/data
      networks:
        - flowboard

    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"
      networks:
        - flowboard

    nginx:
      image: nginx:alpine
      ports:
        - "80:80"
      volumes:
        - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      depends_on:
        - api
      networks:
        - flowboard

  volumes:
    pgdata:

  networks:
    flowboard:
  ```

- [ ] **1.10** Create `docker-compose.test.yml`:
  ```yaml
  services:
    api:
      environment:
        DATABASE_URL: postgresql://flowboard:flowboard@db:5432/flowboard_test
        NODE_ENV: test
    db:
      environment:
        POSTGRES_DB: flowboard_test
  ```

- [ ] **1.11** Create `.env.example`:
  ```
  DATABASE_URL=postgresql://flowboard:flowboard@db:5432/flowboard
  POSTGRES_USER=flowboard
  POSTGRES_PASSWORD=flowboard
  POSTGRES_DB=flowboard
  REDIS_HOST=redis
  REDIS_PORT=6379
  JWT_SECRET=change_me_access_secret
  JWT_REFRESH_SECRET=change_me_refresh_secret
  ALLOWED_ORIGINS=http://localhost:3000
  NODE_ENV=development
  LOG_LEVEL=info
  ```

- [ ] **1.12** Copy `.env.example` → `.env`; fill in real secret values for `JWT_SECRET` and `JWT_REFRESH_SECRET`

- [ ] **1.13** Create placeholder entry files so Docker builds succeed:
  - `api/src/server.ts` — `import express from 'express'; const app = express(); app.listen(3000);`
  - `worker/src/index.ts` — `console.log('worker starting');`

- [ ] **1.14** Run `docker compose up -d` — verify all 5 services are `Up` with `docker compose ps`
- [ ] **1.15** Tail API logs: `docker compose logs -f api` — fix any build or startup errors

**Verify:** `docker compose ps` shows all 5 services. `docker compose exec api npx tsc --noEmit` passes.

---

## Session 2 — AppError, Global Error Handler, Express App Skeleton (≈90 min)

**Objective:** Replace the placeholder `server.ts` with a real Express app skeleton and establish the error-handling backbone.

### Tasks

- [ ] **2.1** Create `api/src/errors/AppError.ts`:
  - Class extends `Error`, constructor: `message: string`, `statusCode: number`, `code?: string`
  - Set `this.name = 'AppError'`; `Object.setPrototypeOf(this, AppError.prototype)` (fixes `instanceof` after transpile)
  - Export `isAppError(err: unknown): err is AppError` type guard
  - Export `globalErrorHandler` Express middleware:
    - `ZodError` → 422 with formatted issues array
    - `AppError` → correct status + `{ success: false, message, code }`
    - Prisma `P2025` (not found) → 404
    - Prisma `P2002` (unique constraint) → 409
    - Anything else in production → `{ success: false, message: 'Internal server error' }` (no stack)
    - Anything else in dev → include `message` and `stack`

- [ ] **2.2** Create `api/src/types/express.d.ts` — extend `Request` with `user?: { id: string; email: string }`:
  ```ts
  declare namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
  ```

- [ ] **2.3** Create `api/src/app.ts`:
  - Mount `express.json({ limit: '10kb' })`
  - Export `app` — no `listen` call here
  - Wire `globalErrorHandler` as **last** middleware

- [ ] **2.4** Rewrite `api/src/server.ts`:
  - Import `app` from `./app`
  - Call `app.listen(3000, () => console.log('API running on :3000'))`

- [ ] **2.5** Create the AI context file at repo root (`ai-context`):
  ```
  # FlowBoard AI Context

  ## Stack
  - Node.js 22, TypeScript 5 strict mode
  - Express 4, Prisma 5 (PostgreSQL 16), Redis 7 (ioredis 5)
  - Zod 3 for all request validation
  - Pino for structured logging
  - Jest + Supertest for integration tests
  - Docker Compose orchestrates all services

  ## Project Structure
  - api/src/app.ts           — Express app setup, middleware, route mounting
  - api/src/server.ts        — app.listen only
  - api/src/routes/          — auth.ts, boards.ts, tasks.ts, health.ts
  - api/src/middleware/      — authenticate.ts, rateLimiter.ts
  - api/src/lib/             — prisma.ts, redis.ts, logger.ts, events.ts
  - api/src/errors/          — AppError.ts (class + globalErrorHandler)
  - worker/src/index.ts      — Redis Stream consumer loop
  - worker/src/handlers/     — taskCreated.ts, taskUpdated.ts, taskDeleted.ts

  ## Error Handling
  - All async route handlers use try/catch
  - Errors passed to next(err) — never res.send() in catch blocks
  - HTTP errors use AppError class (src/errors/AppError.ts)
  - ZodError → 422, AppError → statusCode, Prisma P2025 → 404, P2002 → 409

  ## TypeScript Rules
  - Strict mode on — no implicit any
  - All function parameters and return types annotated
  - Prefer interfaces for object shapes, type aliases for unions/intersections

  ## Response Format
  - Success: { success: true, data: ... }
  - Error: { success: false, message: '...', code: '...' }

  ## Security Rules
  - Never spread req.body directly into Prisma — always use Zod-parsed values
  - All route IDs validated as UUID via Zod
  - No stack traces in error responses when NODE_ENV=production
  - Passwords and tokens must be redacted in log output

  ## Dead-Letter Queue
  - Key: tasks:events:dlq
  - Format: XADD tasks:events:dlq * originalId <id> action <action> taskId <taskId> error <message> failedAt <timestamp>
  - Messages moved here after 3 failed processing attempts
  ```

- [ ] **2.6** Restart API container: `docker compose restart api`
- [ ] **2.7** Test error handler: temporarily throw `new Error('test')` in a route → confirm no stack trace when `NODE_ENV=production`

**Commit:** `git commit -m "day-01: environment setup, AppError, global error handler"`

---

## Session 3 — Typed Task Routes + Zod Schemas (≈90 min)

**Objective:** Four typed task route handlers with Zod validation, mounted and reachable — no implicit `any`.

### Tasks

- [ ] **3.1** Create `api/src/routes/tasks.ts`:
  - Define schemas:
    - `TaskIdParam` → `z.object({ id: z.string().uuid() })`
    - `CreateTaskSchema` → `title` (string 1–255), `description` (string optional), `priority` (`LOW|MEDIUM|HIGH`, default `MEDIUM`), `boardId` (UUID)
    - `UpdateTaskSchema` → same fields as Create but all optional (`.partial()`)
  - Typed handlers using `Request<z.infer<typeof TaskIdParam>>` etc.:
    - `GET /tasks/:id` → stub 404 (`// TODO: Prisma on Day 2`)
    - `POST /tasks` → validate body, return stub 201
    - `PATCH /tasks/:id` → validate param + partial body, stub 200
    - `DELETE /tasks/:id` → validate param, stub 204
  - All catch blocks call `next(err)` — no `res.status().json()` in catch

- [ ] **3.2** Mount tasks router in `app.ts` under `/tasks`

- [ ] **3.3** Run `docker compose exec api npx tsc --noEmit` — zero errors required

- [ ] **3.4** Test in Postman:
  - `POST /tasks` with missing `title` → confirm 422 with Zod error details
  - `GET /tasks/not-a-uuid` → confirm 422 (UUID validation)
  - `GET /tasks/<valid-uuid>` → confirm stub 404

**Commit:** `git commit -m "day-02: typed task routes with Zod validation"`
