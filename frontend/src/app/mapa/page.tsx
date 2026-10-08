import AuthGate from '@/components/AuthGate';
import DondeCargo from '@/components/DondeCargo';
export default function Page() { return <AuthGate><DondeCargo /></AuthGate>; }
