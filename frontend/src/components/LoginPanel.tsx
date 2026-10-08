'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '@/lib/api';
import Brand from '@/components/Brand';

export default function LoginPanel() {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false);
  const [name, setName] = useState('');
  const router = useRouter();
  useEffect(() => {
    let active = true;
    request<{ user: { name: string } | null }>('/api/auth/me').then((r) => {
      if (active && r.user) { setName(r.user.name); setEntering(true); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!entering) return;
    router.prefetch('/mapa');
    const timer = setTimeout(() => router.replace('/mapa'), 1800);
    return () => clearTimeout(timer);
  }, [entering, router]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || entering) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const result = await request<{ user: { name: string } }>(`/api/auth/${register ? 'register' : 'login'}`, data);
      setName(result.user.name); setEntering(true);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  };
  if (entering) return <main className="login-welcome" aria-label="Bienvenida a Axolo-Ruta">
    <div className="welcome-glow" aria-hidden="true" />
    <div className="welcome-content" role="status">
      <div className="welcome-floating-logo"><Brand hero /></div>
      <h1>¡Hola{name ? `, ${name}` : ''}!</h1>
      <p>Tu próxima carga empieza aquí.</p>
      <span className="welcome-loading">Abriendo el mapa<span className="welcome-dots" aria-hidden="true">•••</span></span>
    </div>
  </main>;
  return <div className="shell login-shell"><main className="app login-app"><div className="login-brand"><Brand hero /><p>Tu próxima carga empieza aquí.</p></div><div className="body">
    <h2>{register ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p className="note">Encuentra puntos de carga y consulta sus conectores y ubicación.</p>
    <form className="card account-form" onSubmit={submit}>
      {register && <label>Nombre<input name="name" required autoComplete="name" maxLength={80} /></label>}
      <label>Correo<input name="email" type="email" required autoComplete="email" maxLength={254} /></label>
      <label>Contraseña<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} /></label>
      <p className="note">Al menos 12 caracteres.</p>{error && <p role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Espera…' : register ? 'Crear cuenta' : 'Entrar'}</button>
      <button type="button" className="chip" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Ya tengo cuenta' : 'Crear cuenta'}</button>
    </form>
  </div></main></div>;
}
