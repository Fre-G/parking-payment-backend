const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    customization: { title: 'Smart Parking Payment' }
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));