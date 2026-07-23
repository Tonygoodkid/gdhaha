import { del } from '@vercel/blob';

/**
 * Xoá 1 file ảnh trên Vercel Blob theo URL.
 * Gọi khi xoá vé/hoá đơn/chuyến đi để không bỏ rác (orphan) trong kho.
 * Cần biến môi trường: BLOB_READ_WRITE_TOKEN.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const url = body && body.url;
  if (!url) return res.status(400).json({ error: 'No url provided' });

  try {
    await del(url);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('deleteImage error:', error);
    return res.status(500).json({ error: error.message });
  }
}
