import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import redis from '../lib/redis';
import prisma from '../lib/prisma';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const REFRESH_TTL = 7 * 24 * 60 * 60;

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = RegisterSchema;

const RefreshSchema = z.object({ refreshToken: z.string() });
const LogoutSchema = z.object({ refreshToken: z.string() });

interface RefreshPayload {
  userId: string;
  tokenId: string;
}

function signTokens(userId: string, email: string): { accessToken: string; refreshToken: string; tokenId: string } {
  const tokenId = uuidv4();
  const accessToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { userId, tokenId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' },
  );
  return { accessToken, refreshToken, tokenId };
}

async function storeRefreshToken(userId: string, tokenId: string): Promise<void> {
  await redis.set(`refresh:${userId}:${tokenId}`, '1', 'EX', REFRESH_TTL);
}

router.post(
  '/register',
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = RegisterSchema.parse(req.body);
      const hashed = await bcrypt.hash(password, 12);
      let user;
      try {
        user = await prisma.user.create({ data: { email, password: hashed } });
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
          throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');
        }
        throw err;
      }
      const { accessToken, refreshToken, tokenId } = signTokens(user.id, user.email);
      await storeRefreshToken(user.id, tokenId);
      res.status(201).json({ success: true, data: { accessToken, refreshToken } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = LoginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      const match = await bcrypt.compare(password, user.password);
      if (!match) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      const { accessToken, refreshToken, tokenId } = signTokens(user.id, user.email);
      await storeRefreshToken(user.id, tokenId);
      res.json({ success: true, data: { accessToken, refreshToken } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = RefreshSchema.parse(req.body);
      let payload: RefreshPayload;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as RefreshPayload;
      } catch {
        throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
      }
      const { userId, tokenId } = payload;
      const key = `refresh:${userId}:${tokenId}`;
      const exists = await redis.exists(key);
      if (!exists) throw new AppError('Token reused or expired', 401, 'TOKEN_REUSED');
      await redis.del(key);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('Invalid token', 401, 'INVALID_TOKEN');

      const { accessToken, refreshToken: newRefreshToken, tokenId: newTokenId } = signTokens(user.id, user.email);
      await storeRefreshToken(user.id, newTokenId);
      res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = LogoutSchema.parse(req.body);
      try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as RefreshPayload;
        await redis.del(`refresh:${payload.userId}:${payload.tokenId}`);
      } catch {
        // best-effort — still return 204
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
