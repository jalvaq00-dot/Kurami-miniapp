
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

    const {
      initData,
      action,
      tournament,
      tournamentId,
      registrationId,
      decision
    } = req.body || {};

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

    // Comprobar el rol real del usuario.
    const { data: operator, error: operatorError } = await supabase
      .from('profiles')
      .select('role')
      .eq('telegram_id', user.id)
      .single();

    if (operatorError || !operator) {
  return res.status(403).json({
    error: 'Authenticated profile required'
  });
}

const playerAllowedActions = [
  'list_tournaments',
  'register_for_tournament'
];

if (
  !playerAllowedActions.includes(action) &&
  !['admin', 'staff'].includes(operator.role)
) {
  return res.status(403).json({
    error: 'Administrator or staff access required'
  });
}

if (
  action === 'register_for_tournament' &&
  !['admin', 'staff', 'player'].includes(operator.role)
) {
  return res.status(403).json({
    error: 'Player access required'
  });
}

    // CREAR TORNEO
    if (action === 'create_tournament') {
      const {
        name,
        game,
        format,
        starts_at,
        registration_opens_at,
        registration_closes_at,
        max_participants
      } = tournament || {};

      if (
        typeof name !== 'string' ||
        typeof game !== 'string' ||
        !name.trim() ||
        !game.trim() ||
        name.trim().length > 100 ||
        game.trim().length > 60
      ) {
        return res.status(400).json({
          error: 'Invalid tournament name or game'
        });
      }

      if (
        format !== undefined &&
        format !== null &&
        (typeof format !== 'string' || format.length > 80)
      ) {
        return res.status(400).json({
          error: 'Invalid tournament format'
        });
      }

      const validDate = (value) =>
        value === undefined ||
        value === null ||
        value === '' ||
        (
          typeof value === 'string' &&
          Number.isFinite(Date.parse(value))
        );

      if (
        !validDate(starts_at) ||
        !validDate(registration_opens_at) ||
        !validDate(registration_closes_at)
      ) {
        return res.status(400).json({
          error: 'Invalid tournament dates'
        });
      }

      if (
        registration_opens_at &&
        registration_closes_at &&
        new Date(registration_opens_at) >= new Date(registration_closes_at)
      ) {
        return res.status(400).json({
          error: 'Registration closing date must be after opening date'
        });
      }

      if (
        max_participants !== undefined &&
        max_participants !== null &&
        (
          !Number.isSafeInteger(max_participants) ||
          max_participants < 2 ||
          max_participants > 1024
        )
      ) {
        return res.status(400).json({
          error: 'Invalid participant limit'
        });
      }

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: name.trim(),
          game: game.trim(),
          format: format?.trim() || null,
          starts_at: starts_at || null,
          registration_opens_at: registration_opens_at || null,
          registration_closes_at: registration_closes_at || null,
          max_participants: max_participants || null,
          registration_enabled: true,
          status: 'planned'
        })
        .select('*')
        .single();

      if (error) {
        console.error('Tournament creation failed:', error.message);
        return res.status(500).json({
          error: 'Could not create tournament'
        });
      }

      return res.status(201).json({
        success: true,
        tournament: data
      });
    }

    // CONSULTAR TORNEOS
   if (action === 'list_tournaments') {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Tournament list failed:', error.message);
    return res.status(500).json({
      error: 'Could not load tournaments'
    });
  }

  const { data: registrations, error: registrationsError } = await supabase
    .from('tournament_registrations')
    .select('id, tournament_id, status, registered_at')
    .eq('telegram_id', operator.telegram_id);

  if (registrationsError) {
    console.error('Player registrations failed:', registrationsError.message);
    return res.status(500).json({
      error: 'Could not load player registrations'
    });
  }

  return res.status(200).json({
    success: true,
    tournaments: tournaments || [],
    registrations: registrations || []
  });
}
    if (action === 'register_for_tournament') {
  if (
    typeof tournamentId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(tournamentId)
  ) {
    return res.status(400).json({
      error: 'Invalid tournament ID'
    });
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    return res.status(404).json({
      error: 'Tournament not found'
    });
  }

  if (
    tournament.status !== 'planned' ||
    tournament.registration_enabled === false
  ) {
    return res.status(400).json({
      error: 'Registrations are not available'
    });
  }

  const now = Date.now();

  if (
    tournament.registration_opens_at &&
    now < new Date(tournament.registration_opens_at).getTime()
  ) {
    return res.status(400).json({
      error: 'Registration has not opened yet'
    });
  }

  if (
    tournament.registration_closes_at &&
    now > new Date(tournament.registration_closes_at).getTime()
  ) {
    return res.status(400).json({
      error: 'Registration is closed'
    });
  }

  const { data: existing } = await supabase
    .from('tournament_registrations')
    .select('id, status')
    .eq('tournament_id', tournamentId)
    .eq('telegram_id', operator.telegram_id)
    .maybeSingle();

  if (existing && existing.status !== 'withdrawn') {
    return res.status(409).json({
      error: 'You already have a registration for this tournament'
    });
  }

  if (existing) {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .update({
        status: 'pending',
        registered_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Registration update failed:', error.message);
      return res.status(500).json({
        error: 'Could not register for tournament'
      });
    }

    return res.status(200).json({
      success: true,
      registration: data
    });
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .insert({
      tournament_id: tournamentId,
      telegram_id: operator.telegram_id,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Registration creation failed:', error.message);
    return res.status(500).json({
      error: 'Could not register for tournament'
    });
  }

  return res.status(201).json({
    success: true,
    registration: data
  });
}

    // CONSULTAR SOLICITUDES DE INSCRIPCIÓN
    if (action === 'list_registrations') {
      if (
        typeof tournamentId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(tournamentId)
      ) {
        return res.status(400).json({
          error: 'Invalid tournament ID'
        });
      }

      const { data: registrations, error } = await supabase
        .from('tournament_registrations')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: false });

      if (error) {
        console.error('Registration list failed:', error.message);
        return res.status(500).json({
          error: 'Could not load registrations'
        });
      }

      const telegramIds = [
        ...new Set(registrations.map((item) => item.telegram_id))
      ];

      let profiles = [];

      if (telegramIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select(
            'telegram_id, username, first_name, last_name, photo_url, display_name, nickname, specialty'
          )
          .in('telegram_id', telegramIds);

        if (profilesError) {
          console.error('Registration profiles failed:', profilesError.message);
          return res.status(500).json({
            error: 'Could not load registered players'
          });
        }

        profiles = data || [];
      }

      const profileMap = new Map(
        profiles.map((profile) => [
          String(profile.telegram_id),
          profile
        ])
      );

      const result = registrations.map((registration) => ({
        ...registration,
        player: profileMap.get(String(registration.telegram_id)) || null
      }));

      return res.status(200).json({
        success: true,
        registrations: result
      });
    }

    // APROBAR O RECHAZAR INSCRIPCIÓN
    if (action === 'review_registration') {
      if (
        typeof registrationId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(registrationId) ||
        !['approved', 'rejected'].includes(decision)
      ) {
        return res.status(400).json({
          error: 'Invalid registration or decision'
        });
      }

      const { data: registration, error: registrationError } = await supabase
        .from('tournament_registrations')
        .select('id, tournament_id, status')
        .eq('id', registrationId)
        .single();

      if (registrationError || !registration) {
        return res.status(404).json({
          error: 'Registration not found'
        });
      }

      if (registration.status !== 'pending') {
        return res.status(400).json({
          error: 'This registration has already been reviewed'
        });
      }

      if (decision === 'approved') {
        const { data: event, error: eventError } = await supabase
          .from('tournaments')
          .select('id, status, max_participants')
          .eq('id', registration.tournament_id)
          .single();

        if (eventError || !event) {
          return res.status(404).json({
            error: 'Tournament not found'
          });
        }

        if (event.status !== 'planned') {
          return res.status(400).json({
            error: 'This tournament is no longer accepting approvals'
          });
        }

        if (event.max_participants !== null) {
          const { count, error: countError } = await supabase
            .from('tournament_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('tournament_id', registration.tournament_id)
            .eq('status', 'approved');

          if (countError) {
            return res.status(500).json({
              error: 'Could not verify tournament capacity'
            });
          }

          if (count >= event.max_participants) {
            return res.status(400).json({
              error: 'Tournament is full'
            });
          }
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('tournament_registrations')
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        console.error('Registration review failed:', updateError?.message);
        return res.status(500).json({
          error: 'Could not review registration'
        });
      }

      return res.status(200).json({
        success: true,
        registration: updated
      });
    }

    return res.status(400).json({
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('Admin tournaments endpoint error:', error.message);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
