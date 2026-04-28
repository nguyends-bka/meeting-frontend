import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Chatbot WS Log]', new Date().toISOString(), body.event, body.payload);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Chatbot WS Log Error]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
