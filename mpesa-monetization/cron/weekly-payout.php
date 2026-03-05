<?php
// This file should be run every Monday at 00:01 via cron job
// crontab: 1 0 * * 1 /usr/bin/php /path/to/mpesa-monetization/cron/weekly-payout.php

require_once '../config/database.php';
require_once '../api/safaricom-api.php';

// Get last week's earnings
$last_week_start = date('Y-m-d', strtotime('last monday'));
$last_week_end = date('Y-m-d', strtotime('last sunday'));

try {
    $pdo->beginTransaction();
    
    // Check if already paid
    $stmt = $pdo->prepare("
        SELECT * FROM weekly_earnings 
        WHERE week_start = ? AND week_end = ? AND paid_status = 'pending'
    ");
    $stmt->execute([$last_week_start, $last_week_end]);
    $weekData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$weekData) {
        echo "No pending payments for week $last_week_start to $last_week_end\n";
        exit;
    }
    
    $amount = $weekData['total_earnings'];
    
    if ($amount <= 0) {
        echo "No earnings for this week\n";
        // Mark as paid even if zero
        $stmt = $pdo->prepare("
            UPDATE weekly_earnings 
            SET paid_status = 'paid', paid_at = NOW() 
            WHERE week_start = ? AND week_end = ?
        ");
        $stmt->execute([$last_week_start, $last_week_end]);
        exit;
    }
    
    echo "Processing weekly payout of KES " . ($amount * 130) . " ($$amount USD) to +254115097754\n";
    
    // Convert USD to KES (assuming 1 USD = 130 KES)
    $kesAmount = round($amount * 130);
    
    // Initialize M-Pesa API
    $mpesa = new SafaricomAPI();
    
    // Send money to your M-Pesa
    $result = $mpesa->b2cPayment(YOUR_MPESA_NUMBER, $kesAmount, "Weekly earnings payout");
    
    if ($result['success']) {
        // Update payment status
        $stmt = $pdo->prepare("
            UPDATE weekly_earnings 
            SET paid_status = 'paid', 
                payment_ref = ?, 
                paid_at = NOW() 
            WHERE week_start = ? AND week_end = ?
        ");
        $stmt->execute([$result['reference'], $last_week_start, $last_week_end]);
        
        // Log transaction
        $stmt = $pdo->prepare("
            INSERT INTO mpesa_transactions (transaction_type, amount, phone_number, reference, status, mpesa_receipt, response_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'B2C',
            $kesAmount,
            YOUR_MPESA_NUMBER,
            $result['reference'],
            'completed',
            $result['receipt'] ?? null,
            json_encode($result)
        ]);
        
        echo "✅ Payment successful! KES $kesAmount sent to +254115097754\n";
        echo "Reference: " . $result['reference'] . "\n";
        
        // Send SMS notification (optional)
        sendSmsNotification($kesAmount, $result['reference']);
        
    } else {
        // Mark as failed
        $stmt = $pdo->prepare("
            UPDATE weekly_earnings 
            SET paid_status = 'failed' 
            WHERE week_start = ? AND week_end = ?
        ");
        $stmt->execute([$last_week_start, $last_week_end]);
        
        echo "❌ Payment failed: " . $result['error'] . "\n";
    }
    
    $pdo->commit();
    
} catch (Exception $e) {
    $pdo->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}

// Optional: Send SMS notification (requires Africa's Talking or similar)
function sendSmsNotification($amount, $reference) {
    // You can integrate with Africa's Talking API here
    // For now, just log it
    echo "SMS notification: KES $amount sent to +254115097754 (Ref: $reference)\n";
}
?>