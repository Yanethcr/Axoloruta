import type { OcmPoint, OcmStation } from './ocm.service';

/**
 * Electrolineras de OpenStreetMap (amenity=charging_station) vía Overpass.
 * Es una fuente abierta y sin llave. La cobertura depende de lo que hayan
 * capturado los colaboradores, y no informa disponibilidad.
 */
const OVERPASS_HOSTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

export const OSM_ATTRIBUTION = 'Datos de OpenStreetMap, © colaboradores de OpenStreetMap (licencia ODbL)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tags = Record<string, string>;
interface Element {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Tipos de socket de OpenStreetMap: etiqueta, corriente y potencia típica si no la declaran. */
const SOCKETS: Record<string, { label: string; kind: 'AC' | 'DC' | null }> = {
  type2: { label: 'Tipo 2', kind: 'AC' },
  type2_combo: { label: 'CCS', kind: 'DC' },
  type1: { label: 'Tipo 1', kind: 'AC' },
  type1_combo: { label: 'CCS 1', kind: 'DC' },
  chademo: { label: 'CHAdeMO', kind: 'DC' },
  nacs: { label: 'NACS (Tesla)', kind: null },
  tesla_supercharger: { label: 'Tesla Supercharger', kind: 'DC' },
  tesla_destination: { label: 'Tesla Destination', kind: 'AC' },
  schuko: { label: 'Schuko', kind: 'AC' },
};

function parseKw(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.replace(',', '.').match(/([\d.]+)\s*(kw|w)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return (m[2] ?? 'kw').toLowerCase() === 'w' ? n / 1000 : n;
}

function normalize(e: Element): OcmStation | null {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  const t = e.tags ?? {};
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  // Cada tipo de socket se expande por su cantidad: un punto por cargador físico
  const points: OcmPoint[] = [];
  for (const [key, def] of Object.entries(SOCKETS)) {
    const count = parseInt(t[`socket:${key}`] ?? '', 10);
    if (!Number.isFinite(count) || count <= 0) continue;
    const kw = parseKw(t[`socket:${key}:output`]);
    const kind = def.kind ?? (kw !== null ? (kw >= 40 ? 'DC' : 'AC') : null);
    for (let i = 0; i < count && points.length < 12; i++) points.push({ index: points.length, type: def.label, kind, kw });
  }
  if (!points.length) {
    const cap = parseInt(t.capacity ?? '', 10);
    const n = Number.isFinite(cap) && cap > 0 ? Math.min(cap, 12) : 1;
    for (let i = 0; i < n; i++) points.push({ index: i, type: 'Punto de carga', kind: null, kw: null });
  }
  const powers = points.map((p) => p.kw).filter((k): k is number => k !== null);

  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const usageCost =
    t.fee === 'yes' ? (t.charge ? t.charge : 'Con costo, consultar con el operador') : t.fee === 'no' ? 'Sin costo según OpenStreetMap' : null;

  return {
    id: e.type === 'node' ? e.id : -e.id,
    title: t.name ?? t.brand ?? t.operator ?? 'Cargador sin nombre',
    address: street,
    town: t['addr:suburb'] ?? t['addr:city'] ?? '',
    lat,
    lon,
    operator: t.operator ?? t.brand ?? t.network ?? null,
    usage: t.access ?? null,
    usageCost,
    status: 'unknown',
    statusText: 'Sin dato de disponibilidad',
    lastUpdate: null,
    maxKw: powers.length ? Math.max(...powers) : null,
    points,
  };
}

export async function fetchOsmStations(box: Bbox): Promise<OcmStation[]> {
  const query = `[out:json][timeout:60];nwr["amenity"="charging_station"](${box.south},${box.west},${box.north},${box.east});out center tags;`;
  let lastError = 'sin respuesta';
  // Overpass es un servicio público y a veces responde 504: dos intentos por servidor
  for (const host of [...OVERPASS_HOSTS, ...OVERPASS_HOSTS]) {
    try {
      const res = await fetch(host, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          // Overpass rechaza las peticiones sin identificar la aplicación (406)
          'User-Agent': 'recarga-cdmx-hackathon/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        lastError = `Overpass respondió ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { elements: Element[] };
      return json.elements.map(normalize).filter((s): s is OcmStation => s !== null);
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  throw new Error(lastError);
}
