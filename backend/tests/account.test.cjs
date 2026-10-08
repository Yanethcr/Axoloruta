const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { AccountService } = require('../dist/account/account.service');
const { OcmService } = require('../dist/ocm/ocm.service');

test('estaciones: consulta incluye el norte de CDMX', async () => {
  const originalFetch = global.fetch;
  const oldKey = process.env.OCM_API_KEY;
  process.env.OCM_API_KEY = 'test-only';
  try {
    global.fetch = async (url) => {
      const params = new URL(url).searchParams;
      assert.equal(params.get('boundingbox'), '(19.6,-99.36),(19.04,-98.93)');
      return { ok: true, json: async () => [{ ID: 1, AddressInfo: { Title: 'Azcapotzalco', Latitude: 19.484, Longitude: -99.185 }, Connections: [] }] };
    };
    const result = await new OcmService().list();
    assert.equal(result.stations[0].title, 'Azcapotzalco');
  } finally { global.fetch = originalFetch; if (oldKey === undefined) delete process.env.OCM_API_KEY; else process.env.OCM_API_KEY = oldKey; }
});

test('cuentas persistentes, cookie, acceso protegido y cierre de sesión', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'axolo-test-'));
  process.env.APP_DB_PATH = join(dir, 'test.sqlite');
  process.env.APP_URL = 'http://localhost:3000';
  const account = new AccountService();
  const req = { headers: { origin: process.env.APP_URL, 'x-app-request': '1' }, socket: { remoteAddress: 'test' } };
  let cookie;
  const res = { setHeader: (_, value) => { cookie = value; } };
  const body = { name: 'Prueba', email: 'TEST@example.com', password: 'clave-larga-de-prueba' };
  try {
    assert.throws(() => account.checkMutation({ headers: { origin: 'https://other.example' } }));
    assert.throws(() => account.requireUser(req));
    const { user } = await account.authenticate(body, true, req, res);
    assert.equal(user.email, 'test@example.com');
    assert.equal(user.password, undefined);
    assert.match(cookie, /HttpOnly/);
    req.headers.cookie = cookie.split(';')[0];
    assert.equal(account.requireUser(req).id, user.id);
    const stored = account.db.prepare('SELECT password FROM users').get();
    assert.notEqual(stored.password, body.password);
    await assert.rejects(() => account.authenticate({ ...body, password: 'incorrecta-larga' }, false, req, res));
    account.logout(req, res);
    assert.equal(account.user(req), null);
    await account.authenticate(body, false, req, res);
    req.headers.cookie = cookie.split(';')[0];
    account.db.close();
    const reopened = new AccountService();
    assert.equal(reopened.requireUser(req).id, user.id);
    reopened.db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP: login, cookie persistente y API del mapa protegida', async () => {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const dir = mkdtempSync(join(tmpdir(), 'axolo-http-'));
  process.env.APP_DB_PATH = join(dir, 'test.sqlite');
  process.env.APP_URL = 'http://localhost:3000';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    assert.equal((await fetch(`${origin}/api/ocm`)).status, 401);
    const created = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.APP_URL, 'X-App-Request': '1' },
      body: JSON.stringify({ name: 'HTTP Test', email: 'http@example.com', password: 'long-password-http-test' }),
    });
    assert.equal(created.status, 201);
    const cookie = created.headers.get('set-cookie').split(';')[0];
    const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal((await me.json()).user.email, 'http@example.com');
    const denied = await fetch(`${origin}/api/payments/quote`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.APP_URL, 'X-App-Request': '1' }, body: JSON.stringify({ carId: 'leaf', from: 20, to: 80 }) });
    assert.equal(denied.status, 404);
  } finally { app.get(AccountService).db.close(); await app.close(); rmSync(dir, { recursive: true, force: true }); }
});
