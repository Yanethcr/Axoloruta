import { Injectable, Logger } from '@nestjs/common';
import { demoStations } from './ocm.demo';
import { OSM_ATTRIBUTION, fetchOsmStations } from './osm';

/**
 * Electrolineras en el área de la Ciudad de México, incluidas las 16 alcaldías.
 *
 * Fuentes, en este orden:
 *  1. Open Charge Map (https://openchargemap.org, licencias según proveedor), si hay OCM_API_KEY.
 *  2. Estaciones de ejemplo, solo si se pide con OCM_DEMO=true y no hay llave.
 *  3. OpenStreetMap (Overpass), abierta y sin llave. Es la que se usa por defecto.
 *
 * Son estaciones de otros operadores. Ninguna fuente da la disponibilidad en
 * vivo de cada punto, así que aquí no se inventa.
 */
const BBOX = { north: 19.60, south: 19.04, west: -99.36, east: -98.93 };
const OCM_URL = 'https://api.openchargemap.io/v3/poi';
const OCM_CACHE_MS = 60_000;
/** OpenStreetMap cambia poco y su servidor pide uso moderado */
const OSM_CACHE_MS = 10 * 60_000;
const MAX_POINTS = 12;

export type OcmStatus = 'available' | 'inuse' | 'unavailable' | 'operational' | 'unknown';

/** Un punto de carga (cargador físico) de la estación. Solo informativo. */
export interface OcmPoint {
  index: number;
  type: string;
  kind: 'AC' | 'DC' | null;
  kw: number | null;
}

export interface OcmStation {
  id: number;
  title: string;
  address: string;
  town: string;
  lat: number;
  lon: number;
  operator: string | null;
  usage: string | null;
  /** Costo de uso en texto libre, si quien capturó la estación lo escribió */
  usageCost: string | null;
  /** Estado de la estación completa según la fuente (no es en vivo) */
  status: OcmStatus;
  statusText: string;
  /** Fecha del último dato de estado en la fuente */
  lastUpdate: string | null;
  maxKw: number | null;
  points: OcmPoint[];
}

export interface OcmResponse {
  /** false solo si falta algo indispensable para consultar la fuente */
  configured: boolean;
  /** true si son estaciones de ejemplo (OCM_DEMO), no datos reales */
  demo: boolean;
  /** Nombre de la fuente de los datos */
  source: string;
  attribution: string;
  fetchedAt: string | null;
  /** true si no se pudo refrescar y se están mostrando datos guardados */
  stale: boolean;
  error?: string;
  stations: OcmStation[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** IDs de StatusType de Open Charge Map. */
function mapStatus(raw: Raw): { status: OcmStatus; text: string } {
  const id: number | undefined = raw.StatusTypeID ?? raw.StatusType?.ID;
  const title: string | undefined = raw.StatusType?.Title;
  switch (id) {
    case 10:
      return { status: 'available', text: title ?? 'Disponible' };
    case 20:
      return { status: 'inuse', text: title ?? 'En uso' };
    case 30:
    case 100:
    case 150:
    case 210:
      return { status: 'unavailable', text: title ?? 'No disponible' };
    case 50:
    case 75:
      return { status: 'operational', text: title ?? 'En operación' };
    default:
      return { status: 'unknown', text: 'Sin dato de disponibilidad' };
  }
}

function currentKind(c: Raw): 'AC' | 'DC' | null {
  const id: number | undefined = c.CurrentTypeID ?? c.CurrentType?.ID;
  if (id === 10 || id === 20) return 'AC';
  if (id === 30) return 'DC';
  return null;
}

function normalize(p: Raw): OcmStation | null {
  const a = p.AddressInfo;
  if (!a || typeof a.Latitude !== 'number' || typeof a.Longitude !== 'number') return null;
  const s = mapStatus(p);

  // Cada conector se expande por su cantidad para tener un punto por cargador físico
  const points: OcmPoint[] = [];
  for (const c of p.Connections ?? []) {
    const qty = typeof c.Quantity === 'number' && c.Quantity > 0 ? Math.floor(c.Quantity) : 1;
    for (let i = 0; i < qty && points.length < MAX_POINTS; i++) {
      points.push({
        index: points.length,
        type: c.ConnectionType?.Title ?? c.ConnectionType?.FormalName ?? 'Conector',
        kind: currentKind(c),
        kw: typeof c.PowerKW === 'number' ? c.PowerKW : null,
      });
    }
  }
  // Sin conectores detallados: se usa el número de puntos que declara la estación
  if (!points.length) {
    const n = typeof p.NumberOfPoints === 'number' && p.NumberOfPoints > 0 ? Math.min(p.NumberOfPoints, MAX_POINTS) : 1;
    for (let i = 0; i < n; i++) points.push({ index: i, type: 'Punto de carga', kind: null, kw: null });
  }
  const powers = points.map((x) => x.kw).filter((k): k is number => k !== null);
  return {
    id: p.ID,
    title: a.Title ?? 'Estación de carga',
    address: [a.AddressLine1, a.AddressLine2].filter(Boolean).join(', '),
    town: a.Town ?? a.StateOrProvince ?? '',
    lat: a.Latitude,
    lon: a.Longitude,
    operator: p.OperatorInfo?.Title ?? null,
    usage: p.UsageType?.Title ?? null,
    usageCost: typeof p.UsageCost === 'string' && p.UsageCost.trim() ? p.UsageCost.trim() : null,
    status: s.status,
    statusText: s.text,
    lastUpdate: p.DateLastStatusUpdate ?? p.DateLastVerified ?? null,
    maxKw: powers.length ? Math.max(...powers) : null,
    points,
  };
}

@Injectable()
export class OcmService {
  private readonly log = new Logger(OcmService.name);
  private cache: { at: number; ttl: number; stations: OcmStation[] } | null = null;
  private inflight: Promise<OcmStation[]> | null = null;

  async list(): Promise<OcmResponse> {
    const key = process.env.OCM_API_KEY;
    if (!key && process.env.OCM_DEMO === 'true') {
      return {
        source: 'Estaciones de ejemplo',
        attribution: 'Estaciones de ejemplo, no son datos reales',
        configured: true,
        demo: true,
        fetchedAt: new Date().toISOString(),
        stale: false,
        stations: demoStations(),
      };
    }
    const base = key
      ? { source: 'Open Charge Map', attribution: 'Datos de Open Charge Map (openchargemap.org); licencia y atribución según el proveedor de cada estación' }
      : { source: 'OpenStreetMap', attribution: OSM_ATTRIBUTION };
    const ttl = key ? OCM_CACHE_MS : OSM_CACHE_MS;

    if (this.cache && Date.now() - this.cache.at < this.cache.ttl) return this.respond(base, false);
    try {
      this.inflight ??= (key ? this.fetchOcm(key) : fetchOsmStations(BBOX)).finally(() => (this.inflight = null));
      const stations = await this.inflight;
      this.cache = { at: Date.now(), ttl, stations };
      return this.respond(base, false);
    } catch (e) {
      const msg = (e as Error).message;
      this.log.warn(`No se pudo consultar ${base.source}: ${msg}`);
      if (this.cache) return this.respond(base, true, msg);
      return { ...base, configured: true, demo: false, fetchedAt: null, stale: false, error: msg, stations: [] };
    }
  }

  private respond(base: { source: string; attribution: string }, stale: boolean, error?: string): OcmResponse {
    return {
      ...base,
      configured: true,
      demo: false,
      fetchedAt: new Date(this.cache!.at).toISOString(),
      stale,
      error,
      stations: this.cache!.stations,
    };
  }

  private async fetchOcm(key: string): Promise<OcmStation[]> {
    const qs = new URLSearchParams({
      output: 'json',
      countrycode: 'MX',
      boundingbox: `(${BBOX.north},${BBOX.west}),(${BBOX.south},${BBOX.east})`,
      maxresults: '1000',
      compact: 'false',
      verbose: 'false',
    });
    const res = await fetch(`${OCM_URL}?${qs}`, {
      headers: { 'X-API-Key': key, Accept: 'application/json', 'User-Agent': 'recarga-cdmx-hackathon' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Open Charge Map respondió ${res.status}`);
    const raw = (await res.json()) as Raw[];
    if (!Array.isArray(raw)) throw new Error('Open Charge Map devolvió una respuesta inválida');
    return raw.map(normalize).filter((s): s is OcmStation => s !== null);
  }
}
