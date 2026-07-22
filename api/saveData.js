import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    await redis.set('ticketVaultData', data);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving to Redis:', error);
    res.status(500).json({ error: error.message });
  }
}
