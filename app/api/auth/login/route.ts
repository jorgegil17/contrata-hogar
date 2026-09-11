import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { createSessionToken, pinIsValid, sessionCookie } from '../session';

async function ensureAttemptsTable() {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS login_attempts (client_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until INTEGER NOT NULL)').run();
}

export async function POST(request: Request) {
  await ensureAttemptsTable();
  const clientKey = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const attempt = await env.DB.prepare('SELECT failures, locked_until FROM login_attempts WHERE client_key = ?').bind(clientKey).first<{ failures: number; locked_until: number }>();
  if (attempt && attempt.locked_until > now) return NextResponse.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429 });
  const { pin } = await request.json() as { pin?: string };
  if (!/^\d{6}$/.test(pin || '') || !await pinIsValid(pin || '')) {
    const failures = (attempt?.failures || 0) + 1;
    const lockedUntil = failures >= 5 ? now + 15 * 60 * 1000 : 0;
    await env.DB.prepare('INSERT INTO login_attempts (client_key, failures, locked_until) VALUES (?, ?, ?) ON CONFLICT(client_key) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until').bind(clientKey, failures >= 5 ? 0 : failures, lockedUntil).run();
    return NextResponse.json({ error: 'Código incorrecto.' }, { status: 401 });
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE client_key = ?').bind(clientKey).run();
  const response = NextResponse.json({ authenticated: true });
  response.headers.set('Set-Cookie', sessionCookie(await createSessionToken()));
  return response;
}
