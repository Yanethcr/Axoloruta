/**
 * Estaciones de EJEMPLO para ver la pantalla sin llave de Open Charge Map.
 * Se activan solo con OCM_DEMO=true y sin OCM_API_KEY. No son datos reales.
 */
import type { OcmPoint, OcmStation, OcmStatus } from './ocm.service';

const dc = (kw: number, type = 'CCS'): Omit<OcmPoint, 'index'> => ({ type, kind: 'DC', kw });
const ac = (kw: number): Omit<OcmPoint, 'index'> => ({ type: 'Tipo 2', kind: 'AC', kw });

function mk(
  id: number,
  title: string,
  address: string,
  town: string,
  lat: number,
  lon: number,
  status: OcmStatus,
  statusText: string,
  lastUpdate: string | null,
  pts: Omit<OcmPoint, 'index'>[],
): OcmStation {
  return {
    id,
    title,
    address,
    town,
    lat,
    lon,
    operator: 'Operador de ejemplo',
    usage: 'Público',
    usageCost: id === 900001 ? 'Consultar con el operador (ejemplo)' : null,
    status,
    statusText,
    lastUpdate,
    maxKw: Math.max(...pts.map((p) => p.kw ?? 0)),
    points: pts.map((p, index) => ({ ...p, index })),
  };
}

export function demoStations(): OcmStation[] {
  return [
    mk(900001, 'Electrolinera Coyoacán Centro (ejemplo)', 'Av. Universidad', 'Coyoacán', 19.3512, -99.1631, 'available', 'Disponible', '2026-08-12T10:00:00Z', [dc(50), dc(50), ac(22), ac(22)]),
    mk(900002, 'Plaza Santa Úrsula (ejemplo)', 'Calz. de Tlalpan', 'Coyoacán', 19.3139, -99.1486, 'operational', 'En operación', '2026-07-03T10:00:00Z', [ac(7.4), ac(7.4), ac(7.4), ac(7.4)]),
    mk(900003, 'Estacionamiento Tlalpan Norte (ejemplo)', 'Calz. de Tlalpan', 'Tlalpan', 19.2951, -99.1702, 'unknown', 'Sin dato de disponibilidad', null, [dc(60), dc(60), dc(50, 'CHAdeMO')]),
    mk(900004, 'Plaza Sur (ejemplo)', 'Periférico Sur', 'Tlalpan', 19.3053, -99.2058, 'unavailable', 'No disponible', '2026-09-20T10:00:00Z', [ac(22), ac(22)]),
    mk(900005, 'Gasolinera Periférico Sur (ejemplo)', 'Periférico Sur', 'Álvaro Obregón', 19.3342, -99.2149, 'available', 'Disponible', '2026-09-02T10:00:00Z', [dc(150), dc(150)]),
    mk(900006, 'Mercado de Xochimilco (ejemplo)', 'Av. Guadalupe I. Ramírez', 'Xochimilco', 19.2584, -99.1066, 'unknown', 'Sin dato de disponibilidad', null, [ac(7.4), ac(7.4)]),
  ];
}
