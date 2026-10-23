import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { parsePagination } from '../utils/pagination.js';

export function createAuditRoutes(): Router {
  const router = Router();

  // GET /api/audit (List immutable audit logs with pagination and filtering)
  router.get('/', authenticateToken, async (req: Request, res: Response, next) => {
    try {
      const { page, limit, offset, sortBy, sortOrder } = parsePagination(
        req.query,
        'created_at',
        ['created_at', 'action', 'entity_type']
      );

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      // If user is a worker, they can only view audit events related to their user ID
      if (req.user!.role === 'WORKER') {
        conditions.push(`a.user_id = $${paramIdx++}`);
        params.push(req.user!.userId);
      } else if (req.query.userId) {
        conditions.push(`a.user_id = $${paramIdx++}`);
        params.push(req.query.userId);
      }

      if (req.query.action) {
        conditions.push(`a.action = $${paramIdx++}`);
        params.push(req.query.action);
      }

      if (req.query.entityType) {
        conditions.push(`a.entity_type = $${paramIdx++}`);
        params.push(req.query.entityType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM audit_events a ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await db.query(
        `SELECT a.*, u.email as user_email, u.role as user_role
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.user_id
         ${whereClause}
         ORDER BY a.${sortBy} ${sortOrder}
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset]
      );

      res.json({
        events: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        total,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
