import WebSocket from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import Database from '../db/database';

interface AuthenticatedWebSocket extends WebSocket {
    userId?: number;
    userRole?: string;
}

class WebSocketService {
    private static instance: WebSocketService;
    private wss: WebSocket.Server | null = null;
    private clients: Set<AuthenticatedWebSocket> = new Set();

    private constructor() {}

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    public initialize(server: Server): void {
        this.wss = new WebSocket.Server({ server, path: '/ws' });

        this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
            console.log('New WebSocket connection');

            // Authenticate using token from query string
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const token = url.searchParams.get('token');

            if (!token) {
                ws.close(1008, 'Authentication required');
                return;
            }

            try {
                const secret = process.env.JWT_SECRET || 'default-secret';
                const decoded = jwt.verify(token, secret) as any;

                const db = Database.getInstance();
                const result = await db.query(
                    'SELECT id, role, is_active FROM users WHERE id = $1',
                    [decoded.userId]
                );

                if (result.rows.length === 0 || !result.rows[0].is_active) {
                    ws.close(1008, 'Invalid user');
                    return;
                }

                ws.userId = result.rows[0].id;
                ws.userRole = result.rows[0].role;
                this.clients.add(ws);

                ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));

                ws.on('message', (message: string) => {
                    this.handleMessage(ws, message);
                });

                ws.on('close', () => {
                    this.clients.delete(ws);
                    console.log('WebSocket connection closed');
                });

                ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    this.clients.delete(ws);
                });
            } catch (error) {
                console.error('WebSocket authentication error:', error);
                ws.close(1008, 'Authentication failed');
            }
        });

        // Start monitoring stream status
        this.startStreamMonitoring();

        console.log('WebSocket service initialized');
    }

    private handleMessage(ws: AuthenticatedWebSocket, message: string): void {
        try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'subscribe':
                    // Handle subscription to specific streams
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    public broadcast(message: any): void {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    public broadcastToRole(role: string, message: any): void {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.userRole === role) {
                client.send(messageStr);
            }
        });
    }

    private async startStreamMonitoring(): Promise<void> {
        // Monitor stream status every 5 seconds
        setInterval(async () => {
            try {
                const db = Database.getInstance();

                // Get input stream statuses
                const inputStreams = await db.query(
                    'SELECT id, name, status, last_error FROM input_streams'
                );

                // Get output stream statuses
                const outputStreams = await db.query(
                    'SELECT id, name, status, last_error, output_url FROM output_streams'
                );

                this.broadcast({
                    type: 'stream_status',
                    data: {
                        inputStreams: inputStreams.rows,
                        outputStreams: outputStreams.rows,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error('Stream monitoring error:', error);
            }
        }, 5000);
    }

    public notifyStreamEvent(eventType: string, streamType: 'input' | 'output', streamId: number, data: any): void {
        this.broadcast({
            type: 'stream_event',
            eventType,
            streamType,
            streamId,
            data,
            timestamp: new Date().toISOString(),
        });
    }
}

export default WebSocketService;
