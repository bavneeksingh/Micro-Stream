import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthUser {
  userId: string;
  email: string;
  role: 'WORKER' | 'LENDER' | 'ADMIN';
  workerId?: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      error: 'Authentication token required. Please log in.',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
      code: 'TOKEN_INVALID',
      timestamp: new Date().toISOString(),
    });
  }
}

export function requireRole(allowedRoles: ('WORKER' | 'LENDER' | 'ADMIN')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles.`,
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

export function requireWorker(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required.',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.user.role !== 'WORKER' || !req.user.workerId) {
    res.status(403).json({
      error: 'Forbidden: Endpoint only accessible to verified gig workers.',
      code: 'WORKER_REQUIRED',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
