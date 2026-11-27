
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
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
  tournamentId,
  matchId,
  teamOwnerTelegramId,
  teamPaste,
  player1TelegramId,
  player2TelegramId
} = req.body || {};

    if (typeof initData !== 'string' || initData.length > 10000) {
      return res.status(400).json({
        error: 'Invalid Telegram data'
      });
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

    // Verificar perfil autenticado
    const { data: operator, error: operatorError } = await supabase
      .from('profiles')
      .select('telegram_id, role')
      .eq('telegram_id', user.id)
      .single();

    if (operatorError || !operator) {
      return res.status(403).json({
        error: 'Authenticated profile required'
      });
    }

    const isJudge = ['admin', 'staff'].includes(operator.role);

    // Validar torneo
    if (!UUID_REGEX.test(tournamentId || '')) {
      return res.status(400).json({
        error: 'Invalid tournament ID'
      });
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, status, team_policy')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return res.status(404).json({
        error: 'Tournament not found'
      });
    }

    // ==========================================
    // INICIAR COMBATE Y BLOQUEAR EQUIPOS
    // ==========================================

    if (action === 'start_match') {
      // Solo administradores y staff pueden iniciar combates
      if (!isJudge) {
        return res.status(403).json({
          error: 'Administrator or staff access required'
        });
      }

      if (!UUID_REGEX.test(matchId || '')) {
        return res.status(400).json({
          error: 'Invalid match ID'
        });
      }

      if (!['planned', 'in_progress'].includes(tournament.status)) {
        return res.status(403).json({
          error: 'Tournament cannot start matches'
        });
      }

      const { data: started, error: startError } = await supabase.rpc(
        'start_tournament_match',
        {
          p_match_id: matchId,
          p_tournament_id: tournamentId
        }
      );

      if (startError || started !== true) {
        console.error(
          'Match start failed:',
          startError?.message
        );

        return res.status(409).json({
          error: 'Could not start match. Check that both players submitted their teams.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Match started and teams locked'
      });
    }

    // ==========================================
    // GUARDAR EQUIPO
    // ==========================================

    if (action === 'save_team') {
      if (
        typeof teamPaste !== 'string' ||
        !teamPaste.trim() ||
        teamPaste.length > 20000
      ) {
        return res.status(400).json({
          error: 'Invalid team data'
        });
      }

      if (!['planned', 'in_progress'].includes(tournament.status)) {
        return res.status(403).json({
          error: 'Tournament is not accepting team changes'
        });
      }

      // Solo jugadores con inscripción aprobada
      const { data: registration, error: registrationError } =
        await supabase
          .from('tournament_registrations')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('telegram_id', operator.telegram_id)
          .eq('status', 'approved')
          .maybeSingle();

      if (registrationError || !registration) {
        return res.status(403).json({
          error: 'Approved tournament registration required'
        });
      }

      let teamMatchId = null;

      // Modalidad: equipo diferente por enfrentamiento
      if (tournament.team_policy === 'per_match') {
        if (!UUID_REGEX.test(matchId || '')) {
          return res.status(400).json({
            error: 'A valid match ID is required'
          });
        }

        const { data: match, error: matchError } = await supabase
          .from('tournament_matches')
          .select('id, status, started_at')
          .eq('id', matchId)
          .eq('tournament_id', tournamentId)
          .or(
            `player1_telegram_id.eq.${operator.telegram_id},player2_telegram_id.eq.${operator.telegram_id}`
          )
          .maybeSingle();

        if (matchError || !match) {
          return res.status(403).json({
            error: 'Match access denied'
          });
        }

        if (match.started_at || match.status !== 'scheduled') {
          return res.status(403).json({
            error: 'Team is locked for this match'
          });
        }

        teamMatchId = match.id;
      } else {
        // Modalidad: un equipo para todo el torneo
        if (matchId) {
          return res.status(400).json({
            error: 'This tournament uses a general team'
          });
        }

        // Comprobar si el jugador ya ha comenzado algún combate
        const { data: startedMatches, error: matchesError } =
          await supabase
            .from('tournament_matches')
            .select('id')
            .eq('tournament_id', tournamentId)
            .or(
              `player1_telegram_id.eq.${operator.telegram_id},player2_telegram_id.eq.${operator.telegram_id}`
            )
            .not('started_at', 'is', null)
            .limit(1);

        if (matchesError) {
          return res.status(500).json({
            error: 'Could not verify match status'
          });
        }

        if (startedMatches?.length) {
          return res.status(403).json({
            error: 'Tournament team is locked'
          });
        }
      }

      // Buscar equipo existente
      let teamQuery = supabase
        .from('tournament_teams')
        .select('id, locked_at')
        .eq('tournament_id', tournamentId)
        .eq('telegram_id', operator.telegram_id);

      teamQuery = teamMatchId
        ? teamQuery.eq('match_id', teamMatchId)
        : teamQuery.is('match_id', null);

      const { data: existingTeam, error: existingError } =
        await teamQuery.maybeSingle();

      if (existingError) {
        return res.status(500).json({
          error: 'Could not check existing team'
        });
      }

      if (existingTeam?.locked_at) {
        return res.status(403).json({
          error: 'Team is locked'
        });
      }

      let result;

      if (existingTeam) {
        result = await supabase
          .from('tournament_teams')
          .update({
            team_paste: teamPaste.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTeam.id)
          .is('locked_at', null)
          .select('id')
          .maybeSingle();
      } else {
        result = await supabase
          .from('tournament_teams')
          .insert({
            tournament_id: tournamentId,
            telegram_id: operator.telegram_id,
            match_id: teamMatchId,
            team_paste: teamPaste.trim()
          })
          .select('id')
          .single();
      }

      if (result.error || !result.data) {
        console.error('Team save failed:', result.error?.message);

        return res.status(409).json({
          error: 'Could not save team. It may already be locked.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Team saved successfully',
        teamId: result.data.id
      });
    }

    // ==========================================
    // CONSULTAR EQUIPO CON PERMISOS OTS
    // ==========================================

    if (action === 'get_team') {
      const ownerId = Number(teamOwnerTelegramId);

      if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
        return res.status(400).json({
          error: 'Invalid team owner'
        });
      }

      const isOwner = ownerId === operator.telegram_id;

      // Los jueces y propietarios pueden consultar sus equipos.
      // El rival necesita autorización OTS.
      if (!isOwner && !isJudge) {
        if (!UUID_REGEX.test(matchId || '')) {
          return res.status(403).json({
            error: 'Match authorization required'
          });
        }

        const { data: match, error: matchError } = await supabase
          .from('tournament_matches')
          .select(
            'id, player1_telegram_id, player2_telegram_id, status, started_at'
          )
          .eq('id', matchId)
          .eq('tournament_id', tournamentId)
          .maybeSingle();

        if (matchError || !match) {
          return res.status(403).json({
            error: 'Match access denied'
          });
        }

        const isParticipant =
          (
            match.player1_telegram_id === operator.telegram_id &&
            match.player2_telegram_id === ownerId
          ) ||
          (
            match.player2_telegram_id === operator.telegram_id &&
            match.player1_telegram_id === ownerId
          );

        if (!isParticipant) {
          return res.status(403).json({
            error: 'You are not a participant in this match'
          });
        }

        const matchStarted =
          Boolean(match.started_at) ||
          ['in_progress', 'completed'].includes(match.status);

        if (!matchStarted) {
          return res.status(403).json({
            error: 'Opponent team is private until the match starts'
          });
        }
      }

      // Buscar equipo según la modalidad
      let teamQuery = supabase
        .from('tournament_teams')
        .select('id, tournament_id, telegram_id, match_id, team_paste, team_data, created_at, updated_at, locked_at')
        .eq('tournament_id', tournamentId)
        .eq('telegram_id', ownerId);

      if (tournament.team_policy === 'per_match') {
        if (!UUID_REGEX.test(matchId || '')) {
          return res.status(400).json({
            error: 'Match ID required for this tournament'
          });
        }

        teamQuery = teamQuery.eq('match_id', matchId);
      } else {
        teamQuery = teamQuery.is('match_id', null);
      }

      const { data: team, error: teamError } =
        await teamQuery.maybeSingle();

      if (teamError) {
        return res.status(500).json({
          error: 'Could not load team'
        });
      }

      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      return res.status(200).json({
        success: true,
        team
      });
    }

    return res.status(400).json({
      error: 'Unknown action'
    });

  } catch (error) {
    console.error('Tournament teams API error:', error);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
