
import { useEffect, useState } from 'react';

const sections = [
  { id: 'inicio', icon: '⌂', label: 'Inicio' },
  { id: 'torneos', icon: '🏆', label: 'Torneos' },
  { id: 'jugadores', icon: '👥', label: 'Jugadores' },
  { id: 'ranking', icon: '📊', label: 'Ranking' },
];

const roleLabels = {
  admin: 'ADMINISTRADOR',
  staff: 'STAFF',
  player: 'JUGADOR',
};

export default function App() {
  const [active, setActive] = useState('inicio');
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [players, setPlayers] = useState([]);
  const [playersStatus, setPlayersStatus] = useState('idle');
  const [playersError, setPlayersError] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Estado del panel de administración.
  const [adminMembers, setAdminMembers] = useState([]);
  const [adminStatus, setAdminStatus] = useState('idle');
  const [adminError, setAdminError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRoleFilter, setAdminRoleFilter] = useState('all');
  const [adminSavingId, setAdminSavingId] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
const [statsStatus, setStatsStatus] = useState('idle');
  const [editingMember, setEditingMember] = useState(false);
const [memberNickname, setMemberNickname] = useState('');
const [memberSpecialty, setMemberSpecialty] = useState('');
const [memberBio, setMemberBio] = useState('');
const [memberSaving, setMemberSaving] = useState(false);
const [memberSaveMessage, setMemberSaveMessage] = useState('');

  const tg = window.Telegram?.WebApp;
  const isAdmin = profile?.role === 'admin';

  const navigation = isAdmin
    ? [...sections, { id: 'admin', icon: '🛡️', label: 'Admin' }]
    : sections;

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      if (!tg?.initData) {
        setStatus('telegram-required');
        return;
      }

      tg.ready();
      tg.expand();

      try {
        const response = await fetch('/api/telegram-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudo verificar Telegram');
        }

        if (!cancelled) {
          setProfile(result.profile);
          setNickname(result.profile.nickname || '');
          setSpecialty(result.profile.specialty || '');
          setBio(result.profile.bio || '');
          setStatus('authenticated');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);
  // Gestión de torneos
const [tournaments, setTournaments] = useState([]);
const [tournamentsStatus, setTournamentsStatus] = useState('idle');
const [tournamentsError, setTournamentsError] = useState('');
  const [myRegistrations, setMyRegistrations] = useState([]);
const [registeringTournament, setRegisteringTournament] = useState('');
const [registrationMessage, setRegistrationMessage] = useState('');

const [selectedTournament, setSelectedTournament] = useState(null);
const [tournamentRegistrations, setTournamentRegistrations] = useState([]);
const [registrationsStatus, setRegistrationsStatus] = useState('idle');
  const [registrationActionLoading, setRegistrationActionLoading] = useState('');
const [registrationError, setRegistrationError] = useState('');
  // Formulario de creación de torneos
const [showTournamentForm, setShowTournamentForm] = useState(false);
const [tournamentForm, setTournamentForm] = useState({
  name: '',
  game: 'Pokémon Champions',
  format: 'VGC',
  starts_at: '',
  registration_opens_at: '',
  registration_closes_at: '',
  max_participants: '',

  // Configuración de enfrentamientos
  pairing_system: 'league',
  league_legs: 1,
  swiss_rounds_mode: 'auto',
  swiss_rounds: 3
});
const [creatingTournament, setCreatingTournament] = useState(false);
const [createTournamentError, setCreateTournamentError] = useState('');

  // Cargar el directorio de jugadores.
  useEffect(() => {
    if (active !== 'jugadores' || status !== 'authenticated') return;

    let cancelled = false;

    async function loadPlayers() {
      setPlayersStatus('loading');
      setPlayersError('');

      try {
        const response = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg?.initData }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudieron cargar los jugadores');
        }

        if (!cancelled) {
          setPlayers(result.players || []);
          setPlayersStatus('success');
        }
      } catch (err) {
        if (!cancelled) {
          setPlayersError(err.message);
          setPlayersStatus('error');
        }
      }
    }

    loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [active, status]);
  
useEffect(() => {
  if (
    (active !== 'jugadores' && active !== 'ranking') ||
    status !== 'authenticated'
  ) {
    return;
  }

  let cancelled = false;

  async function loadPlayerStats() {
    setStatsStatus('loading');

    try {
      const response = await fetch('/api/player-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initData: tg?.initData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'No se pudieron cargar las estadísticas'
        );
      }

      if (!cancelled) {
        setPlayerStats(result.stats || []);
        setStatsStatus('success');
      }

    } catch (error) {
      console.error('Error loading player stats:', error);

      if (!cancelled) {
        setStatsStatus('error');
      }
    }
  }

  loadPlayerStats();

  return () => {
    cancelled = true;
  };
}, [active, status]);

useEffect(() => {
 if (
  active !== 'torneos' ||
  status !== 'authenticated' ||
  !profile?.role
) {
  return;
}

  let cancelled = false;

  async function loadTournaments() {
    setTournamentsStatus('loading');
    setTournamentsError('');

    try {
      const response = await fetch('/api/admin-tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initData: tg?.initData,
          action: 'list_tournaments'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'No se pudieron cargar los torneos'
        );
      }

      if (!cancelled) {
       setTournaments(result.tournaments || []);
setMyRegistrations(result.registrations || []);
setTournamentsStatus('success');;
      }

    } catch (error) {
      console.error('Error loading tournaments:', error);

      if (!cancelled) {
        setTournamentsError(error.message);
        setTournamentsStatus('error');
      }
    }
  }

  loadTournaments();

  return () => {
    cancelled = true;
  };
}, [active, status, profile?.role]);


  // Cargar el panel de administración.
  useEffect(() => {
    if (active !== 'admin' || status !== 'authenticated' || !isAdmin) return;

    let cancelled = false;

    async function loadAdminMembers() {
      setAdminStatus('loading');
      setAdminError('');
      setAdminMessage('');

      try {
        const response = await fetch('/api/admin-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: tg?.initData,
            action: 'list',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudieron cargar los miembros');
        }

        if (!cancelled) {
          setAdminMembers(result.players || []);
          setAdminStatus('success');
        }
      } catch (err) {
        if (!cancelled) {
          setAdminError(err.message);
          setAdminStatus('error');
        }
      }
    }

    loadAdminMembers();

    return () => {
      cancelled = true;
    };
  }, [active, status, profile?.role]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/profile-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData,
          nickname,
          specialty,
          bio,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo guardar el perfil');
      }

      setProfile(result.profile);
      setNickname(result.profile.nickname || '');
      setSpecialty(result.profile.specialty || '');
      setBio(result.profile.bio || '');
      setEditing(false);
      setSaveMessage('Perfil actualizado correctamente.');

      setPlayers((current) =>
        current.map((player) =>
          player.telegram_id === result.profile.telegram_id
            ? { ...player, ...result.profile }
            : player
        )
      );
    } catch (err) {
      setSaveMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Cambiar el rol de un miembro desde el servidor.
  async function changeMemberRole(member, newRole) {
    if (!isAdmin || !member.telegram_id || !newRole) return;
    if (member.role === newRole) return;

    setAdminSavingId(member.telegram_id);
    setAdminMessage('');
    setAdminError('');

    try {
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData,
          action: 'set_role',
          targetTelegramId: Number(member.telegram_id),
          role: newRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo cambiar el rol');
      }

      setAdminMembers((current) =>
        current.map((item) =>
          item.telegram_id === member.telegram_id
            ? { ...item, role: result.member.role }
            : item
        )
      );

      setPlayers((current) =>
        current.map((item) =>
          item.telegram_id === member.telegram_id
            ? { ...item, role: result.member.role }
            : item
        )
      );

      setAdminMessage(
        `Rol actualizado correctamente para ${member.nickname || member.first_name || 'el miembro'}.`
      );
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminSavingId(null);
    }
  }
    function startEditingMember(member) {
    setMemberNickname(member.nickname || '');
    setMemberSpecialty(member.specialty || '');
    setMemberBio(member.bio || '');
    setMemberSaveMessage('');
    setEditingMember(true);
  }

  async function saveMemberProfile() {
    if (!isAdmin || !selectedMember || memberSaving) return;

    setMemberSaving(true);
    setMemberSaveMessage('');

    try {
      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg?.initData,
          action: 'update_member_profile',
          targetTelegramId: Number(selectedMember.telegram_id),
          nickname: memberNickname,
          specialty: memberSpecialty,
          bio: memberBio
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo actualizar el perfil');
      }

      setAdminMembers(current =>
        current.map(member =>
          String(member.telegram_id) === String(result.member.telegram_id)
            ? { ...member, ...result.member }
            : member
        )
      );

      setPlayers(current =>
        current.map(member =>
          String(member.telegram_id) === String(result.member.telegram_id)
            ? { ...member, ...result.member }
            : member
        )
      );

      setSelectedMember(result.member);
      setEditingMember(false);
      setMemberSaveMessage('Perfil actualizado correctamente.');
    } catch (error) {
      setMemberSaveMessage(error.message);
    } finally {
      setMemberSaving(false);
    }
  }

  const name =
    profile?.display_name ||
    profile?.first_name ||
    'Entrenador';

  const filteredPlayers = players.filter((player) => {
    const term = search.toLowerCase().trim();

    const fullName = [
      player.nickname,
      player.display_name,
      player.first_name,
      player.last_name,
      player.username,
    ].filter(Boolean).join(' ').toLowerCase();

    return fullName.includes(term);
  });

  
const filteredAdminMembers = adminMembers.filter((member) => {
  const term = adminSearch.toLowerCase().trim();

  const fullName = [
    member.nickname,
    member.display_name,
    member.first_name,
    member.last_name,
    member.username,
    member.specialty,
    member.role,
  ].filter(Boolean).join(' ').toLowerCase();

  const matchesSearch = fullName.includes(term);
  const matchesRole =
    adminRoleFilter === 'all' || member.role === adminRoleFilter;

  return matchesSearch && matchesRole;
});

const adminStats = {
  total: adminMembers.length,
  admins: adminMembers.filter(m => m.role === 'admin').length,
  staff: adminMembers.filter(m => m.role === 'staff').length,
  players: adminMembers.filter(m => m.role === 'player').length,
};

async function handleCreateTournament(event) {
  event.preventDefault();

  setCreatingTournament(true);
  setCreateTournamentError('');

  try {
    const response = await fetch('/api/admin-tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        initData: tg?.initData,
        action: 'create_tournament',
        tournament: {
          ...tournamentForm,
          starts_at: tournamentForm.starts_at
            ? new Date(tournamentForm.starts_at).toISOString()
            : null,
          registration_opens_at: tournamentForm.registration_opens_at
            ? new Date(tournamentForm.registration_opens_at).toISOString()
            : null,
          registration_closes_at: tournamentForm.registration_closes_at
            ? new Date(tournamentForm.registration_closes_at).toISOString()
            : null,
          max_participants: tournamentForm.max_participants
            ? Number(tournamentForm.max_participants)
            : null
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || 'No se pudo crear el torneo'
      );
    }

    setTournaments((previous) => [
      result.tournament,
      ...previous
    ]);

    setTournamentForm({
      name: '',
      game: 'Pokémon Champions',
      format: 'VGC',
      starts_at: '',
      registration_opens_at: '',
      registration_closes_at: '',
      max_participants: ''
    });

    setShowTournamentForm(false);

  } catch (error) {
    console.error('Tournament creation failed:', error);
    setCreateTournamentError(error.message);

  } finally {
    setCreatingTournament(false);
  }
}
async function loadTournamentRegistrations(tournamentId) {
  setRegistrationsStatus('loading');
  setRegistrationError('');
  setTournamentRegistrations([]);

  try {
    const response = await fetch('/api/admin-tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        initData: tg?.initData,
        action: 'list_registrations',
        tournamentId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || 'No se pudieron cargar las inscripciones'
      );
    }

    setTournamentRegistrations(result.registrations || []);
    setRegistrationsStatus('success');

  } catch (error) {
    console.error('Error loading registrations:', error);
    setRegistrationError(error.message);
    setRegistrationsStatus('error');
  }
}
  async function handleReviewRegistration(registrationId, decision) {
  setRegistrationActionLoading(registrationId);
  setRegistrationError('');

  try {
    const response = await fetch('/api/admin-tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        initData: tg?.initData,
        action: 'review_registration',
        registrationId,
        decision
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || 'No se pudo actualizar la inscripción'
      );
    }

    await loadTournamentRegistrations(selectedTournament.id);

  } catch (error) {
    console.error('Registration review failed:', error);
    setRegistrationError(error.message);
  } finally {
    setRegistrationActionLoading('');
  }
}
  async function handleRegisterTournament(tournamentId) {
  setRegisteringTournament(tournamentId);
  setRegistrationMessage('');

  try {
    const response = await fetch('/api/admin-tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        initData: tg?.initData,
        action: 'register_for_tournament',
        tournamentId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || 'No se pudo completar la inscripción'
      );
    }

    setMyRegistrations((previous) => [
      ...previous.filter(
        (item) => item.tournament_id !== tournamentId
      ),
      result.registration
    ]);

    setRegistrationMessage(
      'Solicitud enviada correctamente. Está pendiente de aprobación.'
    );

  } catch (error) {
    console.error('Tournament registration failed:', error);
    setRegistrationMessage(error.message);
  } finally {
    setRegisteringTournament('');
  }
}

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">K</div>
        <div className="brand-copy">
          <strong>KURAMI <span>E-SPORTS</span></strong>
          <small>AWAKEN THE DRAGON'S SOUL</small>
        </div>
        <div className="online-dot" />
      </header>

      <section className="hero">
        <div className="eyebrow">KURAMI COMMUNITY HUB</div>
        <h1>Bienvenido,<br /><span>{name}</span></h1>
        <p>Tu comunidad competitiva</p>
        <div className="dragon-line">
          KURAMI <b>✦</b> COMPETITIVE POKÉMON
        </div>
      </section>

      <section className="notice">
        {status === 'loading' && (
          <div>
            <strong>Verificando tu cuenta...</strong>
            <p>Conectando con Telegram y Kurami.</p>
          </div>
        )}

        {status === 'authenticated' && (
          <div>
            <strong>Cuenta verificada</strong>
            <p>
              Bienvenido a Kurami.
              {profile?.username ? ` Usuario: @${profile.username}` : ''}
            </p>
            <p>Rol: {profile.role}</p>
          </div>
        )}

        {status === 'telegram-required' && (
          <div>
            <strong>Abre Kurami desde Telegram</strong>
            <p>Utiliza el botón KURAMI E-SPORTS de nuestro bot.</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <strong>No se pudo verificar tu cuenta</strong>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        )}
      </section>

      {active === 'inicio' && (
        <>
          <section className="section-heading">
            <h2>Explora Kurami</h2>
            <span>PLATAFORMA</span>
          </section>

          <div className="feature-grid">
            <Feature icon="🏆" title="Torneos"
              desc="Eventos e inscripciones"
              onClick={() => setActive('torneos')} />

            <Feature icon="👥" title="Jugadores"
              desc="Miembros de Kurami"
              onClick={() => setActive('jugadores')} />

            <Feature icon="📊" title="Rankings"
              desc="Clasificaciones"
              onClick={() => setActive('ranking')} />

            <Feature icon="🐉" title="Pokédex"
              desc="Próximamente" onClick={() => {}} />

            <Feature icon="⚙️" title="Mi perfil"
              desc="Personaliza tu ficha"
              onClick={() => {
                setEditing(true);
                setActive('perfil');
              }} />

            {isAdmin && (
              <Feature icon="🛡️" title="Administración"
                desc="Gestionar miembros y roles"
                onClick={() => setActive('admin')} />
            )}
          </div>

          <section className="notice">
            <span className="notice-icon">✦</span>
            <div>
              <strong>La comunidad Kurami</strong>
              <p>Un espacio para aprender, competir y crecer juntos.</p>
            </div>
          </section>
        </>
      )}

      {active === 'perfil' && (
        <section className="profile-editor">
          <div className="section-heading">
            <h2>Mi perfil</h2>
            <span>CONFIGURACIÓN</span>
          </div>

          <div className="profile-summary">
            <div className="player-avatar">
              {profile?.photo_url
                ? <img src={profile.photo_url} alt="" />
                : <span>{name.charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <strong>{name}</strong>
              <small>
                {profile?.username ? `@${profile.username}` : 'Miembro Kurami'}
              </small>
              <span className="player-role">
                {profile?.role?.toUpperCase()}
              </span>
            </div>
          </div>

          <form className="profile-form" onSubmit={saveProfile}>
            <label htmlFor="nickname">Nickname competitivo</label>
            <input
              id="nickname"
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Tu nombre de jugador"
            />

            <label htmlFor="specialty">Especialidad</label>
            <select
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="">Selecciona tu especialidad</option>
              <option value="VGC">Pokémon VGC</option>
              <option value="TCG">Pokémon TCG</option>
              <option value="Pokémon GO">Pokémon GO</option>
              <option value="Unite">Pokémon UNITE</option>
              <option value="Otros">Otros</option>
            </select>

            <label htmlFor="bio">Biografía</label>
            <textarea
              id="bio"
              maxLength={300}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Cuéntanos algo sobre ti..."
            />

            <small className="character-count">{bio.length}/300 caracteres</small>

            <div className="role-notice">
              <strong>Rol: {profile?.role}</strong>
              <p>Los roles solo pueden ser modificados por administradores.</p>
            </div>

            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>

            {saveMessage && <p className="save-message">{saveMessage}</p>}
          </form>
        </section>
      )}

      
{active === 'torneos' && (
  <section className="tournaments-section">

    <div className="eyebrow">
      KURAMI E-SPORTS · TOURNAMENT CENTER
    </div>

    <div className="section-heading">
      <h2>TORNEOS</h2>
      <p>Centro de competición Kurami</p>
    </div>

    {['admin', 'staff'].includes(profile?.role) && (
      <div className="tournament-admin-panel">

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCreateTournamentError('');
            setShowTournamentForm(!showTournamentForm);
          }}
        >
          {showTournamentForm ? 'CERRAR FORMULARIO' : '+ CREAR TORNEO'}
        </button>

        {showTournamentForm && (
          <form
            className="tournament-form"
            onSubmit={handleCreateTournament}
          >
            <h3>NUEVO TORNEO</h3>

            <label>Nombre del torneo</label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Ej. Kurami Championship"
              value={tournamentForm.name}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  name: event.target.value
                })
              }
            />

            <label>Videojuego</label>
            <select
              value={tournamentForm.game}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  game: event.target.value
                })
              }
            >
              <option value="Pokémon Champions">Pokémon Champions</option>
              <option value="Pokémon Escarlata y Púrpura">
                Pokémon Escarlata y Púrpura
              </option>
              <option value="Pokémon GO">Pokémon GO</option>
              <option value="Pokémon TCG">Pokémon TCG</option>
              <option value="Pokémon Unite">Pokémon Unite</option>
            </select>

            <label>Formato</label>
            <select
              value={tournamentForm.format}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  format: event.target.value
                })
              }
            >
              <option value="VGC">VGC</option>
              <option value="Individual">Individual</option>
              <option value="Dobles">Dobles</option>
              <option value="TCG">TCG</option>
              <option value="Otro">Otro</option>
            </select>

            <label>Fecha de inicio</label>
            <input
              type="datetime-local"
              value={tournamentForm.starts_at}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  starts_at: event.target.value
                })
              }
            />

            <label>Apertura de inscripciones</label>
            <input
              type="datetime-local"
              value={tournamentForm.registration_opens_at}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  registration_opens_at: event.target.value
                })
              }
            />

            <label>Cierre de inscripciones</label>
            <input
              type="datetime-local"
              value={tournamentForm.registration_closes_at}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  registration_closes_at: event.target.value
                })
              }
            />

            <label>Máximo de participantes</label>
            <input
              type="number"
              min="2"
              max="1024"
              placeholder="Sin límite"
              value={tournamentForm.max_participants}
              onChange={(event) =>
                setTournamentForm({
                  ...tournamentForm,
                  max_participants: event.target.value
                })
              }
            />

            {createTournamentError && (
              <p className="tournament-error">
                {createTournamentError}
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={creatingTournament}
            >
              {creatingTournament ? 'CREANDO...' : 'PUBLICAR TORNEO'}
            </button>
          </form>
        )}

      </div>
    )}

    <div className="tournament-list-heading">
      <h3>COMPETICIONES PUBLICADAS</h3>
    </div>
    {registrationMessage && (
  <div className="registration-feedback">
    <p>{registrationMessage}</p>

    <button
      type="button"
      onClick={() => setRegistrationMessage('')}
      aria-label="Cerrar aviso"
    >
      ✕
    </button>
  </div>
)}

    {tournamentsStatus === 'loading' && (
      <p className="tournament-message">
        Cargando torneos...
      </p>
    )}

    {tournamentsStatus === 'error' && (
      <p className="tournament-error">
        {tournamentsError || 'No se pudieron cargar los torneos.'}
      </p>
    )}

    {tournamentsStatus === 'success' && tournaments.length === 0 && (
      <p className="tournament-message">
        Todavía no hay torneos publicados.
      </p>
    )}

    {tournamentsStatus === 'success' && tournaments.length > 0 && (
      <div className="tournament-list">
        {tournaments.map((tournament) => (
          <article
            className="tournament-card"
            key={tournament.id}
          >
            <div className="tournament-card-top">
              <span>{tournament.game}</span>
              <span className="tournament-status">
                {tournament.status === 'planned'
                  ? 'PLANIFICADO'
                  : tournament.status.toUpperCase()}
              </span>
            </div>

            <h3>{tournament.name}</h3>

            <p>{tournament.format || 'Formato por definir'}</p>

            <div className="tournament-card-details">
              <span>
                {tournament.starts_at
                  ? new Date(tournament.starts_at).toLocaleString('es-ES')
                  : 'Fecha pendiente'}
              </span>

              <span>
                {tournament.max_participants
                  ? `${tournament.max_participants} plazas`
                  : 'Sin límite de plazas'}
              </span>
            </div>

           {['admin', 'staff'].includes(profile?.role) && (
  <button
    type="button"
    className="secondary-button"
    onClick={() => {
      setSelectedTournament(tournament);
      loadTournamentRegistrations(tournament.id);
    }}
  >
    GESTIONAR INSCRIPCIONES
  </button>
)}

{(() => {
  const registration = myRegistrations.find(
    (item) => item.tournament_id === tournament.id
  );

  const registrationOpen =
    tournament.status === 'planned' &&
    tournament.registration_enabled !== false &&
    (!tournament.registration_opens_at ||
      Date.now() >= new Date(tournament.registration_opens_at).getTime()) &&
    (!tournament.registration_closes_at ||
      Date.now() <= new Date(tournament.registration_closes_at).getTime());

  if (registration?.status === 'pending') {
    return (
      <button type="button" className="secondary-button" disabled>
        SOLICITUD PENDIENTE
      </button>
    );
  }

  if (registration?.status === 'approved') {
    return (
      <button type="button" className="secondary-button" disabled>
        INSCRIPCIÓN APROBADA
      </button>
    );
  }

  if (registration?.status === 'rejected') {
    return (
      <button type="button" className="secondary-button" disabled>
        INSCRIPCIÓN RECHAZADA
      </button>
    );
  }

  return (
    <button
      type="button"
      className="primary-button"
      disabled={!registrationOpen || registeringTournament === tournament.id}
      onClick={() => handleRegisterTournament(tournament.id)}
    >
      {registeringTournament === tournament.id
        ? 'ENVIANDO...'
        : registrationOpen
          ? 'INSCRIBIRME'
          : 'INSCRIPCIONES CERRADAS'}
    </button>
  );
})()}
          </article>
        ))}
      </div>
    )}

  </section>
)}
{selectedTournament && (
  <div className="admin-modal-overlay">
    <section className="admin-modal tournament-registrations-modal">

      <button
        type="button"
        className="admin-modal-close"
        onClick={() => {
          setSelectedTournament(null);
          setTournamentRegistrations([]);
          setRegistrationError('');
          setRegistrationsStatus('idle');
        }}
      >
        ✕
      </button>

      <div className="eyebrow">
        KURAMI E-SPORTS · REGISTRATION MANAGEMENT
      </div>

      <h2>{selectedTournament.name}</h2>

      <p>
        {selectedTournament.game} · {selectedTournament.format || 'Formato por definir'}
      </p>

      <div className="registration-summary">
        <span>Solicitudes recibidas</span>
        <strong>{tournamentRegistrations.length}</strong>
      </div>

      {registrationsStatus === 'loading' && (
        <p className="tournament-message">
          Cargando inscripciones...
        </p>
      )}

      {registrationsStatus === 'error' && (
        <p className="tournament-error">
          {registrationError || 'No se pudieron cargar las inscripciones.'}
        </p>
      )}

      {registrationsStatus === 'success' && tournamentRegistrations.length === 0 && (
        <p className="tournament-message">
          Todavía no hay solicitudes de inscripción.
        </p>
      )}

      {registrationsStatus === 'success' && tournamentRegistrations.length > 0 && (
        <div className="registration-list">
          {tournamentRegistrations.map((registration) => {
            const player = registration.player;

            const playerName =
              player?.nickname ||
              player?.display_name ||
              [player?.first_name, player?.last_name].filter(Boolean).join(' ') ||
              player?.username ||
              'Jugador sin nombre';

            return (
              <article
                className="registration-card"
                key={registration.id}
              >
                <div className="registration-player">
                  {player?.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt=""
                      className="registration-avatar"
                    />
                  ) : (
                    <div className="registration-avatar registration-avatar-placeholder">
                      {playerName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <strong>{playerName}</strong>
                    <span>
                      {player?.username
                        ? `@${player.username}`
                        : 'Sin nombre de usuario'}
                    </span>
                  </div>
                </div>

                <div className="registration-actions">

  <span className={`registration-status status-${registration.status}`}>
    {registration.status === 'pending'
      ? 'PENDIENTE'
      : registration.status === 'approved'
        ? 'APROBADA'
        : registration.status === 'rejected'
          ? 'RECHAZADA'
          : 'RETIRADA'}
  </span>

  {registration.status === 'pending' && (
    <div className="registration-buttons">

      <button
        type="button"
        className="registration-approve"
        disabled={registrationActionLoading === registration.id}
        onClick={() => handleReviewRegistration(registration.id, 'approved')}
      >
        {registrationActionLoading === registration.id
          ? 'PROCESANDO...'
          : 'APROBAR'}
      </button>

      <button
        type="button"
        className="registration-reject"
        disabled={registrationActionLoading === registration.id}
        onClick={() => handleReviewRegistration(registration.id, 'rejected')}
      >
        RECHAZAR
      </button>

    </div>
  )}

</div>
              </article>
            );
          })}
        </div>
      )}

    </section>
  </div>
)}

      {active === 'jugadores' && (
        <section className="players-section">
          <div className="section-heading">
            <h2>Jugadores Kurami</h2>
            <span>{players.length} MIEMBROS</span>
          </div>

          <input
            className="player-search"
            type="search"
            placeholder="Buscar jugador..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {playersStatus === 'loading' && (
            <EmptyState icon="👥" title="Cargando jugadores"
              text="Consultando los perfiles de Kurami..." />
          )}

          {playersStatus === 'error' && (
            <EmptyState icon="⚠️" title="Error al cargar jugadores"
              text={playersError} />
          )}

          {playersStatus === 'success' && filteredPlayers.length === 0 && (
            <EmptyState icon="🔎" title="No hay jugadores"
              text={players.length === 0
                ? 'Todavía no hay miembros registrados.'
                : 'No encontramos resultados para tu búsqueda.'} />
          )}

          {playersStatus === 'success' && filteredPlayers.length > 0 && (
            <div className="players-grid">
              {filteredPlayers.map((player, index) => (
                <article className="player-card"
                  key={player.telegram_id || index}>
                  <div className="player-avatar">
                    {player.photo_url
                      ? <img src={player.photo_url} alt="" />
                      : <span>
                          {(player.nickname || player.first_name || 'K')
                            .charAt(0).toUpperCase()}
                        </span>}
                  </div>

                  <div className="player-info">
                    <strong>
                      {player.nickname ||
                        player.display_name ||
                        [player.first_name, player.last_name]
                          .filter(Boolean).join(' ') ||
                        'Jugador Kurami'}
                    </strong>
                    <small>
                      {player.username ? `@${player.username}` : 'Miembro Kurami'}
                    </small>
                    {player.specialty && <small>{player.specialty}</small>}
                    <span className={`player-role role-${player.role}`}>
                      {roleLabels[player.role] || 'JUGADOR'}
                    </span>
                  </div>
                                    <button
                    type="button"
                    className="admin-detail-button"
                    onClick={() => setSelectedPlayer(player)}
                  >
                    Ver perfil completo
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

     
{active === 'ranking' && (
  <section className="ranking-section">

    <div className="eyebrow">
      KURAMI E-SPORTS · COMPETITIVE RANKING
    </div>

    <div className="section-heading">
      <h2>RANKING KURAMI</h2>
      <p>Clasificación competitiva de nuestros jugadores</p>
    </div>

    {statsStatus === 'loading' && (
      <p className="ranking-message">
        Cargando clasificación...
      </p>
    )}

    {statsStatus === 'error' && (
      <p className="ranking-message">
        No se pudo cargar el ranking. Vuelve a intentarlo.
      </p>
    )}

    {statsStatus === 'success' && playerStats.length === 0 && (
      <p className="ranking-message">
        Todavía no hay jugadores registrados.
      </p>
    )}

    {statsStatus === 'success' && playerStats.length > 0 && (
      <div className="ranking-list">

        {playerStats.map((player) => (
          <article
            className="ranking-card"
            key={player.telegram_id}
          >

            <div className="ranking-position">
              #{player.ranking_position}
            </div>

            <div className="player-avatar">
              {player.photo_url ? (
                <img src={player.photo_url} alt="" />
              ) : (
                <span>
                  {(player.nickname || player.first_name || 'K')
                    .charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="ranking-player-info">
              <strong>
                {player.nickname ||
                  player.display_name ||
                  player.first_name ||
                  'Jugador Kurami'}
              </strong>

              <small>
                {player.specialty || 'Sin especialidad'}
              </small>

              <small>
                {player.wins}V · {player.losses}D · {player.draws}E
              </small>
            </div>

            <div className="ranking-points">
              <strong>
                {Number(player.total_points).toFixed(2)}
              </strong>
              <small>PTS</small>
            </div>

          </article>
        ))}

      </div>
    )}

  </section>
)}


      
{active === 'admin' && (
  <section className="admin-section">

    {!isAdmin && (
      <EmptyState
        icon="🔒"
        title="Acceso restringido"
        text="No tienes permisos para acceder a esta sección."
      />
    )}

    {isAdmin && (
      <>
        <header className="admin-header">
          <div className="eyebrow">KURAMI E-SPORTS · CONTROL CENTER</div>
          <h1>Administración</h1>
          <p>
            Gestiona los miembros, supervisa los roles y administra
            la comunidad Kurami.
          </p>
          <div className="dragon-line">
            AWAKEN THE <b>DRAGON'S SOUL</b>
          </div>
        </header>

        <div className="section-heading">
          <h2>Resumen general</h2>
          <span>COMUNIDAD</span>
        </div>

        <div className="admin-stats">
          <div className="admin-stat">
            <strong>{adminStats.total}</strong>
            <span>Miembros totales</span>
          </div>

          <div className="admin-stat">
            <strong>{adminStats.players}</strong>
            <span>Jugadores</span>
          </div>

          <div className="admin-stat">
            <strong>{adminStats.staff}</strong>
            <span>Staff</span>
          </div>

          <div className="admin-stat">
            <strong>{adminStats.admins}</strong>
            <span>Administradores</span>
          </div>
        </div>

        <div className="section-heading">
          <h2>Miembros registrados</h2>
          <span>{filteredAdminMembers.length} RESULTADOS</span>
        </div>

        <div className="admin-toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="Buscar por nombre, usuario o especialidad..."
            value={adminSearch}
            onChange={(event) => setAdminSearch(event.target.value)}
          />

          <div className="admin-filters">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'admin', label: 'Administradores' },
              { id: 'staff', label: 'Staff' },
              { id: 'player', label: 'Jugadores' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={
                  adminRoleFilter === filter.id
                    ? 'admin-filter active'
                    : 'admin-filter'
                }
                onClick={() => setAdminRoleFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {adminStatus === 'loading' && (
          <div className="admin-status">
            Cargando miembros de Kurami...
          </div>
        )}

        {adminStatus === 'error' && (
          <div className="admin-error">
            No se pudo cargar el panel: {adminError}
          </div>
        )}

        {adminStatus === 'success' && filteredAdminMembers.length === 0 && (
          <EmptyState
            icon="🔎"
            title="Sin resultados"
            text="No hay miembros que coincidan con los filtros."
          />
        )}

        {adminStatus === 'success' && filteredAdminMembers.length > 0 && (
          <div className="admin-member-list">
            {filteredAdminMembers.map((member) => {
              const memberName =
                member.nickname ||
                member.display_name ||
                [member.first_name, member.last_name]
                  .filter(Boolean).join(' ') ||
                'Miembro Kurami';

              const isCurrentAdmin =
                String(member.telegram_id) === String(profile?.telegram_id);

              return (
                <article
                  className="admin-member"
                  key={member.telegram_id}
                >
                  <div className="player-avatar">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt="" />
                    ) : (
                      <span>
                        {memberName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="admin-member-info">
                    <strong>{memberName}</strong>

                    <small>
                      {member.username
                        ? `@${member.username}`
                        : 'Miembro Kurami'}
                    </small>

                    {member.specialty && (
                      <small>{member.specialty}</small>
                    )}

                    <span className={`player-role role-${member.role}`}>
                      {roleLabels[member.role] || member.role}
                    </span>

                    {isCurrentAdmin ? (
                      <span className="admin-current-label">
                        TU CUENTA · ADMINISTRADOR ACTUAL
                      </span>
                    ) : (
                      <label className="admin-role-wrap">
                        <span>Cambiar permisos</span>

                        <select
                          className="admin-role-control"
                          value={member.role}
                          disabled={adminSavingId === member.telegram_id}
                          onChange={(event) =>
                            changeMemberRole(member, event.target.value)
                          }
                        >
                          <option value="player">Jugador</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                    )}

                                        {adminSavingId === member.telegram_id && (
                      <small>Actualizando permisos...</small>
                    )}

                    <button
                      type="button"
                      className="admin-detail-button"
                      onClick={() => setSelectedMember(member)}
                    >
                      Ver ficha completa
                    </button>
                  </div>
                </article>
              );
                       })}
          </div>
        )}

        {adminMessage && (
          <div className="admin-message">{adminMessage}</div>
        )}

        {adminError && adminStatus === 'success' && (
          <div className="admin-error">{adminError}</div>
        )}
      </>
    )}
  </section>
)}
      {selectedMember && (
  <div className="admin-modal-overlay">
    <section className="admin-modal public-player-modal">

      <button
        type="button"
        className="admin-modal-close"
        onClick={() => setSelectedMember(null)}
      >
        ✕
      </button>

      <div className="eyebrow">KURAMI E-SPORTS · MEMBER PROFILE</div>

      <div className="admin-modal-profile">
        <div className="player-avatar">
          {selectedMember.photo_url ? (
            <img src={selectedMember.photo_url} alt="" />
          ) : (
            <span>
              {(selectedMember.nickname ||
                selectedMember.first_name ||
                'K').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        
        <h2>
          {selectedMember.nickname ||
            selectedMember.display_name ||
            [selectedMember.first_name, selectedMember.last_name]
              .filter(Boolean).join(' ') ||
            'Miembro Kurami'}
        </h2>

        <span className={`player-role role-${selectedMember.role}`}>
          {roleLabels[selectedMember.role] || selectedMember.role}
        </span>
      </div>
            {editingMember && (
        <div className="admin-modal-details admin-member-editor">
          <div>
            <small>NICKNAME COMPETITIVO</small>
            <input
              type="text"
              maxLength={40}
              value={memberNickname}
              onChange={(event) => setMemberNickname(event.target.value)}
              placeholder="Nickname del jugador"
            />
          </div>

          <div>
            <small>ESPECIALIDAD</small>
            <select
              value={memberSpecialty}
              onChange={(event) => setMemberSpecialty(event.target.value)}
            >
              <option value="">Sin especificar</option>
              <option value="VGC">Pokémon VGC</option>
              <option value="TCG">Pokémon TCG</option>
              <option value="Pokémon GO">Pokémon GO</option>
              <option value="Unite">Pokémon UNITE</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div>
            <small>BIOGRAFÍA</small>
            <textarea
              maxLength={300}
              rows={4}
              value={memberBio}
              onChange={(event) => setMemberBio(event.target.value)}
              placeholder="Biografía del miembro..."
            />
            <small>{memberBio.length}/300 caracteres</small>
          </div>

          {memberSaveMessage && (
            <p className="save-message">{memberSaveMessage}</p>
          )}

          <button
            type="button"
            className="admin-detail-button"
            disabled={memberSaving}
            onClick={saveMemberProfile}
          >
            {memberSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <button
            type="button"
            className="admin-detail-button"
            disabled={memberSaving}
            onClick={() => {
              setEditingMember(false);
              setMemberSaveMessage('');
            }}
          >
            Cancelar edición
          </button>
        </div>
      )}
            {!editingMember && memberSaveMessage && (
        <p className="save-message">{memberSaveMessage}</p>
      )}
      {!editingMember && (
        <div className="admin-modal-details">

          <div>
            <small>USUARIO DE TELEGRAM</small>
            <strong>
              {selectedMember.username
                ? `@${selectedMember.username}`
                : 'No disponible'}
            </strong>
          </div>

          <div>
            <small>NOMBRE</small>
            <strong>
              {[selectedMember.first_name, selectedMember.last_name]
                .filter(Boolean).join(' ') || 'No disponible'}
            </strong>
          </div>

          <div>
            <small>ESPECIALIDAD</small>
            <strong>{selectedMember.specialty || 'Sin especificar'}</strong>
          </div>

          <div>
            <small>FECHA DE REGISTRO</small>
            <strong>
              {selectedMember.created_at
                ? new Date(selectedMember.created_at).toLocaleDateString(
                    'es-ES',
                    { day: '2-digit', month: 'long', year: 'numeric' }
                  )
                : 'No disponible'}
            </strong>
          </div>

          <div className="admin-modal-bio">
            <small>BIOGRAFÍA</small>
            <p>
              {selectedMember.bio || 'Este miembro todavía no tiene biografía.'}
            </p>
          </div>

        </div>
      )}

            {!editingMember && (
        <button
          type="button"
          className="admin-detail-button"
          onClick={() => startEditingMember(selectedMember)}
        >
          ✎ Editar perfil
        </button>
      )}

      <button
        type="button"
        className="admin-detail-button"
        onClick={() => {
          setEditingMember(false);
          setSelectedMember(null);
          setMemberSaveMessage('');
        }}
      >
        Cerrar ficha
      </button>

    </section>
  </div>
)}
      {selectedPlayer && (
  <div className="admin-modal-overlay">
   <section className="admin-modal public-player-modal">
     
      <button
        type="button"
        className="admin-modal-close"
        onClick={() => setSelectedPlayer(null)}
      >
        ✕
      </button>

      <div className="eyebrow">
        KURAMI E-SPORTS · PLAYER PROFILE
      </div>

      <div className="admin-modal-profile">

        <div className="player-avatar">
          {selectedPlayer.photo_url ? (
            <img src={selectedPlayer.photo_url} alt="" />
          ) : (
            <span>
              {(selectedPlayer.nickname ||
                selectedPlayer.first_name ||
                'K').charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <h2>
          {selectedPlayer.nickname ||
            selectedPlayer.display_name ||
            [selectedPlayer.first_name, selectedPlayer.last_name]
              .filter(Boolean).join(' ') ||
            'Jugador Kurami'}
        </h2>

        <span className={`player-role role-${selectedPlayer.role}`}>
          {roleLabels[selectedPlayer.role] || 'JUGADOR'}
        </span>

      </div>

      <div className="admin-modal-details">

        <div>
          <small>NOMBRE</small>
          <strong>
            {[selectedPlayer.first_name, selectedPlayer.last_name]
              .filter(Boolean).join(' ') || 'No disponible'}
          </strong>
        </div>

        <div>
          <small>USUARIO DE TELEGRAM</small>
          <strong>
            {selectedPlayer.username
              ? `@${selectedPlayer.username}`
              : 'No disponible'}
          </strong>
        </div>

        <div>
          <small>ESPECIALIDAD</small>
          <strong>
            {selectedPlayer.specialty || 'Sin especificar'}
          </strong>
        </div>

        <div className="admin-modal-bio">
          <small>BIOGRAFÍA</small>
          <p>
            {selectedPlayer.bio ||
              'Este jugador todavía no tiene biografía.'}
          </p>
        </div>

      </div>

      <button
        type="button"
        className="admin-detail-button"
        onClick={() => setSelectedPlayer(null)}
      >
        Cerrar perfil
      </button>

    </section>
  </div>
)}

      <nav className="bottom-nav">
        {navigation.map(item => (
          <button
            key={item.id}
            className={active === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => setActive(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <footer>KURAMI E-SPORTS · COMMUNITY HUB</footer>
    </main>
  );
}

function Feature({ icon, title, desc, onClick }) {
  return (
    <button className="feature-card" onClick={onClick}>
      <span className="feature-icon">{icon}</span>
      <strong>{title}</strong>
      <small>{desc}</small>
      <span className="card-arrow">↗</span>
    </button>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <section className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <span className="coming-soon">KURAMI E-SPORTS</span>
    </section>
  );
}
