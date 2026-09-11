import { NextResponse } from 'next/server';
import { isAuthenticated } from '../session';

export async function GET(request: Request) {
  const authenticated = await isAuthenticated(request);
  return NextResponse.json({ authenticated }, { status: authenticated ? 200 : 401 });
}
