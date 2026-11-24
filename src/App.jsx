
import { useEffect, useState } from 'react';

const sections = [
  { id: 'inicio', icon: '⌂', label: 'Inicio' },
  { id: 'torneos', icon: '🏆', label: 'Torneos' },
  { id: 'jugadores', icon: '👥', label: 'Jugadores' },
  { id: 'ranking', icon: '📊', label: 'Ranking' },
];

export default function App() {
  const [active, setActive] = useState('inicio');
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      const tg = window.Telegram?.WebApp;

      if (!tg?.initData) {
        setStatus('telegram-required');
        return;
      }

      tg.ready();
      tg.expand();

      try {
        const response = await fetch('/api/telegram-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initData: tg.initData,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'No se pudo verificar Telegram');
        }

        if (!cancelled) {
          setProfile(result.profile);
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

  const name =
    profile?.display_name ||
    profile?.first_name ||
    'Entrenador';

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

        <h1>
          Bienvenido,<br />
          <span>{name}</span>
        </h1>

        <p>Tu comunidad competitiva</p>

        <div className="dragon-line">
          KURAMI <b>✦</b> COMPETITIVE POKÉMON
        </div>
      </section>

      <section className="notice">
        {status === 'loading' && (
          <div>
            <strong>Verificando tu cuenta...</strong>
            <p>Estamos conectando con Telegram y Kurami.</p>
          </div>
        )}

        {status === 'authenticated' && (
          <div>
            <strong>Cuenta verificada</strong>
            <p>
              Bienvenido a Kurami.
              {profile?.username
                ? ` Usuario: @${profile.username}`
                : ''}
            </p>
            <p>Rol: {profile.role}</p>
          </div>
        )}

        {status === 'telegram-required' && (
          <div>
            <strong>Abre Kurami desde Telegram</strong>
            <p>
              Para identificarte y cargar tu perfil,
              utiliza el botón KURAMI E-SPORTS de nuestro bot.
            </p>
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
            <Feature
              icon="🏆"
              title="Torneos"
              desc="Eventos e inscripciones"
              onClick={() => setActive('torneos')}
            />

            <Feature
              icon="👥"
              title="Jugadores"
              desc="Miembros de Kurami"
              onClick={() => setActive('jugadores')}
            />

            <Feature
              icon="📊"
              title="Rankings"
              desc="Clasificaciones"
              onClick={() => setActive('ranking')}
            />

            <Feature
              icon="🐉"
              title="Pokédex"
              desc="Próximamente"
              onClick={() => {}}
            />
          </div>

          <section className="notice">
            <span className="notice-icon">✦</span>
            <div>
              <strong>La comunidad Kurami</strong>
              <p>
                Un espacio para aprender, competir y crecer juntos.
              </p>
            </div>
          </section>
        </>
      )}

      {active === 'torneos' && (
        <EmptyState
          icon="🏆"
          title="Próximos torneos"
          text="Aquí publicaremos eventos, fechas e inscripciones."
        />
      )}

      {active === 'jugadores' && (
        <EmptyState
          icon="👥"
          title="Jugadores Kurami"
          text="Aquí aparecerán los perfiles de los miembros."
        />
      )}

      {active === 'ranking' && (
        <EmptyState
          icon="📊"
          title="Ranking Kurami"
          text="Aquí mostraremos clasificaciones y resultados."
        />
      )}

      <nav className="bottom-nav">
        {sections.map(item => (
          <button
            key={item.id}
            className={
              active === item.id ? 'nav-item active' : 'nav-item'
            }
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
      <span className="coming-soon">MÓDULO EN PREPARACIÓN</span>
    </section>
  );
}
