import { Router, Response } from 'express';
import Database from '../db/database';
import { authenticateToken, requireRole, AuthRequest, auditLog } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';
import StreamManager from '../services/StreamManager';

const router = Router();

// ===== INPUT STREAMS =====

// Get all input streams
router.get('/input', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT ist.*, u.full_name as created_by_name
             FROM input_streams ist
             LEFT JOIN users u ON ist.created_by = u.id
             ORDER BY ist.created_at DESC`
        );

        res.json({
            streams: result.rows.map(stream => ({
                id: stream.id,
                name: stream.name,
                rtspUrl: stream.rtsp_url,
                status: stream.status,
                lastError: stream.last_error,
                createdBy: stream.created_by_name,
                createdAt: stream.created_at,
                updatedAt: stream.updated_at,
            })),
        });
    } catch (error) {
        console.error('Get input streams error:', error);
        res.status(500).json({ error: 'Failed to get input streams' });
    }
});

// Create input stream
router.post('/input', authenticateToken, requireRole('admin', 'manager'), validate(schemas.createInputStream), async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, rtspUrl, username, password } = req.body;

    try {
        const db = Database.getInstance();
        const result = await db.query(
            `INSERT INTO input_streams (name, rtsp_url, username, password, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, rtsp_url, status, created_at`,
            [name, rtspUrl, username || null, password || null, req.user?.id]
        );

        const stream = result.rows[0];

        await auditLog(req.user?.id, 'INPUT_STREAM_CREATED', 'input_stream', stream.id, { name, rtspUrl }, req.ip || '');

        res.status(201).json({
            id: stream.id,
            name: stream.name,
            rtspUrl: stream.rtsp_url,
            status: stream.status,
            createdAt: stream.created_at,
        });
    } catch (error) {
        console.error('Create input stream error:', error);
        res.status(500).json({ error: 'Failed to create input stream' });
    }
});

// Delete input stream
router.delete('/input/:id', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    const streamId = parseInt(req.params.id);

    try {
        const db = Database.getInstance();
        const result = await db.query('DELETE FROM input_streams WHERE id = $1 RETURNING id', [streamId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Input stream not found' });
            return;
        }

        await auditLog(req.user?.id, 'INPUT_STREAM_DELETED', 'input_stream', streamId, {}, req.ip || '');

        res.json({ message: 'Input stream deleted successfully' });
    } catch (error) {
        console.error('Delete input stream error:', error);
        res.status(500).json({ error: 'Failed to delete input stream' });
    }
});

// ===== OUTPUT STREAMS =====

// Get all output streams
router.get('/output', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT os.*, lt.name as layout_name, lt.grid_rows, lt.grid_cols,
                    u.full_name as created_by_name
             FROM output_streams os
             JOIN layout_templates lt ON os.layout_template_id = lt.id
             LEFT JOIN users u ON os.created_by = u.id
             ORDER BY os.created_at DESC`
        );

        res.json({
            streams: result.rows.map(stream => ({
                id: stream.id,
                name: stream.name,
                layoutName: stream.layout_name,
                gridRows: stream.grid_rows,
                gridCols: stream.grid_cols,
                outputPort: stream.output_port,
                outputUrl: stream.output_url,
                resolution: stream.resolution,
                framerate: stream.framerate,
                bitrate: stream.bitrate,
                status: stream.status,
                lastError: stream.last_error,
                createdBy: stream.created_by_name,
                createdAt: stream.created_at,
                updatedAt: stream.updated_at,
            })),
        });
    } catch (error) {
        console.error('Get output streams error:', error);
        res.status(500).json({ error: 'Failed to get output streams' });
    }
});

// Create output stream
router.post('/output', authenticateToken, requireRole('admin', 'manager'), validate(schemas.createOutputStream), async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, layoutTemplateId, resolution, framerate, bitrate } = req.body;

    try {
        const db = Database.getInstance();
        const result = await db.query(
            `INSERT INTO output_streams (name, layout_template_id, resolution, framerate, bitrate, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, resolution, framerate, bitrate, status, created_at`,
            [name, layoutTemplateId, resolution || '1920x1080', framerate || 25, bitrate || '2000k', req.user?.id]
        );

        const stream = result.rows[0];

        await auditLog(req.user?.id, 'OUTPUT_STREAM_CREATED', 'output_stream', stream.id, req.body, req.ip || '');

        res.status(201).json({
            id: stream.id,
            name: stream.name,
            resolution: stream.resolution,
            framerate: stream.framerate,
            bitrate: stream.bitrate,
            status: stream.status,
            createdAt: stream.created_at,
        });
    } catch (error) {
        console.error('Create output stream error:', error);
        res.status(500).json({ error: 'Failed to create output stream' });
    }
});

// Start output stream
router.post('/output/:id/start', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    const streamId = parseInt(req.params.id);

    try {
        const streamManager = StreamManager.getInstance();
        await streamManager.startOutputStream(streamId);

        await auditLog(req.user?.id, 'OUTPUT_STREAM_STARTED', 'output_stream', streamId, {}, req.ip || '');

        res.json({ message: 'Output stream started successfully' });
    } catch (error) {
        console.error('Start output stream error:', error);
        res.status(500).json({ error: (error as Error).message || 'Failed to start output stream' });
    }
});

// Stop output stream
router.post('/output/:id/stop', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    const streamId = parseInt(req.params.id);

    try {
        const streamManager = StreamManager.getInstance();
        await streamManager.stopOutputStream(streamId);

        await auditLog(req.user?.id, 'OUTPUT_STREAM_STOPPED', 'output_stream', streamId, {}, req.ip || '');

        res.json({ message: 'Output stream stopped successfully' });
    } catch (error) {
        console.error('Stop output stream error:', error);
        res.status(500).json({ error: 'Failed to stop output stream' });
    }
});

// Delete output stream
router.delete('/output/:id', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    const streamId = parseInt(req.params.id);

    try {
        // Stop stream if running
        const streamManager = StreamManager.getInstance();
        await streamManager.stopOutputStream(streamId);

        const db = Database.getInstance();
        const result = await db.query('DELETE FROM output_streams WHERE id = $1 RETURNING id', [streamId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Output stream not found' });
            return;
        }

        await auditLog(req.user?.id, 'OUTPUT_STREAM_DELETED', 'output_stream', streamId, {}, req.ip || '');

        res.json({ message: 'Output stream deleted successfully' });
    } catch (error) {
        console.error('Delete output stream error:', error);
        res.status(500).json({ error: 'Failed to delete output stream' });
    }
});

// ===== STREAM MAPPINGS =====

// Get mappings for an output stream
router.get('/output/:id/mappings', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    const outputStreamId = parseInt(req.params.id);

    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT sm.*, ist.name as input_name, ist.rtsp_url
             FROM stream_mappings sm
             JOIN input_streams ist ON sm.input_stream_id = ist.id
             WHERE sm.output_stream_id = $1
             ORDER BY sm.slot_position`,
            [outputStreamId]
        );

        res.json({
            mappings: result.rows.map(mapping => ({
                id: mapping.id,
                inputStreamId: mapping.input_stream_id,
                inputName: mapping.input_name,
                slotPosition: mapping.slot_position,
                createdAt: mapping.created_at,
            })),
        });
    } catch (error) {
        console.error('Get mappings error:', error);
        res.status(500).json({ error: 'Failed to get mappings' });
    }
});

// Create stream mapping
router.post('/mappings', authenticateToken, requireRole('admin', 'manager'), validate(schemas.createMapping), async (req: AuthRequest, res: Response): Promise<void> => {
    const { outputStreamId, inputStreamId, slotPosition } = req.body;

    try {
        const db = Database.getInstance();
        const result = await db.query(
            `INSERT INTO stream_mappings (output_stream_id, input_stream_id, slot_position)
             VALUES ($1, $2, $3)
             RETURNING id, output_stream_id, input_stream_id, slot_position, created_at`,
            [outputStreamId, inputStreamId, slotPosition]
        );

        const mapping = result.rows[0];

        await auditLog(req.user?.id, 'STREAM_MAPPING_CREATED', 'stream_mapping', mapping.id, req.body, req.ip || '');

        res.status(201).json({
            id: mapping.id,
            outputStreamId: mapping.output_stream_id,
            inputStreamId: mapping.input_stream_id,
            slotPosition: mapping.slot_position,
            createdAt: mapping.created_at,
        });
    } catch (error) {
        console.error('Create mapping error:', error);
        res.status(500).json({ error: 'Failed to create mapping' });
    }
});

// Delete stream mapping
router.delete('/mappings/:id', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
    const mappingId = parseInt(req.params.id);

    try {
        const db = Database.getInstance();
        const result = await db.query('DELETE FROM stream_mappings WHERE id = $1 RETURNING id', [mappingId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Mapping not found' });
            return;
        }

        await auditLog(req.user?.id, 'STREAM_MAPPING_DELETED', 'stream_mapping', mappingId, {}, req.ip || '');

        res.json({ message: 'Mapping deleted successfully' });
    } catch (error) {
        console.error('Delete mapping error:', error);
        res.status(500).json({ error: 'Failed to delete mapping' });
    }
});

// ===== LAYOUT TEMPLATES =====

// Get all layout templates
router.get('/layouts', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = Database.getInstance();
        const result = await db.query(
            `SELECT id, name, grid_rows, grid_cols, total_slots, description, created_at
             FROM layout_templates ORDER BY total_slots`
        );

        res.json({
            layouts: result.rows.map(layout => ({
                id: layout.id,
                name: layout.name,
                gridRows: layout.grid_rows,
                gridCols: layout.grid_cols,
                totalSlots: layout.total_slots,
                description: layout.description,
                createdAt: layout.created_at,
            })),
        });
    } catch (error) {
        console.error('Get layouts error:', error);
        res.status(500).json({ error: 'Failed to get layouts' });
    }
});

export default router;
