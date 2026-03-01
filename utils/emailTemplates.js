exports.welcomeEmail = (name) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #fff; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 32px; font-weight: 800; }
                .gradient { background: linear-gradient(135deg, #00ff9d, #00b8ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .content { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
                .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #00ff9d, #00b8ff); color: #000; text-decoration: none; border-radius: 30px; font-weight: 600; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: rgba(255,255,255,0.5); font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo"><span class="gradient">⚛️ QuantumPay</span></div>
                </div>
                <div class="content">
                    <h1>Welcome to QuantumPay, ${name}!</h1>
                    <p>We're thrilled to have you on board. Your financial freedom starts now.</p>
                    <p>With QuantumPay, you can:</p>
                    <ul>
                        <li>Send money instantly to anyone</li>
                        <li>Trade cryptocurrencies with real prices</li>
                        <li>Get loans and invest in global markets</li>
                        <li>Create virtual cards for online shopping</li>
                    </ul>
                    <a href="${process.env.CLIENT_URL}/dashboard" class="button">Go to Dashboard</a>
                </div>
                <div class="footer">
                    <p>© 2024 QuantumPay. All rights reserved.</p>
                    <p>Need help? Contact us at support@quantumpay.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

exports.passwordResetEmail = (resetUrl) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #fff; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 32px; font-weight: 800; }
                .gradient { background: linear-gradient(135deg, #00ff9d, #00b8ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .content { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
                .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #00ff9d, #00b8ff); color: #000; text-decoration: none; border-radius: 30px; font-weight: 600; margin: 20px 0; }
                .warning { background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 8px; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: rgba(255,255,255,0.5); font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo"><span class="gradient">⚛️ QuantumPay</span></div>
                </div>
                <div class="content">
                    <h1>Password Reset Request</h1>
                    <p>We received a request to reset your password. Click the button below to proceed:</p>
                    <a href="${resetUrl}" class="button">Reset Password</a>
                    <div class="warning">
                        <p>⚠️ This link will expire in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2024 QuantumPay. All rights reserved.</p>
                    <p>Need help? Contact us at support@quantumpay.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
};