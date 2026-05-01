const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Chapa } = require('chapa-nodejs');

const app = express();
const PORT = process.env.PORT || 3000;

const chapa = new Chapa({
  secretKey: process.env.CHAPA_SECRET_KEY,
});

app.use(cors());
app.use(express.json());

app.post('/api/initiate-payment', async (req, res) => {
  console.log('--- Received request body ---');
  console.log(JSON.stringify(req.body, null, 2));

  const { amount, email, first_name, last_name, phone_number } = req.body;
  const tx_ref = await chapa.genTxRef();

  const payload = {
    first_name: first_name || 'Customer',
    last_name: last_name || 'Customer',
    email: email,
    phone_number: phone_number || '0911111111',
    currency: 'ETB',
    amount: Math.max(1, Number(amount)).toString(),
    tx_ref: tx_ref,
    callback_url: 'https://parking-payment-backend.onrender.com/payment-callback',
    return_url: 'https://parking-payment-backend.onrender.com/success',
    customization: { title: 'Smart Parking Payment' },
  };

  console.log('--- Sending payload to Chapa ---');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await chapa.mobileInitialize(payload);
    console.log('--- Success! Checkout URL received ---');
    res.json({ checkout_url: response.data.checkout_url });
  } catch (error) {
    console.error('--- Chapa API Error ---');
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));