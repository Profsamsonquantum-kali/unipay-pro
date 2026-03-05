-- Create database
CREATE DATABASE IF NOT EXISTS mpesa_monetization;
USE mpesa_monetization;

-- User earnings table
CREATE TABLE IF NOT EXISTS user_earnings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Weekly earnings summary
CREATE TABLE IF NOT EXISTS weekly_earnings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_events INT NOT NULL DEFAULT 0,
    unique_users INT NOT NULL DEFAULT 0,
    paid_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    payment_ref VARCHAR(100),
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_week (week_start, week_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- M-Pesa transactions log
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    mpesa_receipt VARCHAR(100),
    response_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User activity log
CREATE TABLE IF NOT EXISTS user_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON,
    page_url TEXT,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create weekly earnings record for current week
INSERT INTO weekly_earnings (week_start, week_end)
VALUES (
    DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
    DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
) ON DUPLICATE KEY UPDATE id = id;