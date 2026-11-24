
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function verifyTelegram(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

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

  if (!timingSafeEqual(calculatedHash, Buffer.from(hash, 'hex'))) {
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

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length <= maxLength ? cleaned : undefined;
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

    const { initData, nickname, specialty, bio } = req.body || {};

    if (typeof initData !== 'string' || initData.length > 10000) {
      return res.status(400).json({ error: 'Invalid Telegram data' });
    }

    const user = verifyTelegram(initData, TELEGRAM_BOT_TOKEN);

    if (!user || !Number.isSafeInteger(user.id)) {
      return res.status(401).json({ error: 'Telegram verification failed' });
    }

    const cleanNickname = cleanText(nickname, 40);
    const cleanSpecialty = cleanText(specialty, 40);
    const cleanBio = cleanText(bio, 300);

    if (
      cleanNickname === undefined ||
      cleanSpecialty === undefined ||
      cleanBio === undefined
    ) {
      return res.status(400).json({ error: 'Some fields exceed the allowed length' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data, error } = await supabase
      .from('profiles')
      .update({
        nickname: cleanNickname,
        specialty: cleanSpecialty,
        bio: cleanBio,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_id', user.id)
      .select('telegram_id, username, first_name, last_name, display_name, nickname, specialty, bio, role')
      .single();

    if (error) {
      console.error('Profile update failed:', error.message);
      return res.status(500).json({ error: 'Could not update profile' });
    }

    return res.status(200).json({
      success: true,
      profile: data
    });

  } catch (error) {
    console.error('Profile update error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
