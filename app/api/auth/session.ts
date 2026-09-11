import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'contrata_hogar_session';
const SEVEN_DAYS = 60 * 60 * 24 * 7;

function secret(name: 'APP_PIN' | 'SESSION_SECRET') {
  const value = env[name];
  if (!value) throw new Error(`Falta la configuración segura ${name}.`);
  return String(value);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret('SESSION_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function pinIsValid(pin: string) {
  const [received, expected] = await Promise.all([sign(`pin:${pin}`), sign(`pin:${secret('APP_PIN')}`)]);
  return safeEqual(received, expected);
}

export async function createSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + SEVEN_DAYS;
  return `${expires}.${await sign(`session:${expires}`)}`;
}

export async function isAuthenticated(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  return Boolean(expires && expires >= Math.floor(Date.now() / 1000) && signature && safeEqual(signature, await sign(`session:${expires}`)));
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SEVEN_DAYS}`;
}
