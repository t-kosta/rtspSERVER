import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import Database from '../db/database';
import { authenticateToken, requireRole, AuthRequest, auditLog } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();

// Get all users (admin/manager only)
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT id, email, full_name, role, is_active, created_at, updated_at
             FROM users ORDER BY created_at DESC`
        );

        res.json({
            users: result.rows.map(user => ({
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                isActive: user.is_active,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
            })),
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id);

    // Users can only view themselves unless they're admin/manager
    if (req.user?.id !== userId && !['admin', 'manager'].includes(req.user?.role || '')) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT id, email, full_name, role, is_active, created_at, updated_at
             FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user (admin only, or self for limited fields)
router.put('/:id', authenticateToken, validate(schemas.updateUser), async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id);
    const { email, fullName, role, isActive } = req.body;

    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id === userId;

    if (!isAdmin && !isSelf) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
    }

    // Non-admins can only update their own name and email
    if (!isAdmin && (role || isActive !== undefined)) {
        res.status(403).json({ error: 'Only admins can change role and status' });
        return;
    }

    try {
        const db = Database.getInstance();
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (email) {
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }
        if (fullName) {
            updates.push(`full_name = $${paramCount++}`);
            values.push(fullName);
        }
        if (role && isAdmin) {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }
        if (isActive !== undefined && isAdmin) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(isActive);
        }

        updates.push('updated_at = NOW()');
        values.push(userId);

        const result = await db.query(
            `UPDATE users SET ${updates.join(', ')}
             WHERE id = $${paramCount}
             RETURNING id, email, full_name, role, is_active`,
            values
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await auditLog(req.user?.id, 'USER_UPDATED', 'user', userId, req.body, req.ip || '');

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            isActive: user.is_active,
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id);

    if (req.user?.id === userId) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
    }

    try {
        const db = Database.getInstance();
        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await auditLog(req.user?.id, 'USER_DELETED', 'user', userId, {}, req.ip || '');

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
