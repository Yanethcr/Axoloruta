import { BadRequestException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { IncomingMessage, ServerResponse } from 'node:http';

export type User = { id: string; name: string; email: string };
type UserRow = User & { password: string };
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const hashPassword = (password: string, salt: string): Promise<Buffer> => new Promise((ok, fail) =>
  scrypt(password, salt, 64, (e, key) => e ? fail(e) : ok(key)));

@Injectable()
export class AccountService {
  readonly db: DatabaseSync;
  private attempts = new Map<string, { count: number; until: number }>();

  constructor() {
    const path = resolve(process.env.APP_DB_PATH ?? 'data/app.sqlite');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires INTEGER NOT NULL);`);
  }

  checkMutation(req: IncomingMessage) {
    const origin = process.env.APP_URL ?? 'http://localhost:3000';
    if (req.headers.origin !== new URL(origin).origin || req.headers['x-app-request'] !== '1')
      throw new ForbiddenException('Solicitud no permitida');
  }

  limit(req: IncomingMessage) {
    const now = Date.now();
    for (const [k, v] of this.attempts) if (v.until <= now) this.attempts.delete(k);
    const ip = req.socket.remoteAddress ?? 'unknown';
    const entry = this.attempts.get(ip) ?? { count: 0, until: now + 15 * 60_000 };
    this.attempts.set(ip, entry);
    if (++entry.count > 20) throw new HttpException('Demasiados intentos. Intenta en 15 minutos.', 429);
  }

  private token(req: IncomingMessage) {
    return /(?:^|;\s*)axolo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1] ?? '';
  }

  user(req: IncomingMessage): User | null {
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
    const row = this.db.prepare(`SELECT u.id, u.name, u.email FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?`)
      .get(digest(this.token(req)), Date.now());
    return row ? row as User : null;
  }

  requireUser(req: IncomingMessage) {
    const user = this.user(req);
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar');
    return user;
  }

  private session(user: User, req: IncomingMessage, res: ServerResponse) {
    this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(this.token(req)));
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), user.id, Date.now() + 7 * 86400_000);
    res.setHeader('Set-Cookie', `axolo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return { user: { id: user.id, name: user.name, email: user.email } };
  }

  async authenticate(body: Record<string, unknown>, register: boolean, req: IncomingMessage, res: ServerResponse) {
    this.checkMutation(req); this.limit(req);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128)
      throw new BadRequestException('Usa un correo válido y una contraseña de 12 a 128 caracteres');
    if (register) {
      if (!name || name.length > 80) throw new BadRequestException('Escribe un nombre de hasta 80 caracteres');
      const salt = randomBytes(16).toString('hex');
      const passwordHash = `${salt}:${(await hashPassword(password, salt)).toString('hex')}`;
      const user = { id: randomUUID(), name, email };
      try { this.db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(user.id, name, email, passwordHash); }
      catch (e) {
        if (this.db.prepare('SELECT id FROM users WHERE email=?').get(email)) throw new BadRequestException('No se pudo crear la cuenta con ese correo');
        throw e;
      }
      return this.session(user, req, res);
    }
    const row = this.db.prepare('SELECT * FROM users WHERE email=?').get(email) as UserRow | undefined;
    const [salt, stored] = (row?.password ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await hashPassword(password, salt);
    if (!timingSafeEqual(actual, Buffer.from(stored, 'hex')) || !row) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return this.session(row, req, res);
  }

  logout(req: IncomingMessage, res: ServerResponse) {
    this.checkMutation(req);
    this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(this.token(req)));
    res.setHeader('Set-Cookie', `axolo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return { ok: true };
  }
}
