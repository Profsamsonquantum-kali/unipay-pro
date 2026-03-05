<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Invalid data']);
    exit;
}

// Calculate earnings based on event type
function calculateEarnings($event_type) {
    $rates = [
        'page_view' => 0.01,
        'service_access' => 0.05,
        'market_view' => 0.02,
        'balance_view' => 0.01,
        'quick_action' => 0.03,
        'time_spent' => 0.02,
        'user_return' => 0.04,
        'session_end' => 0.10
    ];
    
    // Premium services earn more
    if (isset($data['is_premium']) && $data['is_premium'] == 1) {
        return 0.25;
    }
    
    return $rates[$event_type] ?? 0.01;
}

$earnings = calculateEarnings($data['event_type']);

try {
    $pdo->beginTransaction();
    
    // Insert activity
    $stmt = $pdo->prepare("
        INSERT INTO user_activity (user_id, session_id, event_type, event_data, page_url, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $data['user_id'],
        $data['session_id'],
        $data['event_type'],
        json_encode($data),
        $data['page_url'] ?? null,
        $data['user_agent'] ?? null,
        $_SERVER['REMOTE_ADDR']
    ]);
    
    // Insert earnings
    if ($earnings > 0) {
        $stmt = $pdo->prepare("
            INSERT INTO user_earnings (user_id, session_id, event_type, amount)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$data['user_id'], $data['session_id'], $data['event_type'], $earnings]);
        
        // Update weekly total
        $week_start = date('Y-m-d', strtotime('monday this week'));
        $week_end = date('Y-m-d', strtotime('sunday this week'));
        
        $stmt = $pdo->prepare("
            UPDATE weekly_earnings 
            SET total_earnings = total_earnings + ?,
                total_events = total_events + 1
            WHERE week_start = ? AND week_end = ?
        ");
        $stmt->execute([$earnings, $week_start, $week_end]);
    }
    
    $pdo->commit();
    
    // Get current weekly total
    $stmt = $pdo->prepare("
        SELECT total_earnings FROM weekly_earnings 
        WHERE week_start = ? AND week_end = ?
    ");
    $week_start = date('Y-m-d', strtotime('monday this week'));
    $week_end = date('Y-m-d', strtotime('sunday this week'));
    $stmt->execute([$week_start, $week_end]);
    $weekly = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'earnings' => $earnings,
        'weekly_total' => $weekly['total_earnings'] ?? 0,
        'message' => 'Tracked successfully'
    ]);
    
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>