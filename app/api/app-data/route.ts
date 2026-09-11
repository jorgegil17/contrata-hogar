import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { isAuthenticated } from '../auth/session';

async function ensureDataTable() {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_data (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
}

export async function GET(request: Request) {
  if (!await isAuthenticated(request)) return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 });
  await ensureDataTable();
  const row = await env.DB.prepare('SELECT data FROM app_data WHERE id = 1').first<{ data: string }>();
  return NextResponse.json(row ? JSON.parse(row.data) : {});
}

export async function PUT(request: Request) {
  if (!await isAuthenticated(request)) return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 });
  const data = await request.json();
  await ensureDataTable();
  await env.DB.prepare('INSERT INTO app_data (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(JSON.stringify(data), Date.now()).run();
  return NextResponse.json({ saved: true });
}
