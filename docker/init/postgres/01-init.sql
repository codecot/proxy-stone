-- PostgreSQL initialization script for Proxy Stone
-- This script runs automatically when the PostgreSQL container starts

\c proxy_stone;

-- Create tables for proxy stone
CREATE TABLE IF NOT EXISTS proxy_requests (
    id BIGSERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proxy_requests_created_at ON proxy_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_proxy_requests_status_code ON proxy_requests (status_code);
CREATE INDEX IF NOT EXISTS idx_proxy_requests_cache_hit ON proxy_requests (cache_hit);

CREATE TABLE IF NOT EXISTS cache_entries (
    id BIGSERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_data TEXT,
    headers JSONB,
    status_code INTEGER,
    ttl INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_cache_key ON cache_entries (cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries (expires_at);

CREATE TABLE IF NOT EXISTS health_checks (
    id BIGSERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded')),
    response_time_ms INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service_name ON health_checks (service_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_created_at ON health_checks (created_at);

-- Insert initial data
INSERT INTO health_checks (service_name, status, response_time_ms, details) 
VALUES ('postgresql', 'healthy', 0, '{"message": "Database initialized successfully"}')
ON CONFLICT DO NOTHING; 