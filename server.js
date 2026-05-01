const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/initiate-payment', async (req, res) => {
  const { amount, email, tx_ref, user_name } = req.body; // ✅ add user_name from app
  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    console.error('❌ CHAPA_SECRET_KEY missing in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Split name for first_name and last_name (Chapa requires both)
  const firstName = user_name?.split(' ')[0] || 'User';
  const lastName = user_name?.split(' ')[1] || 'Customer';

  try {
    const response = await axios.post(
      'https://api.chapa.co/v1/transaction/initialize',
      {
        amount: Number(amount),          // ✅ must be number
        currency: 'ETB',                 // ✅ required
        email: email,                    // ✅ required
        first_name: firstName,           // ✅ required (missing before)
        last_name: lastName,             // ✅ required (missing before)
        tx_ref: tx_ref,                  // ✅ required, must be unique
        callback_url: 'https://parking-payment-backend.onrender.com/payment-callback',
        return_url: 'https://parking-payment-backend.onrender.com/success',
        customization: { title: 'Smart Parking Payment' }
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Send checkout URL back to mobile app
    if (response.data?.data?.checkout_url) {
      return res.json({ checkout_url: response.data.data.checkout_url });
    } else {
      console.error('Unexpected Chapa response:', response.data);
      return res.status(500).json({ error: 'Invalid response from payment gateway' });
    }
  } catch (error) {
    // Detailed error logging – this will show the exact problem in Render logs
    if (error.response) {
      console.error('Chapa API error:', error.response.status, error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));