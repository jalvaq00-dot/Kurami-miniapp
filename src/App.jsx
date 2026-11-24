
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
  const [adminSavingId, setAdminSavingId] = useState(null);

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

    return fullName.includes(term);
  });

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
        <EmptyState icon="🏆" title="Próximos torneos"
          text="Aquí publicaremos eventos, fechas e inscripciones." />
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
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {active === 'ranking' && (
        <EmptyState icon="📊" title="Ranking Kurami"
          text="Aquí mostraremos clasificaciones y resultados." />
      )}

      {active === 'admin' && (
        <section className="players-section">
          <div className="section-heading">
            <h2>Administración</h2>
            <span>PANEL ADMIN</span>
          </div>

          {!isAdmin && (
            <EmptyState icon="🔒" title="Acceso restringido"
              text="No tienes permisos para acceder a esta sección." />
          )}

          {isAdmin && (
            <>
              <section className="notice">
                <div>
                  <strong>Gestión de miembros Kurami</strong>
                  <p>
                    Puedes consultar los miembros y modificar sus roles.
                    Los cambios se verifican en el servidor.
                  </p>
                </div>
              </section>

              <div className="section-heading">
                <h2>Miembros registrados</h2>
                <span>{adminMembers.length} MIEMBROS</span>
              </div>

              <input
                className="player-search"
                type="search"
                placeholder="Buscar miembro..."
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
              />

              {adminStatus === 'loading' && (
                <EmptyState icon="⏳" title="Cargando miembros"
                  text="Consultando la base de datos de Kurami..." />
              )}

              {adminStatus === 'error' && (
                <EmptyState icon="⚠️" title="No se pudo cargar el panel"
                  text={adminError} />
              )}

              {adminStatus === 'success' && filteredAdminMembers.length === 0 && (
                <EmptyState icon="🔎" title="Sin resultados"
                  text="No hay miembros que coincidan con la búsqueda." />
              )}

              {adminStatus === 'success' && filteredAdminMembers.length > 0 && (
                <div className="players-grid">
                  {filteredAdminMembers.map((member) => (
                    <article className="player-card" key={member.telegram_id}>
                      <div className="player-avatar">
                        {member.photo_url
                          ? <img src={member.photo_url} alt="" />
                          : <span>
                              {(member.nickname || member.first_name || 'K')
                                .charAt(0).toUpperCase()}
                            </span>}
                      </div>

                      <div className="player-info">
                        <strong>
                          {member.nickname ||
                            member.display_name ||
                            [member.first_name, member.last_name]
                              .filter(Boolean).join(' ') ||
                            'Miembro Kurami'}
                        </strong>

                        <small>
                          {member.username
                            ? `@${member.username}`
                            : 'Miembro Kurami'}
                        </small>

                        {member.specialty && <small>{member.specialty}</small>}

                        <span className={`player-role role-${member.role}`}>
                          {roleLabels[member.role] || member.role}
                        </span>

                        {member.telegram_id === profile?.telegram_id ? (
                          <small>Tu cuenta · Administrador actual</small>
                        ) : (
                          <label className="admin-role-control">
                            Cambiar rol
                            <select
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
                          <small>Actualizando rol...</small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {adminMessage && (
                <p className="save-message">{adminMessage}</p>
              )}

              {adminError && adminStatus === 'success' && (
                <p className="save-message">{adminError}</p>
              )}
            </>
          )}
        </section>
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
