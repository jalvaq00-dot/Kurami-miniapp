
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function verifyTelegram(initData, botToken) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return null;
  }

  const entries = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest();

  if (!timingSafeEqual(calculatedHash, Buffer.from(receivedHash, 'hex'))) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > 86400) {
    return null;
  }

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      SUPABASE_URL,
      SUPABASE_SECRET_KEY,
      TELEGRAM_BOT_TOKEN
    } = process.env;

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'Server configuration incomplete' });
    }

    const initData = req.body?.initData;

    if (typeof initData !== 'string' || initData.length > 10000) {
      return res.status(400).json({ error: 'Invalid Telegram data' });
    }

    const user = verifyTelegram(initData, TELEGRAM_BOT_TOKEN);

    if (!user || !Number.isSafeInteger(user.id)) {
      return res.status(401).json({ error: 'Telegram verification failed' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_id, username, first_name, last_name, photo_url, display_name, nickname, specialty, bio, role')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Players query failed:', error.message);
      return res.status(500).json({ error: 'Could not load players' });
    }

    return res.status(200).json({
      success: true,
      players: data
    });

  } catch (error) {
    console.error('Players endpoint error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
