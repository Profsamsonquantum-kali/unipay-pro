<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>M-Pesa Earnings Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: #0a0a0f;
            color: white;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            background: linear-gradient(135deg, #00ff9d, #00b8ff);
            color: #0a0a0f;
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h1 {
            font-size: 2rem;
        }

        .mpesa-info {
            background: rgba(0,0,0,0.1);
            padding: 15px 25px;
            border-radius: 50px;
            font-size: 1.2rem;
            font-weight: 600;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 25px;
            transition: transform 0.3s;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            border-color: #00ff9d;
        }

        .stat-card h3 {
            color: rgba(255,255,255,0.6);
            font-size: 0.9rem;
            margin-bottom: 10px;
        }

        .stat-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #00ff9d;
        }

        .stat-label {
            color: rgba(255,255,255,0.4);
            font-size: 0.8rem;
            margin-top: 5px;
        }

        .chart-container {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .payout-card {
            background: linear-gradient(135deg, #00ff9d, #00b8ff);
            color: #0a0a0f;
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .payout-info h3 {
            font-size: 1.2rem;
            margin-bottom: 10px;
        }

        .payout-info .phone {
            font-size: 1.5rem;
            font-weight: 700;
        }

        .next-payout {
            background: rgba(0,0,0,0.1);
            padding: 15px 25px;
            border-radius: 50px;
            font-size: 1.2rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            text-align: left;
            padding: 15px;
            color: rgba(255,255,255,0.6);
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        td {
            padding: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .badge {
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .badge.paid {
            background: rgba(0,255,157,0.1);
            color: #00ff9d;
            border: 1px solid #00ff9d;
        }

        .badge.pending {
            background: rgba(255,187,51,0.1);
            color: #ffbb33;
            border: 1px solid #ffbb33;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php
        require_once '../config/database.php';
        
        // Get current week's earnings
        $week_start = date('Y-m-d', strtotime('monday this week'));
        $week_end = date('Y-m-d', strtotime('sunday this week'));
        
        $stmt = $pdo->prepare("
            SELECT * FROM weekly_earnings 
            WHERE week_start = ? AND week_end = ?
        ");
        $stmt->execute([$week_start, $week_end]);
        $currentWeek = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Get all weekly earnings
        $stmt = $pdo->query("
            SELECT * FROM weekly_earnings 
            ORDER BY week_start DESC 
            LIMIT 10
        ");
        $weeklyEarnings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get total all-time earnings
        $stmt = $pdo->query("SELECT SUM(total_earnings) as total FROM weekly_earnings WHERE paid_status = 'paid'");
        $totalEarnings = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
        ?>
        
        <div class="header">
            <div>
                <h1>💰 M-Pesa Earnings Dashboard</h1>
                <p>Your earnings are sent every Monday to your M-Pesa</p>
            </div>
            <div class="mpesa-info">
                <i class="fas fa-mobile-alt"></i> +254 115 097 754
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Current Week</h3>
                <div class="stat-value">$<?php echo number_format($currentWeek['total_earnings'] ?? 0, 2); ?></div>
                <div class="stat-label">KES <?php echo number_format(($currentWeek['total_earnings'] ?? 0) * 130, 2); ?></div>
            </div>
            <div class="stat-card">
                <h3>Total Earnings</h3>
                <div class="stat-value">$<?php echo number_format($totalEarnings, 2); ?></div>
                <div class="stat-label">KES <?php echo number_format($totalEarnings * 130, 2); ?></div>
            </div>
            <div class="stat-card">
                <h3>This Month</h3>
                <div class="stat-value">$<?php echo number_format($totalEarnings * 0.3, 2); ?></div>
                <div class="stat-label">30 days</div>
            </div>
            <div class="stat-card">
                <h3>Avg. Daily</h3>
                <div class="stat-value">$<?php echo number_format(($currentWeek['total_earnings'] ?? 0) / 7, 2); ?></div>
                <div class="stat-label">Per day</div>
            </div>
        </div>
        
        <div class="payout-card">
            <div class="payout-info">
                <h3>⏰ Next Payout</h3>
                <div class="phone">📱 +254 115 097 754</div>
                <div style="margin-top: 10px;">Every Monday at 00:01 AM</div>
            </div>
            <div class="next-payout">
                <?php
                $nextMonday = date('l, F j', strtotime('next monday'));
                echo "Next: $nextMonday";
                ?>
            </div>
        </div>
        
        <div class="chart-container">
            <canvas id="earningsChart"></canvas>
        </div>
        
        <div class="chart-container">
            <h3 style="margin-bottom: 20px;">📊 Weekly Payout History</h3>
            <table>
                <thead>
                    <tr>
                        <th>Week</th>
                        <th>USD</th>
                        <th>KES</th>
                        <th>Events</th>
                        <th>Status</th>
                        <th>Reference</th>
                        <th>Paid Date</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($weeklyEarnings as $week): ?>
                    <tr>
                        <td><?php echo date('M j', strtotime($week['week_start'])) . ' - ' . date('M j', strtotime($week['week_end'])); ?></td>
                        <td style="color: #00ff9d;">$<?php echo number_format($week['total_earnings'], 2); ?></td>
                        <td>KES <?php echo number_format($week['total_earnings'] * 130, 2); ?></td>
                        <td><?php echo $week['total_events']; ?></td>
                        <td>
                            <span class="badge <?php echo $week['paid_status']; ?>">
                                <?php echo ucfirst($week['paid_status']); ?>
                            </span>
                        </td>
                        <td><?php echo $week['payment_ref'] ?? '-'; ?></td>
                        <td><?php echo $week['paid_at'] ? date('M j, Y', strtotime($week['paid_at'])) : '-'; ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const ctx = document.getElementById('earningsChart').getContext('2d');
        
        // Prepare chart data
        const weeks = <?php echo json_encode(array_reverse(array_column($weeklyEarnings, 'week_start'))); ?>;
        const earnings = <?php echo json_encode(array_reverse(array_column($weeklyEarnings, 'total_earnings'))); ?>;
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks.map(w => new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Weekly Earnings (USD)',
                    data: earnings,
                    borderColor: '#00ff9d',
                    backgroundColor: 'rgba(0,255,157,0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: 'white' }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { 
                            color: 'white',
                            callback: v => '$' + v
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'white' }
                    }
                }
            }
        });
    </script>
</body>
</html>