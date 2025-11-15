-- RTSP Relay Server Database Schema

-- Users table with role-based access
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Input RTSP streams
CREATE TABLE IF NOT EXISTS input_streams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rtsp_url TEXT NOT NULL,
    username VARCHAR(255),
    password VARCHAR(255),
    status VARCHAR(50) DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    last_error TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Layout templates (2x2, 3x3, etc.)
CREATE TABLE IF NOT EXISTS layout_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    grid_rows INTEGER NOT NULL,
    grid_cols INTEGER NOT NULL,
    total_slots INTEGER GENERATED ALWAYS AS (grid_rows * grid_cols) STORED,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Output RTSP streams with layouts
CREATE TABLE IF NOT EXISTS output_streams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    layout_template_id INTEGER REFERENCES layout_templates(id) ON DELETE CASCADE,
    output_port INTEGER UNIQUE,
    output_url TEXT,
    resolution VARCHAR(50) DEFAULT '1920x1080',
    framerate INTEGER DEFAULT 25,
    bitrate VARCHAR(50) DEFAULT '2000k',
    status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'error')),
    last_error TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mapping of input streams to output stream slots
CREATE TABLE IF NOT EXISTS stream_mappings (
    id SERIAL PRIMARY KEY,
    output_stream_id INTEGER REFERENCES output_streams(id) ON DELETE CASCADE,
    input_stream_id INTEGER REFERENCES input_streams(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(output_stream_id, slot_position)
);

-- User sessions for tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_input_streams_status ON input_streams(status);
CREATE INDEX IF NOT EXISTS idx_output_streams_status ON output_streams(status);
CREATE INDEX IF NOT EXISTS idx_stream_mappings_output ON stream_mappings(output_stream_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Insert default layout templates
INSERT INTO layout_templates (name, grid_rows, grid_cols, description) VALUES
    ('Single', 1, 1, 'Single stream full screen'),
    ('2x2 Grid', 2, 2, '4 streams in a 2x2 grid'),
    ('3x3 Grid', 3, 3, '9 streams in a 3x3 grid'),
    ('4x4 Grid', 4, 4, '16 streams in a 4x4 grid'),
    ('1+5', 2, 3, '1 large stream with 5 smaller streams'),
    ('2x4 Grid', 2, 4, '8 streams in a 2x4 grid'),
    ('3x4 Grid', 3, 4, '12 streams in a 3x4 grid')
ON CONFLICT DO NOTHING;
