# FlowBoard API — 3-Day Development Plan

> Stack: Node.js 22+ · TypeScript (strict) · Express · Prisma · PostgreSQL 16 · Redis 7 · Docker Compose · Nginx
> Starting point: empty repo — no starter fork. All scaffolding must be created.

---

## Overview

| Day | Theme | Sessions | Commits |
|---|---|---|---|
| [Day 1](./day-1.md) | Scaffold + Foundation | Docker stack, AppError, typed routes | `day-01`, `day-02` |
| [Day 2](./day-2.md) | Data Layer + Auth | Prisma schema, CRUD, JWT auth | `day-03`, `day-04`, `week-01 complete` |
| [Day 3](./day-3.md) | Production Layer | Redis, Worker, security hardening, health checks | `day-06`, `day-07`, `day-08`, `week-03 complete` |

---

## Target Commit History

```
day-01: environment setup, AppError, global error handler
day-02: typed task routes with Zod validation
day-03: prisma schema, migration, seed data
day-04: boards CRUD, full route layer
week-01 complete: API, auth foundation, Prisma schema
day-06: Redis client, rate limiter middleware
day-07: refresh token rotation, logout endpoint
day-08: Redis Stream events, worker consumer, AuditLog integration
week-03 complete: OWASP hardening, production patterns, Security Gate ready
```

---

## Quick Reference

| Service | Port | Purpose |
|---|---|---|
| api | 3000 | Express HTTP server |
| worker | — | Redis Stream consumer |
| db | 5432 | PostgreSQL 16 |
| redis | 6379 | Rate limiting, token store, event stream |
| nginx | 80 | Reverse proxy → api |

| Key path | What lives there |
|---|---|
| `api/src/errors/AppError.ts` | Custom error class + global error handler |
| `api/src/middleware/authenticate.ts` | JWT verification middleware |
| `api/src/middleware/rateLimiter.ts` | Redis-backed rate limiter (fail-open) |
| `api/src/lib/events.ts` | `publishTaskEvent` → Redis Stream |
| `worker/src/index.ts` | XREADGROUP consumer loop |
| `worker/src/handlers/` | AuditLog writers per event type |

---

*FlowBoard · Node.js Engineering Program Part 2 · Stratpoint Internal Training 2025*
