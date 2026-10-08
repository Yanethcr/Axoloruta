'use client';

import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Brand from '@/components/Brand';
import type { Car, OcmPoint, OcmResponse, OcmStation, OcmStatus } from '@/lib/types';

const POLL_MS = 60_000;
const simulatedFree = (stationId: number, index: number, tick: number) => (Math.abs(stationId) + index + tick) % 3 !== 0;

/** Referencias para centrar el mapa en las 16 alcaldías, no límites administrativos. */
const PLACES: { name: string; pos: [number, number] }[] = [
  { name: 'Coyoacán (Centro)', pos: [19.3467, -99.1617] },
  { name: 'Tlalpan (Centro)', pos: [19.2925, -99.167] },
  { name: 'Xochimilco (Centro)', pos: [19.2576, -99.103] },
  { name: 'Tláhuac (Centro)', pos: [19.2867, -99.0044] },
  { name: 'Álvaro Obregón (San Ángel)', pos: [19.3467, -99.1903] },
  { name: 'Azcapotzalco', pos: [19.484, -99.185] },
  { name: 'Benito Juárez', pos: [19.3806, -99.1615] },
  { name: 'Cuajimalpa de Morelos', pos: [19.3558, -99.2998] },
  { name: 'Cuauhtémoc', pos: [19.4326, -99.1332] },
  { name: 'Gustavo A. Madero', pos: [19.4829, -99.1131] },
  { name: 'Iztacalco', pos: [19.3953, -99.0978] },
  { name: 'Iztapalapa', pos: [19.357, -99.093] },
  { name: 'La Magdalena Contreras', pos: [19.3047, -99.241] },
  { name: 'Miguel Hidalgo', pos: [19.4069, -99.1917] },
  { name: 'Milpa Alta', pos: [19.192, -99.023] },
  { name: 'Venustiano Carranza', pos: [19.43, -99.098] },
];
const MY_LOCATION = 'mine';

const STATUS: Record<OcmStatus, { label: string; css: string; pill: string }> = {
  available: { label: 'Disponible', css: '--ok', pill: 'ok' },
  inuse: { label: 'En uso', css: '--busy', pill: 'busy' },
  unavailable: { label: 'No disponible', css: '--bad', pill: 'bad' },
  operational: { label: 'En operación', css: '--teal', pill: 't' },
  unknown: { label: 'Sin dato de disponibilidad', css: '--muted', pill: '' },
};

const hav = (a: number, b: number, c: number, d: number) =>
  Math.hypot((d - b) * 111320 * Math.cos(((a + c) * Math.PI) / 360), (c - a) * 111320);
const km = (m: number) => (m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');
const duration = (min: number) =>
  min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' min';

/**
 * Potencia con la que cargaría tu auto en un punto: el menor valor entre el cargador y lo que
 * acepta el auto en AC o DC. 0 = no es compatible. null = el punto no dice si es AC o DC.
 */
function carKw(car: Car | undefined, p: OcmPoint): number | null {
  if (!car || p.kw === null || p.kind === null) return null;
  return Math.min(p.kw, p.kind === 'AC' ? car.acKw : car.dcKw);
}

/** Minutos para pasar de la batería actual al 80 %, con potencia constante. */
function minutesTo80(car: Car, soc: number, kw: number): number | null {
  if (soc >= 80 || kw <= 0) return null;
  return Math.max(1, Math.round(((car.batteryKwh * (80 - soc)) / 100 / kw) * 60));
}

/** ¿La estación tiene al menos un punto que le sirva a tu auto (o que no se pueda saber)? */
function fits(car: Car | undefined, st: OcmStation): boolean {
  if (!car) return true;
  return st.points.some((p) => {
    const k = carKw(car, p);
    return k === null || k > 0;
  });
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? 'Error de servidor');
  return data as T;
}

export default function DondeCargo() {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState('');
  const [ocm, setOcm] = useState<OcmResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState('leaf');
  const [soc, setSoc] = useState(20);
  const [onlyFits, setOnlyFits] = useState(false);
  const [place, setPlace] = useState('0');
  const [mine, setMine] = useState<[number, number] | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [openSt, setOpenSt] = useState<number | null>(null);
  const [availabilityTick, setAvailabilityTick] = useState(0);
  const [fastOnly, setFastOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<OcmStation | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);

  const car = cars.find((c) => c.id === carId);
  const pos: [number, number] = place === MY_LOCATION && mine ? mine : (PLACES[+place]?.pos ?? PLACES[0].pos);
  useEffect(() => {
    const timer = setInterval(() => setAvailabilityTick((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Catálogo de autos (una sola vez)
  useEffect(() => {
    api<Car[]>('/api/cars')
      .then(setCars)
      .catch(() => undefined);
  }, []);

  // Electrolineras de Open Charge Map
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await api<OcmResponse>('/api/ocm');
        if (!alive) return;
        setOcm(d);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoMsg('Tu navegador no permite obtener la ubicación.');
      return;
    }
    setGeoMsg('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMine([p.coords.latitude, p.coords.longitude]);
        setPlace(MY_LOCATION);
        setGeoMsg('');
      },
      () => setGeoMsg('No pudimos obtener tu ubicación. Elige una zona de la lista.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const results = (ocm?.stations ?? [])
    .filter((st) => !onlyFits || fits(car, st))
    .filter((st) => !fastOnly || st.points.some((p) => p.kind === 'DC'))
    .map((st) => ({ st, d: hav(pos[0], pos[1], st.lat, st.lon) }))
    .sort((a, b) => a.d - b.d);
  const near = results.slice(0, visibleCount);
  const center = selected ? [selected.lat, selected.lon] : pos;
  const mapUrl = `https://map.openchargemap.io/?mode=embedded&latitude=${center[0]}&longitude=${center[1]}`;
  useEffect(() => { setSelected(null); }, [place, mine]);
  useEffect(() => { setVisibleCount(20); }, [fastOnly, onlyFits, carId, place]);
  useEffect(() => { setMapLoading(true); }, [mapUrl]);
  const showOnMap = (st: OcmStation) => {
    setSelected(st); setMobileView('map');
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectStyle = {
    font: 'inherit',
    padding: '8px',
    borderRadius: 8,
    border: '1px solid var(--line)',
    background: 'var(--app)',
    color: 'var(--ink)',
  } as const;

  const renderBody = () => {
    if (!ocm)
      return <p className="note">{offline ? 'Sin conexión con el servidor. Reintentando…' : 'Cargando electrolineras…'}</p>;
    if (!ocm.configured)
      return (
        <div className="card" style={{ borderColor: 'var(--solar)' }}>
          <b>Falta la llave de Open Charge Map</b>
          <span className="note">
            Crea el archivo backend/.env con OCM_API_KEY=tu_llave y reinicia el servidor. La llave es gratuita en
            openchargemap.org (Mi perfil, Mis aplicaciones). Para ver la pantalla con estaciones de ejemplo, usa
            OCM_DEMO=true en ese mismo archivo.
          </span>
        </div>
      );
    if (ocm.error && !ocm.stations.length)
      return (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <b>No se pudieron cargar las estaciones</b>
          <span className="note">{ocm.error}</span>
        </div>
      );
    return (
      <>
        {ocm.demo && (
          <div className="card" style={{ borderColor: 'var(--solar)' }}>
            <b>Modo demostración</b>
            <span className="note">Estas estaciones son de ejemplo, no son datos reales de Open Charge Map.</span>
          </div>
        )}
        <h2 className="h2">Estaciones por cercanía</h2>
        {near.length === 0 && (
          <div className="card"><b>No encontramos estaciones con esos filtros</b><p className="note">Amplía los filtros para ver más estaciones.</p><button className="chip" onClick={() => { setFastOnly(false); setOnlyFits(false); }}>Limpiar filtros</button></div>
        )}
        <ul className="list">
          {near.map(({ st, d }, i) => {
            const m = STATUS[st.status];
            const open = openSt === st.id;
            const date = st.lastUpdate ? new Date(st.lastUpdate).toLocaleDateString('es-MX') : null;
            const free = st.points.filter((p) => simulatedFree(st.id, p.index, availabilityTick)).length;
            const occupied = st.points.length - free;
            return (
              <li key={st.id} className={'station-card' + (selected?.id === st.id ? ' selected' : '')}>
                <div className="hub" style={{ cursor: 'default' }}>
                  <span
                    className="pin"
                    style={{ background: 'var(--teal)', color: 'var(--teal-ink)', borderRadius: '50%', transform: 'none' }}
                  >
                    <span style={{ transform: 'none' }}>{i + 1}</span>
                  </span>
                  <span>
                    <b>{st.title}</b>
                    <small>{[st.address, st.town].filter(Boolean).join(' · ') || 'Sin dirección'}</small>
                    <small>
                      {km(d)} en línea recta
                      {st.operator ? ' · ' + st.operator : ''}
                    </small>
                    <small>
                      {st.points.length} {st.points.length === 1 ? 'punto de carga' : 'puntos de carga'}
                      {st.maxKw ? ' · hasta ' + st.maxKw + ' kW' : ''}
                    </small>
                    <small>
                      {st.usageCost ? 'Costo según el operador: ' + st.usageCost : 'Costo: consultar con el operador'}
                    </small>
                    {date && <small>Estado reportado el {date}, puede estar desactualizado</small>}
                    <small>
                      <a
                        href={'https://www.google.com/maps/dir/?api=1&destination=' + st.lat + ',' + st.lon}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--teal)' }}
                      >
                        Cómo llegar ↗
                      </a>
                    </small>
                  </span>
                  <span className="r">
                    <span
                      className={'pill ' + m.pill}
                      style={m.pill ? undefined : { background: 'var(--soft)', color: 'var(--muted)' }}
                    >
                      {m.label}
                    </span>
                  </span>
                </div>
                <div className="station-availability" aria-label={`Disponibilidad simulada en ${st.title}`}>
                  <div className="station-availability-heading"><b>Hubs de esta electrolinera</b><span className="pill sun">Simulado</span></div>
                  <div className="station-availability-counts">
                    <span className="hub-state free"><strong>{free}</strong> {free === 1 ? 'libre' : 'libres'}</span>
                    <span className="hub-state occupied"><strong>{occupied}</strong> {occupied === 1 ? 'ocupado' : 'ocupados'}</span>
                  </div>
                  <p className="note">Ejemplo para los {st.points.length} puntos mostrados. Cambia cada 30 segundos.</p>
                </div>
                <button className="chip station-map-button" onClick={() => showOnMap(st)}>Ver en el mapa</button>
                <button
                  type="button"
                  className="chip"
                  aria-expanded={open}
                  onClick={() => setOpenSt(open ? null : st.id)}
                  style={{ margin: '0 0 10px 38px' }}
                >
                  {open ? 'Ocultar puntos de carga' : 'Ver los ' + st.points.length + ' puntos de carga'}
                </button>
                {open && (
                  <ul
                    className="list"
                    style={{ margin: '0 0 12px 38px', borderLeft: '2px solid var(--line)', paddingLeft: 12 }}
                  >
                    {st.points.map((p) => {
                      const k = carKw(car, p);
                      const t = car && k ? minutesTo80(car, soc, k) : null;
                      return (
                        <li key={p.index} style={{ padding: '7px 0' }}>
                          <b style={{ fontWeight: 500 }}>
                            Punto {p.index + 1} · {p.type}
                            {p.kw ? ' ' + p.kw + ' kW' : ''}
                            {p.kind ? ' (' + p.kind + ')' : ''}
                          </b>
                          <span className={'hub-state ' + (simulatedFree(st.id, p.index, availabilityTick) ? 'free' : 'occupied')}>
                            {simulatedFree(st.id, p.index, availabilityTick) ? 'Libre' : 'Ocupado'} · Simulado
                          </span>
                          {car && (
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: '.78rem' }}>
                              {k === null
                                ? 'No se sabe si es compatible con tu ' + car.name
                                : k === 0
                                  ? 'No es compatible con tu ' + car.name
                                  : soc >= 80
                                    ? 'Tu batería ya está en ' + soc + ' %'
                                    : 'Tu ' + car.name + ' tardaría unos ' + duration(t ?? 0) + ' del ' + soc + ' % al 80 %'}
                            </small>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {results.length > visibleCount && <button className="btn ghost" onClick={() => setVisibleCount((n) => n + 20)}>Mostrar más estaciones ({results.length - visibleCount})</button>}
        <p className="note">{ocm.attribution}.</p>
      </>
    );
  };

  return (
    <div className="shell explorer-shell">
      <main className="app explorer-app">
        <div className="top">
          <Brand />
          <h1>Dónde cargo</h1>
          <span className="hr">Ciudad de México</span>
          <button className="chip" onClick={async () => {
            try { await request('/api/auth/logout', {}); router.replace('/login'); }
            catch { setLogoutError('No se pudo cerrar sesión. Intenta de nuevo.'); }
          }}>Cerrar sesión</button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
        <div className="explorer-toolbar account-form">
          <label>Alcaldía · centrar mapa<select value={place} onChange={(e) => { setPlace(e.target.value); }}>
            {PLACES.map((p, i) => ({ ...p, index: i })).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((p) => <option key={p.name} value={String(p.index)}>{p.name}</option>)}
            {mine && <option value={MY_LOCATION}>Mi ubicación</option>}
          </select></label>
          <button type="button" className="chip" onClick={useMyLocation}>Usar mi ubicación</button>
          {geoMsg && <p className="note" role="status">{geoMsg}</p>}
        </div>
        <div className="mobile-view-switch" role="group" aria-label="Vista de estaciones">
          <button className="chip" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}>Mapa</button>
          <button className="chip" aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}>Lista · {results.length}</button>
        </div>
        <div className={'explorer-layout view-' + mobileView}>
          <aside className="explorer-sidebar" aria-label="Filtros y estaciones">
          <details className="card car-options">
            <summary>Mi auto y tiempo de carga</summary>
            <h2 className="h2">Mi auto</h2>
            <select aria-label="Modelo de auto" value={carId} onChange={(e) => setCarId(e.target.value)} style={selectStyle}>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · batería {c.batteryKwh} kWh
                </option>
              ))}
            </select>
            <div className="rowc">
              <label htmlFor="soc" className="note" style={{ minWidth: '7.5rem' }}>
                Batería ahora
              </label>
              <input
                id="soc"
                type="range"
                min={5}
                max={95}
                step={5}
                value={soc}
                onChange={(e) => setSoc(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--teal)' }}
              />
              <strong style={{ fontFamily: 'var(--f-mono)' }}>{soc} %</strong>
            </div>
            <button
              type="button"
              className="chip"
              aria-pressed={onlyFits}
              onClick={() => setOnlyFits((v) => !v)}
              style={{ alignSelf: 'flex-start' }}
            >
              Filtrar por potencia AC/DC de mi auto
            </button>
            <p className="note">Comprueba el tipo de conector antes de acudir: este filtro compara la potencia AC/DC.</p>
          </details>
          <div className="chips"><button className="chip" aria-pressed={fastOnly} onClick={() => setFastOnly((v) => !v)}>Carga DC</button><span className="pill t" role="status">{results.length} resultados</span></div>
          {renderBody()}
          </aside>
          <section className="explorer-map-panel" aria-label="Mapa de estaciones">
          <div className="map-actions">
            <div><h2>{selected ? selected.title : 'Explora las estaciones'}</h2><p className="note">{selected ? selected.address : 'Acerca el mapa y selecciona un punto para consultar sus detalles.'}</p></div>
            <button className="chip" onClick={() => setSelected(null)}>Centrar en mi zona</button>
            <button className="chip" onClick={async () => {
              try { if (document.fullscreenElement) await document.exitFullscreen(); else await mapRef.current?.requestFullscreen(); }
              catch { setMapError('Tu navegador no permite pantalla completa. Usa Abrir mapa.'); }
            }}>Pantalla completa</button>
            <a className="chip" href={mapUrl.replace('mode=embedded&', '')} target="_blank" rel="noreferrer">Abrir mapa ↗</a>
          </div>
          {mapError && <p className="note" role="status">{mapError}</p>}
          <div className="mapbox" ref={mapRef}>
            {mapLoading && <span className="map-loading" role="status">Cargando mapa…</span>}
            <iframe
              title="Mapa interactivo de electrolineras de Open Charge Map"
              src={mapUrl}
              allow="geolocation"
              allowFullScreen
              onLoad={() => setMapLoading(false)}
            />
          </div>
          <p className="note">
            Mapa de{' '}
            <a href="https://map.openchargemap.io/" target="_blank" rel="noreferrer">Open Charge Map</a>.
            {' '}Usa el buscador del mapa para encontrar lugares. Los filtros de esta lista se aplican solo a las estaciones descargadas.
          </p>
          </section>
        </div>
      </main>
    </div>
  );
}
