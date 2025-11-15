import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from '../db/database';
import { validate, schemas } from '../middleware/validation';
import { authenticateToken, AuthRequest, auditLog } from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', validate(schemas.register), async (req: Request, res: Response): Promise<void> => {
    const { email, password, fullName, role } = req.body;

    try {
        const db = Database.getInstance();

        // Check if user exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at`,
            [email, passwordHash, fullName, role || 'viewer']
        );

        const user = result.rows[0];

        await auditLog(user.id, 'USER_CREATED', 'user', user.id, { email }, req.ip || '');

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Login
router.post('/login', validate(schemas.login), async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
        const db = Database.getInstance();

        // Get user
        const result = await db.query(
            'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = result.rows[0];

        if (!user.is_active) {
            res.status(403).json({ error: 'Account is disabled' });
            return;
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate JWT
        const secret = process.env.JWT_SECRET || 'default-secret';
        const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, secret, {
            expiresIn,
        });

        await auditLog(user.id, 'USER_LOGIN', 'user', user.id, { email }, req.ip || '');

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = Database.getInstance();
        const result = await db.query(
            'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
            [req.user?.id]
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
            createdAt: user.created_at,
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

export default router;
