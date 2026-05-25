import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Missing token', 401, 'MISSING_TOKEN'));
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string };
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
}
