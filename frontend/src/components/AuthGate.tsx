'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '@/lib/api';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => {
    let active = true;
    request<{ user: unknown }>('/api/auth/me').then((data) => {
      if (!active) return;
      if (data.user) setReady(true); else router.replace('/login');
    }).catch(() => { if (active) setError('No se pudo verificar tu sesión. Recarga la página para reintentar.'); });
    return () => { active = false; };
  }, [router]);
  return ready ? children : <div className="shell"><p role="status" className="card">{error || 'Verificando sesión…'}</p></div>;
}
