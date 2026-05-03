const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== FIREBASE ADMIN INIT ==========
// Render: set environment variable FIREBASE_SERVICE_ACCOUNT with the JSON string
if (!admin.apps.length) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable not set');
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://smart-parking-dashboard-a7707-default-rtdb.firebaseio.com/'
  });
}

const db = admin.firestore();
const rtdb = admin.database();

app.use(cors());
app.use(express.json());

// ========== CHAPA PAYMENT INITIALIZATION ==========
app.post('/api/initiate-payment', async (req, res) => {
  const { amount, email, first_name, last_name, phone_number } = req.body;
  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    console.error('❌ CHAPA_SECRET_KEY missing');
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
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

// ========== QR VERIFICATION ENDPOINT ==========
app.post('/api/verify-qr', async (req, res) => {
  const { userId, qrData } = req.body;

  if (!userId || !qrData) {
    return res.status(400).json({ success: false, message: 'Missing userId or qrData' });
  }

  try {
    // Find an active booking (status = 'booked') for this user
    const bookingsSnapshot = await db.collection('parkingSessions')
      .where('userId', '==', userId)
      .where('status', '==', 'booked')
      .limit(1)
      .get();

    if (bookingsSnapshot.empty) {
      return res.status(403).json({ success: false, message: 'No active booking found' });
    }

    const bookingDoc = bookingsSnapshot.docs[0];
    const booking = bookingDoc.data();

    // Determine station ID from QR data
    let stationId = null;
    const lowerQR = qrData.toLowerCase();
    if (lowerQR.includes('piassa')) stationId = 'piassa';
    else if (lowerQR.includes('maraki')) stationId = 'maraki';
    else if (lowerQR.includes('azezo')) stationId = 'azezo';
    else stationId = booking.stationId;

    if (booking.stationId !== stationId) {
      return res.status(403).json({ success: false, message: 'Wrong parking station' });
    }

    // Write command to Realtime Database for ESP32
    await rtdb.ref('/gate_command').set({
      status: 'open',
      stationId: stationId,
      triggeredBy: userId,
      timestamp: Date.now()
    });

    // Update booking status to 'active'
    await bookingDoc.ref.update({
      status: 'active',
      entryTime: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Gate opening' });
  } catch (error) {
    console.error('QR verification error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/payment-callback', (req, res) => {
  console.log('📞 Payment callback received:', req.query);
  res.send('OK');
});

app.get('/success', (req, res) => {
  console.log('✅ Payment success redirect');
  res.send(`
    <html>
      <body style="text-align:center; margin-top:50px;">
        <h1>✅ Payment Successful</h1>
        <p>You can close this window and return to the app.</p>
        <script>setTimeout(() => { window.close(); }, 3000);</script>
      </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));