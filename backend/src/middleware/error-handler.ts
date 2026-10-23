import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Structured logging
  console.error(`[API Error] ${req.method} ${req.url}:`, {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Unique constraint violation in PostgreSQL is code '23505'
  if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('already exists')) {
    res.status(409).json({
      error: 'Conflict: Unique constraint violation (record already exists or duplicate key)',
      code: 'DUPLICATE_KEY',
      details: err.detail || err.message,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Foreign key violation
  if (err.code === '23503') {
    res.status(400).json({
      error: 'Foreign key constraint violated: referenced entity does not exist.',
      code: 'FOREIGN_KEY_VIOLATION',
      details: err.detail,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
}
