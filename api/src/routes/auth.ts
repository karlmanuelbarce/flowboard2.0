import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import prisma from '../lib/prisma';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = RegisterSchema;

function signTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' },
  );
  return { accessToken, refreshToken };
}

router.post(
  '/register',
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
      const tokens = signTokens(user.id, user.email);
      res.status(201).json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = LoginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      const match = await bcrypt.compare(password, user.password);
      if (!match) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      const tokens = signTokens(user.id, user.email);
      res.json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
