/** Contrato de la API del backend (NestJS). */

export interface Car {
  id: string;
  name: string;
  /** Capacidad útil de la batería (kWh) */
  batteryKwh: number;
  /** Máxima potencia que acepta en corriente alterna (kW) */
  acKw: number;
  /** Máxima potencia que acepta en corriente directa (kW). 0 = no admite carga rápida */
  dcKw: number;
}

/** Electrolineras de Open Charge Map. Son de otros operadores: sin disponibilidad en vivo. */
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
  /** Estado de toda la estación según Open Charge Map (no es en vivo) */
  status: OcmStatus;
  statusText: string;
  lastUpdate: string | null;
  maxKw: number | null;
  points: OcmPoint[];
}

export interface OcmResponse {
  configured: boolean;
  demo: boolean;
  source: string;
  attribution: string;
  fetchedAt: string | null;
  stale: boolean;
  error?: string;
  stations: OcmStation[];
}
