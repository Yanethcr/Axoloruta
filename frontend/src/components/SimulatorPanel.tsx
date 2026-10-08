'use client';
import { useEffect, useState } from 'react';

const DEMO_HUBS = [
  { id: 'demo-1', name: 'Hub Centro', free: true },
  { id: 'demo-2', name: 'Hub Norte', free: false },
  { id: 'demo-3', name: 'Hub Sur', free: true },
  { id: 'demo-4', name: 'Hub Poniente', free: false },
];

export default function SimulatorPanel({ compact = false }: { compact?: boolean }) {
  const [hubs, setHubs] = useState(DEMO_HUBS);
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      const change = index++ % DEMO_HUBS.length;
      setHubs((previous) => previous.map((hub, i) => i === change ? { ...hub, free: !hub.free } : hub));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  return <section className={'card hub-availability' + (compact ? ' compact' : '')} aria-label="Disponibilidad simulada de hubs">
    <div className="hub-availability-heading"><h2>Disponibilidad de hubs</h2><span className="pill sun">Datos simulados</span></div>
    <div className="hub-availability-grid" aria-live="polite" aria-atomic="true">
      {hubs.map((hub) => <article className={'hub-availability-item ' + (hub.free ? 'free' : 'occupied')} key={hub.id}>
        <span className={'simulator-pin ' + (hub.free ? 'free' : 'occupied')} aria-hidden="true">ϟ</span>
        <div><h3>{hub.name}</h3><span className={'hub-state ' + (hub.free ? 'free' : 'occupied')}>{hub.free ? 'Libre' : 'Ocupado'}</span></div>
      </article>)}
    </div>
    <p className="note">Hubs de ejemplo. Sus estados cambian automáticamente cada 30 segundos.</p>
  </section>;
}
