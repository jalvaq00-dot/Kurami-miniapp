
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

    const { initData, action, targetTelegramId, role } = req.body || {};

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

    // Comprobar el rol real del administrador en Supabase.
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('role')
      .eq('telegram_id', user.id)
      .single();

    if (adminError || admin?.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }

    // Consultar todos los miembros.
    if (action === 'list') {
      const { data, error } = await supabase
        .from('profiles')
        .select('telegram_id, username, first_name, last_name, photo_url, display_name, nickname, specialty, bio, role, created_at')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Admin list failed:', error.message);
        return res.status(500).json({ error: 'Could not load members' });
      }

      return res.status(200).json({
        success: true,
        players: data
      });
    }

    // Cambiar el rol de un miembro.
    if (action === 'set_role') {
      const targetId = Number(targetTelegramId);
      const validRoles = ['admin', 'staff', 'player'];

      if (!Number.isSafeInteger(targetId) || targetId <= 0 || !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid member or role' });
      }

      if (targetId === user.id) {
        return res.status(400).json({ error: 'You cannot change your own role here' });
      }

      const { data: target, error: targetError } = await supabase
        .from('profiles')
        .select('telegram_id, role')
        .eq('telegram_id', targetId)
        .single();

      if (targetError || !target) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Evitar retirar el rol al último administrador.
      if (target.role === 'admin' && role !== 'admin') {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('telegram_id', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (countError) {
          return res.status(500).json({ error: 'Could not verify administrators' });
        }

        if (count <= 1) {
          return res.status(400).json({ error: 'At least one administrator must remain' });
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', targetId)
        .select('telegram_id, username, first_name, last_name, role')
        .single();

      if (updateError) {
        console.error('Role update failed:', updateError.message);
        return res.status(500).json({ error: 'Could not update role' });
      }

      return res.status(200).json({
        success: true,
        member: updated
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Admin endpoint error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
