<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'mpesa_monetization');
define('DB_USER', 'root');
define('DB_PASS', '');

// M-Pesa Configuration
define('MPESA_SHORTCODE', '174379'); // Your Paybill/Till number
define('MPESA_PASSKEY', 'tfyg'); // Get from Safaricom
define('MPESA_CONSUMER_KEY', 'OTBcP6nBahQ0bkNoAejWseGsj0AG610pNRgzm93O5Vuw6nGe'); // From Safaricom
define('MPESA_CONSUMER_SECRET', 'tYbL0s8fF58HQ6W7BK1wmyrOfgzl6l7Pbpqsrqem6ayldquodOTT9ZxZ0GDg03Ar'); // From Safaricom
define('MPESA_ENV', 'sandbox'); // 'sandbox' or 'production'

// Your M-Pesa number for payouts
define('YOUR_MPESA_NUMBER', '254115097754');

// Database connection
try {
    $pdo = new PDO(
        "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch(PDOException $e) {
    die(json_encode(['success' => false, 'error' => 'Database connection failed']));
}
?>
