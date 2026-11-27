
import { createHmac, timingSafeEqual, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function verifyTelegram(initData, botToken) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));

  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return null;
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest();

  const receivedBuffer = Buffer.from(receivedHash, 'hex');

  if (
    receivedBuffer.length !== calculatedHash.length ||
    !timingSafeEqual(receivedBuffer, calculatedHash)
  ) {
    return null;
  }

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

// Barajado Fisher-Yates con generador criptográfico.
function shuffleParticipants(participants) {
  const shuffled = [...participants];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled;
}

// Generación de todas las jornadas de liga.
function generateLeagueRounds(participants, legs) {
  const players = [...participants];

  if (players.length % 2 !== 0) {
    players.push(null);
  }

  const totalPlayers = players.length;
  const roundsPerLeg = totalPlayers - 1;
  const rounds = [];

  let rotation = [...players];

  for (let round = 1; round <= roundsPerLeg * legs; round++) {
    const leg = Math.floor((round - 1) / roundsPerLeg);
    const pairs = [];
    let bye = null;

    for (let i = 0; i < totalPlayers / 2; i++) {
      let player1 = rotation[i];
      let player2 = rotation[totalPlayers - 1 - i];

      if (leg === 1) {
        [player1, player2] = [player2, player1];
      }

      if (player1 === null || player2 === null) {
        bye = player1 ?? player2;
        continue;
      }

      pairs.push([player1, player2]);
    }

    rounds.push({
      round_number: round,
      pairs,
      bye
    });

    // Mantener el primer participante fijo y rotar el resto.
    rotation = [
      rotation[0],
      rotation[totalPlayers - 1],
      ...rotation.slice(1, totalPlayers - 1)
    ];
  }

  return rounds;
}

// Primera ronda suiza: emparejamiento aleatorio.

function generateFirstSwissRound(shuffledParticipants) {
  const players = [...shuffledParticipants];
  const pairs = [];
  let bye = null;

  if (players.length % 2 !== 0) {
    bye = players.pop();
  }

  for (let i = 0; i < players.length; i += 2) {
    pairs.push([players[i], players[i + 1]]);
  }

  return [{
    round_number: 1,
    pairs,
    bye
  }];
}


export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

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
        error: 'Server configuration error'
      });
    }

    const {
      initData,
      action,
      tournamentId
    } = req.body || {};

    if (
      !initData ||
      action !== 'generate_initial_draw' ||
      !tournamentId
    ) {
      return res.status(400).json({
        error: 'Invalid request'
      });
    }

    const user = verifyTelegram(initData, TELEGRAM_BOT_TOKEN);

    if (!user?.id) {
      return res.status(401).json({
        error: 'Invalid Telegram authentication'
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

    // Comprobar el rol del operador.
    const { data: operator, error: operatorError } = await supabase
      .from('profiles')
      .select('telegram_id, role')
      .eq('telegram_id', user.id)
      .single();

    if (
      operatorError ||
      !operator ||
      !['admin', 'staff'].includes(operator.role)
    ) {
      return res.status(403).json({
        error: 'Administrator or staff access required'
      });
    }

    // Obtener el torneo.
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        id,
        pairing_system,
        league_legs,
        best_of,
        current_round,
        status
      `)
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return res.status(404).json({
        error: 'Tournament not found'
      });
    }

    if (['completed', 'cancelled'].includes(tournament.status)) {
      return res.status(400).json({
        error: 'Tournament cannot generate pairings'
      });
    }

    // Obtener únicamente las inscripciones aprobadas.
    const { data: registrations, error: registrationsError } =
      await supabase
        .from('tournament_registrations')
        .select('telegram_id')
        .eq('tournament_id', tournamentId)
        .eq('status', 'approved');

    if (registrationsError) {
      throw registrationsError;
    }

    const participants = (registrations || [])
      .map(item => Number(item.telegram_id));

    if (
      participants.length < 2 ||
      participants.some(id => !Number.isSafeInteger(id)) ||
      new Set(participants).size !== participants.length
    ) {
      return res.status(400).json({
        error: 'Invalid approved participant list'
      });
    }

    // Barajar semillas antes de realizar el sorteo.
    const shuffled = shuffleParticipants(participants);

    let rounds;

    if (tournament.pairing_system === 'league') {
      rounds = generateLeagueRounds(
        shuffled,
        tournament.league_legs
      );
    } else if (tournament.pairing_system === 'swiss') {
      rounds = generateFirstSwissRound(shuffled);
    } else {
      return res.status(400).json({
        error: 'Unsupported pairing system'
      });
    }

    // Guardar el sorteo mediante la función transaccional de Supabase.
    const { data: result, error: drawError } = await supabase.rpc(
      'persist_tournament_rounds',
      {
        p_tournament_id: tournamentId,
        p_rounds: rounds,
        p_participant_order: shuffled,
        p_generated_by: user.id,
        p_initial_draw: true
      }
    );

    if (drawError) {
      console.error('Tournament draw error:', drawError);

      return res.status(409).json({
        error: drawError.message || 'Could not generate tournament draw'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tournament draw generated successfully',
      result,
      rounds
    });

  } catch (error) {
    console.error('Tournament pairings error:', error);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
