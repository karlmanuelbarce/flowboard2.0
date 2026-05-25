import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import redis from '../lib/redis';

const WINDOW_SECONDS = 900;
const LIMIT = 10;

export async function rateLimiter(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip ?? 'unknown';
    const key = `rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (count > LIMIT) {
      return next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
    }
    next();
  } catch {
    console.warn('Rate limiter Redis error — failing open');
    next();
  }
}
