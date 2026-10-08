/** Auto eléctrico o híbrido enchufable. Datos aproximados de ejemplo. */
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

export const CARS: Car[] = [
  { id: 'phev', name: 'Híbrido enchufable', batteryKwh: 14, acKw: 3.7, dcKw: 0 },
  { id: 'kwid', name: 'Renault Kwid E-Tech', batteryKwh: 26.8, acKw: 6.6, dcKw: 30 },
  { id: 'leaf', name: 'Nissan Leaf', batteryKwh: 40, acKw: 6.6, dcKw: 50 },
  { id: 'dolphin', name: 'BYD Dolphin', batteryKwh: 45, acKw: 7, dcKw: 60 },
  { id: 'mgzs', name: 'MG ZS EV', batteryKwh: 51, acKw: 7, dcKw: 76 },
  { id: 'model3', name: 'Tesla Model 3', batteryKwh: 60, acKw: 11, dcKw: 170 },
  { id: 'bolt', name: 'Chevrolet Bolt EV', batteryKwh: 65, acKw: 7.2, dcKw: 55 },
  { id: 'seal', name: 'BYD Seal', batteryKwh: 82, acKw: 11, dcKw: 150 },
];
