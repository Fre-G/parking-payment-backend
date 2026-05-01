const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/success', (req, res) => {
  // Get transaction details from query parameters (Chapa sends these)
  const { tx_ref, amount, currency, status } = req.query;
  
  // Simple HTML receipt page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background-color: #f5f7fa;
        }
        .receipt {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          text-align: center;
        }
        .success-icon {
          font-size: 64px;
          color: #28a745;
          margin-bottom: 16px;
        }
        h1 {
          color: #1e3a5f;
          margin-bottom: 24px;
        }
        .details {
          text-align: left;
          margin: 20px 0;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 16px;
        }
        .label {
          font-weight: bold;
          color: #555;
        }
        .value {
          color: #333;
        }
        button {
          background-color: #007AFF;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: bold;
          margin-top: 20px;
          cursor: pointer;
          width: 100%;
        }
        button:hover {
          background-color: #005bb5;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="success-icon">✅</div>
        <h1>Payment Successful</h1>
        <div class="details">
          <div class="detail-row">
            <span class="label">Transaction ID:</span>
            <span class="value">${tx_ref || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Amount:</span>
            <span class="value">${amount || '?'} ETB</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">${status || 'Completed'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Date:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>
        </div>
        <button onclick="window.ReactNativeWebView.postMessage('close')">Close & Return to App</button>
        <div class="footer">Smart Parking System</div>
      </div>
      <script>
        // Ensure the button works even if ReactNativeWebView is not defined (for web preview)
        if (typeof window.ReactNativeWebView === 'undefined') {
          document.querySelector('button').onclick = () => { alert('Close the WebView manually.'); };
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/api/initiate-payment', async (req, res) => {
  const { amount, email, first_name, last_name, phone_number } = req.body;
  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    console.error('❌ CHAPA_SECRET_KEY missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const tx_ref = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

  const payload = {
    amount: Math.max(1, Number(amount)).toString(),
    currency: 'ETB',
    email: email,
    first_name: first_name || 'Customer',
    last_name: last_name || 'Customer',
    phone_number: phone_number || '0999999999',
    tx_ref: tx_ref,
    callback_url: 'https://parking-payment-backend.onrender.com/payment-callback',
    return_url: 'https://parking-payment-backend.onrender.com/success',
    customization: { title: 'Parking Payment' }
  };

  console.log('📦 Sending to Chapa:', payload);

  try {
    const response = await axios.post(
      'https://api.chapa.co/v1/transaction/initialize',
      payload,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.data?.checkout_url) {
      console.log('✅ Checkout URL received');
      return res.json({ checkout_url: response.data.data.checkout_url });
    } else {
      console.error('Unexpected response:', response.data);
      return res.status(500).json({ error: 'Invalid gateway response' });
    }
  } catch (error) {
    console.error('❌ Chapa error:', error.response?.data || error.message);
    return res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

app.get('/payment-callback', (req, res) => {
  console.log('📞 Payment callback received:', req.query);
  res.send('OK');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));