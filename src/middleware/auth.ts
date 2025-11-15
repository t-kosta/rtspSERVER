import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Database from '../db/database';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

export const authenticateToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    try {
        const secret = process.env.JWT_SECRET || 'default-secret';
        const decoded = jwt.verify(token, secret) as any;

        const db = Database.getInstance();
        const result = await db.query(
            'SELECT id, email, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            res.status(403).json({ error: 'Invalid or inactive user' });
            return;
        }

        req.user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            role: result.rows[0].role,
        };

        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
};

export const auditLog = async (
    userId: number | undefined,
    action: string,
    resourceType: string,
    resourceId: number | null,
    details: any,
    ipAddress: string
): Promise<void> => {
    try {
        const db = Database.getInstance();
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId || null, action, resourceType, resourceId, JSON.stringify(details), ipAddress]
        );
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};
