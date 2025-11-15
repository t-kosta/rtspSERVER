import { ChildProcess, spawn } from 'child_process';
import Database from '../db/database';
import path from 'path';

interface StreamMapping {
    inputStreamId: number;
    inputUrl: string;
    slotPosition: number;
    gridRows: number;
    gridCols: number;
}

interface OutputStreamConfig {
    id: number;
    name: string;
    outputPort: number;
    resolution: string;
    framerate: number;
    bitrate: string;
    mappings: StreamMapping[];
}

class StreamManager {
    private static instance: StreamManager;
    private activeStreams: Map<number, ChildProcess> = new Map();
    private basePort: number = 8554;

    private constructor() {
        this.basePort = parseInt(process.env.RTSP_OUTPUT_BASE_PORT || '8554');
    }

    public static getInstance(): StreamManager {
        if (!StreamManager.instance) {
            StreamManager.instance = new StreamManager();
        }
        return StreamManager.instance;
    }

    public async startOutputStream(outputStreamId: number): Promise<void> {
        const db = Database.getInstance();

        try {
            // Get output stream configuration
            const streamResult = await db.query(
                `SELECT os.*, lt.grid_rows, lt.grid_cols
                 FROM output_streams os
                 JOIN layout_templates lt ON os.layout_template_id = lt.id
                 WHERE os.id = $1`,
                [outputStreamId]
            );

            if (streamResult.rows.length === 0) {
                throw new Error('Output stream not found');
            }

            const stream = streamResult.rows[0];

            // Get stream mappings
            const mappingsResult = await db.query(
                `SELECT sm.input_stream_id, sm.slot_position, ist.rtsp_url, ist.username, ist.password
                 FROM stream_mappings sm
                 JOIN input_streams ist ON sm.input_stream_id = ist.id
                 WHERE sm.output_stream_id = $1
                 ORDER BY sm.slot_position`,
                [outputStreamId]
            );

            if (mappingsResult.rows.length === 0) {
                throw new Error('No input streams mapped to this output');
            }

            const config: OutputStreamConfig = {
                id: outputStreamId,
                name: stream.name,
                outputPort: stream.output_port || this.getNextAvailablePort(),
                resolution: stream.resolution,
                framerate: stream.framerate,
                bitrate: stream.bitrate,
                mappings: mappingsResult.rows.map(row => ({
                    inputStreamId: row.input_stream_id,
                    inputUrl: this.buildRtspUrl(row.rtsp_url, row.username, row.password),
                    slotPosition: row.slot_position,
                    gridRows: stream.grid_rows,
                    gridCols: stream.grid_cols,
                })),
            };

            // Stop existing stream if running
            if (this.activeStreams.has(outputStreamId)) {
                await this.stopOutputStream(outputStreamId);
            }

            // Build FFmpeg command
            const ffmpegProcess = this.buildFFmpegProcess(config);

            // Store process
            this.activeStreams.set(outputStreamId, ffmpegProcess);

            // Update stream status
            const outputUrl = `rtsp://localhost:${config.outputPort}/${config.name}`;
            await db.query(
                `UPDATE output_streams SET status = $1, output_port = $2, output_url = $3, updated_at = NOW()
                 WHERE id = $4`,
                ['running', config.outputPort, outputUrl, outputStreamId]
            );

            console.log(`Started output stream ${outputStreamId} on port ${config.outputPort}`);
        } catch (error) {
            console.error(`Failed to start output stream ${outputStreamId}:`, error);
            await db.query(
                `UPDATE output_streams SET status = $1, last_error = $2, updated_at = NOW()
                 WHERE id = $3`,
                ['error', (error as Error).message, outputStreamId]
            );
            throw error;
        }
    }

    public async stopOutputStream(outputStreamId: number): Promise<void> {
        const process = this.activeStreams.get(outputStreamId);

        if (process) {
            process.kill('SIGTERM');
            this.activeStreams.delete(outputStreamId);

            const db = Database.getInstance();
            await db.query(
                `UPDATE output_streams SET status = $1, updated_at = NOW()
                 WHERE id = $2`,
                ['stopped', outputStreamId]
            );

            console.log(`Stopped output stream ${outputStreamId}`);
        }
    }

    public async stopAllStreams(): Promise<void> {
        const promises = Array.from(this.activeStreams.keys()).map(id =>
            this.stopOutputStream(id)
        );
        await Promise.all(promises);
    }

    private buildFFmpegProcess(config: OutputStreamConfig): ChildProcess {
        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        const args: string[] = [];

        // Input streams
        config.mappings.forEach(mapping => {
            args.push(
                '-rtsp_transport', 'tcp',
                '-i', mapping.inputUrl
            );
        });

        // Build filter complex for grid layout
        const filterComplex = this.buildFilterComplex(config);

        args.push(
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-b:v', config.bitrate,
            '-r', config.framerate.toString(),
            '-s', config.resolution,
            '-f', 'rtsp',
            '-rtsp_transport', 'tcp',
            `rtsp://localhost:${config.outputPort}/${config.name}`
        );

        const process = spawn(ffmpegPath, args);

        process.stdout.on('data', (data) => {
            console.log(`FFmpeg [${config.id}]: ${data}`);
        });

        process.stderr.on('data', (data) => {
            console.error(`FFmpeg Error [${config.id}]: ${data}`);
        });

        process.on('close', (code) => {
            console.log(`FFmpeg process [${config.id}] exited with code ${code}`);
            this.activeStreams.delete(config.id);
        });

        return process;
    }

    private buildFilterComplex(config: OutputStreamConfig): string {
        const { mappings, resolution } = config;
        const [width, height] = resolution.split('x').map(Number);

        if (mappings.length === 0) {
            throw new Error('No input streams provided');
        }

        // Get grid dimensions from first mapping
        const gridRows = mappings[0].gridRows;
        const gridCols = mappings[0].gridCols;
        const cellWidth = Math.floor(width / gridCols);
        const cellHeight = Math.floor(height / gridRows);

        let filter = '';

        // Scale each input to fit in grid cell
        mappings.forEach((mapping, index) => {
            filter += `[${index}:v]scale=${cellWidth}:${cellHeight},setsar=1[v${index}];`;
        });

        // Build xstack layout
        const layoutPositions: string[] = [];
        mappings.forEach((mapping) => {
            const row = Math.floor(mapping.slotPosition / gridCols);
            const col = mapping.slotPosition % gridCols;
            const x = col * cellWidth;
            const y = row * cellHeight;
            layoutPositions.push(`${x}_${y}`);
        });

        const inputLabels = mappings.map((_, i) => `[v${i}]`).join('');
        filter += `${inputLabels}xstack=inputs=${mappings.length}:layout=${layoutPositions.join('|')}[out]`;

        return filter;
    }

    private buildRtspUrl(baseUrl: string, username?: string, password?: string): string {
        if (!username || !password) {
            return baseUrl;
        }

        const url = new URL(baseUrl);
        url.username = username;
        url.password = password;
        return url.toString();
    }

    private getNextAvailablePort(): number {
        const usedPorts = Array.from(this.activeStreams.values()).map(
            (_, id) => this.basePort + id
        );

        for (let i = 0; i < 1000; i++) {
            const port = this.basePort + i;
            if (!usedPorts.includes(port)) {
                return port;
            }
        }

        throw new Error('No available ports for output stream');
    }

    public getActiveStreams(): number[] {
        return Array.from(this.activeStreams.keys());
    }
}

export default StreamManager;
