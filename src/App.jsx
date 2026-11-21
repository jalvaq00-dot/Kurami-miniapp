
import { useState } from 'react';

const sections = [
  { id: 'inicio', icon: '⌂', label: 'Inicio' },
  { id: 'torneos', icon: '🏆', label: 'Torneos' },
  { id: 'jugadores', icon: '👥', label: 'Jugadores' },
  { id: 'ranking', icon: '📊', label: 'Ranking' },
];

export default function App() {
  const [active, setActive] = useState('inicio');
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const name = user?.first_name || 'Entrenador';

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
              desc="Próximamente"
              onClick={() => {}} />
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

      {active === 'torneos' && (
        <EmptyState icon="🏆" title="Próximos torneos"
          text="Aquí publicaremos eventos, fechas e inscripciones." />
      )}

      {active === 'jugadores' && (
        <EmptyState icon="👥" title="Jugadores Kurami"
          text="Aquí aparecerán los perfiles de los miembros." />
      )}

      {active === 'ranking' && (
        <EmptyState icon="📊" title="Ranking Kurami"
          text="Aquí mostraremos clasificaciones y resultados." />
      )}

      <nav className="bottom-nav">
        {sections.map(item => (
          <button key={item.id}
            className={active === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => setActive(item.id)}>
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
        
