'use client';

import { useState } from 'react';

export default function Brand({ hero = false }: { hero?: boolean }) {
  const [missing, setMissing] = useState(false);
  return <div className={'brand' + (hero ? ' brand-hero' : '')}>
    {missing ? <span className="brand-fallback" aria-hidden="true">AR</span> :
      // The supplied logo is an original static asset; preserve its proportions.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="brand-logo" src="/axolo-ruta-logo.jpeg" alt="Logo de Axolo-Ruta: ajolote y electromovilidad CDMX" width={hero ? 180 : 56} height={hero ? 180 : 56} onError={() => setMissing(true)} />}
    <div className="brand-copy"><span className="brand-name">AXOLO-RUTA</span><span className="brand-tagline">Electromovilidad CDMX</span></div>
  </div>;
}
