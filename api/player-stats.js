
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

  if (
    !Number.isFinite(authDate) ||
    authDate > now + 60 ||
    now - authDate > 86400
  ) {
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
      return res.status(500).json({
        error: 'Server configuration incomplete'
      });
    }

    const initData = req.body?.initData;

    if (typeof initData !== 'string' || initData.length > 10000) {
      return res.status(400).json({ error: 'Invalid Telegram data' });
    }

    const user = verifyTelegram(initData, TELEGRAM_BOT_TOKEN);

    if (!user || !Number.isSafeInteger(user.id)) {
      return res.status(401).json({
        error: 'Telegram verification failed'
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SECRET_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Comprobar que el usuario está registrado en Kurami.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('telegram_id')
      .eq('telegram_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Stats profile check failed:', profileError.message);
      return res.status(500).json({
        error: 'Could not verify member'
      });
    }

    if (!profile) {
      return res.status(403).json({
        error: 'Member not registered in Kurami'
      });
    }

    // Consultar estadísticas calculadas por Supabase.
    const { data, error } = await supabase
      .from('player_competitive_stats')
      .select('*');

    if (error) {
      console.error('Player stats query failed:', error.message);
      return res.status(500).json({
        error: 'Could not load player statistics'
      });
    }

    // Ordenar el ranking por puntos, victorias,
    // porcentaje de victorias y mejor posición.
    const stats = [...data].sort((a, b) => {
      const pointsDifference =
        Number(b.total_points) - Number(a.total_points);

      if (pointsDifference !== 0) return pointsDifference;

      const winsDifference =
        Number(b.wins) - Number(a.wins);

      if (winsDifference !== 0) return winsDifference;

      const rateDifference =
        Number(b.win_rate) - Number(a.win_rate);

      if (rateDifference !== 0) return rateDifference;

      const aPosition = a.best_placement ?? Infinity;
      const bPosition = b.best_placement ?? Infinity;

      return aPosition - bPosition;
    });

    const rankedStats = stats.map((player, index) => ({
      ...player,
      ranking_position: index + 1
    }));

    return res.status(200).json({
      success: true,
      stats: rankedStats
    });

  } catch (error) {
    console.error('Player stats endpoint error:', error.message);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
