import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

import Database from './db/database';
import WebSocketService from './services/WebSocketService';
import StreamManager from './services/StreamManager';

import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import streamsRoutes from './routes/streams.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
});

app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/streams', streamsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Dashboard stats
app.get('/api/stats', async (req, res) => {
    try {
        const db = Database.getInstance();

        const [users, inputStreams, outputStreams, activeStreams] = await Promise.all([
            db.query('SELECT COUNT(*) FROM users'),
            db.query('SELECT COUNT(*) FROM input_streams'),
            db.query('SELECT COUNT(*) FROM output_streams'),
            db.query("SELECT COUNT(*) FROM output_streams WHERE status = 'running'"),
        ]);

        res.json({
            totalUsers: parseInt(users.rows[0].count),
            totalInputStreams: parseInt(inputStreams.rows[0].count),
            totalOutputStreams: parseInt(outputStreams.rows[0].count),
            activeStreams: parseInt(activeStreams.rows[0].count),
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Initialize and start server
async function startServer() {
    try {
        // Initialize database
        console.log('Initializing database...');
        const db = Database.getInstance();
        await db.initialize();
        console.log('Database initialized');

        // Create HTTP server
        const server = createServer(app);

        // Initialize WebSocket service
        const wsService = WebSocketService.getInstance();
        wsService.initialize(server);

        // Start server
        server.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         RTSP Relay Server                                 ║
║                                                           ║
║  Server running on port ${PORT}                             ║
║  API: http://localhost:${PORT}/api                          ║
║  WebSocket: ws://localhost:${PORT}/ws                       ║
║                                                           ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
            `);
        });

        // Graceful shutdown
        const shutdown = async () => {
            console.log('\nShutting down gracefully...');

            // Stop all streams
            const streamManager = StreamManager.getInstance();
            await streamManager.stopAllStreams();

            // Close database connection
            await db.close();

            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
