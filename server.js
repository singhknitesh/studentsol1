import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.RAZORPAY_SERVER_PORT || 8787;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/razorpay/order', async (req, res) => {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay keys are missing on server.' });
    }

    const amount = Number(req.body?.amount);
    const receipt = String(req.body?.receipt || `hostel_${Date.now()}`);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.description || 'Failed to create Razorpay order.',
      });
    }

    return res.json({ order: data });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.post('/api/razorpay/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay secret missing on server.' });
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields.' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
    const isValid = expectedSignature === razorpay_signature;
    return res.json({ isValid });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Razorpay server running on http://localhost:${PORT}`);
});
