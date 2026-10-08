import Link from 'next/link';
import AuthGate from '@/components/AuthGate';
import SimulatorPanel from '@/components/SimulatorPanel';
import Brand from '@/components/Brand';

export default function Page() { return <AuthGate><div className="shell simulator-shell"><main className="app explorer-app"><div className="top"><Brand /><h1>Disponibilidad de hubs</h1><Link href="/mapa" className="chip">Volver al mapa</Link></div><div className="body"><SimulatorPanel /></div></main></div></AuthGate>; }
