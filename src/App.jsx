
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
    <section className="admin-modal">

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
          <p>{selectedMember.bio || 'Este miembro todavía no tiene biografía.'}</p>
        </div>
              )}

      </div>

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
