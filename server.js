const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/initiate-payment', async (req, res) => {
  const { amount, email, tx_ref, first_name, last_name } = req.body;
  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    console.error('❌ CHAPA_SECRET_KEY missing in environment');
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
  }

  // Validate required fields
  if (!amount || !email || !tx_ref || !first_name || !last_name) {
      console.error('❌ Missing required fields in request body');
      return res.status(400).json({ error: 'Missing required fields' });
  }

  // --- Build the payload for Chapa, including all required fields ---
  const payload = {
    amount: Number(amount),
    currency: 'ETB',
    email,
    first_name: first_name,
    last_name: last_name,
    tx_ref,
    // IMPORTANT FIX: Added ':8080' to the webhook URLs to specify the port
    callback_url: 'https://parking-payment-backend.onrender.com:8080/payment-callback',
    return_url: 'https://parking-payment-backend.onrender.com:8080/success',
    customization: { title: 'Smart Parking Payment' }
  };

  console.log('✅ Sending payload to Chapa:', payload);

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
      console.log('✅ Checkout URL received from Chapa');
      return res.json({ checkout_url: response.data.data.checkout_url });
    } else {
      console.error('⚠️ Unexpected Chapa response:', response.data);
      return res.status(500).json({ error: 'Invalid response from payment gateway' });
    }
  } catch (error) {
    // --- Enhanced error logging to capture the exact problem from Chapa ---
    if (error.response) {
      console.error('❌ Chapa API error:', error.response.status, error.response.data);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      console.error('❌ No response received from Chapa API');
    } else {
      console.error('❌ Error:', error.message);
    }
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));