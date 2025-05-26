-- MySQL initialization script for Proxy Stone
-- This script runs automatically when the MySQL container starts

USE proxy_stone;

-- Create tables for proxy stone
CREATE TABLE IF NOT EXISTS proxy_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    status_code INT,
    response_time_ms INT,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_status_code (status_code),
    INDEX idx_cache_hit (cache_hit)
);

CREATE TABLE IF NOT EXISTS cache_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_data LONGTEXT,
    headers JSON,
    status_code INT,
    ttl INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS health_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status ENUM('healthy', 'unhealthy', 'degraded') NOT NULL,
    response_time_ms INT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_service_name (service_name),
    INDEX idx_created_at (created_at)
);

-- Insert initial data
INSERT IGNORE INTO health_checks (service_name, status, response_time_ms, details) 
VALUES ('mysql', 'healthy', 0, '{"message": "Database initialized successfully"}'); 