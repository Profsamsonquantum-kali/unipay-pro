#!/bin/bash
# Add to crontab: crontab -e
# Add this line:
# 1 0 * * 1 /usr/bin/php /var/www/html/mpesa-monetization/cron/weekly-payout.php >> /var/www/html/mpesa-monetization/logs/payout.log 2>&1

echo "Setting up weekly cron job for M-Pesa payouts..."
echo "This will run every Monday at 00:01 AM"

# Create logs directory
mkdir -p ../logs

# Add to crontab
(crontab -l 2>/dev/null; echo "1 0 * * 1 /usr/bin/php $(pwd)/weekly-payout.php >> $(pwd)/../logs/payout.log 2>&1") | crontab -

echo "✅ Cron job installed successfully!"
echo "You will receive payments every Monday at 00:01 AM to +254115097754"