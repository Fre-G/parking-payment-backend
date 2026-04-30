const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/initiate-payment', async (req, res) => {
  const { amount, email, tx_ref } = req.body;
  const secretKey = process.env.CHAPA_SECRET_KEY;

  try {
    const response = await axios.post('https://api.chapa.co/v1/transaction/initialize', {
      amount,
      currency: 'ETB',
      email,
      tx_ref,
      callback_url: 'https://parking-payment-backend.onrender.com/payment-callback',
      return_url: 'https://parking-payment-backend.onrender.com/success',           
      customization: { title: 'Smart Parking Payment' }
    }, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    res.json({ checkout_url: response.data.data.checkout_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));