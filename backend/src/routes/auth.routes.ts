import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export function createAuthRoutes(): Router {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', authRateLimiter, validateBody(loginSchema), async (req: Request, res: Response, next) => {
    try {
      const { email, password } = req.body;

      const userRes = await db.query(
        'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (userRes.rows.length === 0) {
        res.status(401).json({
          error: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = userRes.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        res.status(401).json({
          error: 'Invalid email or password.',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // If user is a worker, get their workerId and did
      let workerId: string | undefined;
      let did: string | undefined;
      if (user.role === 'WORKER') {
        const workerRes = await db.query(
          'SELECT id, did FROM worker_profiles WHERE user_id = $1',
          [user.id]
        );
        if (workerRes.rows.length > 0) {
          workerId = workerRes.rows[0].id;
          did = workerRes.rows[0].did;
        }
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        workerId,
      });

      // Record audit event
      await db.query(
        `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `aud_${Date.now()}`,
          user.id,
          'USER_LOGIN',
          'USER',
          user.id,
          `User ${user.email} (${user.role}) logged in successfully.`,
        ]
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workerId,
          did,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticateToken, async (req: Request, res: Response, next) => {
    try {
      const userRes = await db.query(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
        [req.user!.userId]
      );

      if (userRes.rows.length === 0) {
        res.status(404).json({
          error: 'User not found.',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = userRes.rows[0];
      let worker: any = null;

      if (user.role === 'WORKER') {
        const workerRes = await db.query(
          'SELECT * FROM worker_profiles WHERE user_id = $1',
          [user.id]
        );
        worker = workerRes.rows[0] || null;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
        },
        worker,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', authenticateToken, async (req: Request, res: Response, next) => {
    try {
      if (req.user) {
        await db.query(
          `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `aud_${Date.now()}`,
            req.user.userId,
            'USER_LOGOUT',
            'USER',
            req.user.userId,
            `User ${req.user.email} logged out.`,
          ]
        );
      }

      res.json({
        message: 'Successfully logged out.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
