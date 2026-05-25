import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

function isPrismaError(err: unknown): err is { code: string; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (isPrismaError(err)) {
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Resource already exists', code: 'CONFLICT' });
      return;
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    success: false,
    message: isDev && err instanceof Error ? err.message : 'Internal server error',
    ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
  });
}
