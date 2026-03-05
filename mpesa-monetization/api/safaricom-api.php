<?php
class SafaricomAPI {
    private $consumerKey;
    private $consumerSecret;
    private $shortCode;
    private $passKey;
    private $environment;
    
    public function __construct() {
        $this->consumerKey = MPESA_CONSUMER_KEY;
        $this->consumerSecret = MPESA_CONSUMER_SECRET;
        $this->shortCode = MPESA_SHORTCODE;
        $this->passKey = MPESA_PASSKEY;
        $this->environment = MPESA_ENV;
    }
    
    private function getToken() {
        $url = $this->environment === 'sandbox' 
            ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
            : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
        
        $credentials = base64_encode($this->consumerKey . ':' . $this->consumerSecret);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . $credentials]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        return $data['access_token'] ?? null;
    }
    
    public function b2cPayment($phone, $amount, $remarks = 'Weekly payout') {
        $token = $this->getToken();
        
        if (!$token) {
            return ['success' => false, 'error' => 'Failed to get token'];
        }
        
        // Format phone number (remove leading 0 or +254)
        $phone = preg_replace('/^0/', '254', $phone);
        $phone = preg_replace('/^\+/', '', $phone);
        
        $url = $this->environment === 'sandbox'
            ? 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
            : 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';
        
        $timestamp = date('YmdHis');
        $password = base64_encode($this->shortCode . $this->passKey . $timestamp);
        
        $data = [
            'InitiatorName' => 'testapi', // Your API initiator name
            'SecurityCredential' => $this->getSecurityCredential(),
            'CommandID' => 'BusinessPayment',
            'Amount' => $amount,
            'PartyA' => $this->shortCode,
            'PartyB' => $phone,
            'Remarks' => $remarks,
            'QueueTimeOutURL' => 'https://quantumpay-app.pages.dev//mpesa-monetization/api/timeout.php',
            'ResultURL' => 'https://quantumpay-app.pages.dev//mpesa-monetization/api/result.php',
            'Occasion' => 'Weekly Earnings'
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $result = json_decode($response, true);
        
        if (isset($result['ResponseCode']) && $result['ResponseCode'] == '0') {
            return [
                'success' => true,
                'reference' => $result['ConversationID'] ?? '',
                'receipt' => $result['OriginatorConversationID'] ?? ''
            ];
        } else {
            return [
                'success' => false,
                'error' => $result['errorMessage'] ?? 'Unknown error'
            ];
        }
    }
    
    private function getSecurityCredential() {
        // In production, you need to encrypt with your certificate
        // For sandbox, you can use a test credential
        return base64_encode('your-security-credential');
    }
}
?>
