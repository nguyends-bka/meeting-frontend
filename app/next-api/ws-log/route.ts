import { NextResponse } from 'next/server';

const EVENT_ICONS: Record<string, string> = {
  'ws:open':          '✅ OPEN   ',
  'ws:close':         '🔌 CLOSE  ',
  'ws:error':         '❌ ERROR  ',
  'ws:send':          '📤 SEND   ',
  'ws:receive':       '📨 RECEIVE',
  'ws:receive:error': '⚠️  RCV ERR',
};

export async function POST(req: Request) {
  try {
    const { event, payload } = await req.json() as { event: string; payload: unknown };

    const icon = EVENT_ICONS[event] ?? '📋 EVENT  ';
    const ts   = (payload as Record<string, string>)?.ts ?? new Date().toISOString();
    const url  = (payload as Record<string, string>)?.url ?? '';

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[WS Chatbot] ${icon}  ${ts}`);
    console.log(`[WS Chatbot] URL   : ${url}`);
    console.log(`[WS Chatbot] Event : ${event}`);

    // In data / reason / code nếu có
    const { url: _u, ts: _t, ...rest } = payload as Record<string, unknown>;
    if (Object.keys(rest).length > 0) {
      console.log(`[WS Chatbot] Question:`, JSON.stringify(rest, null, 2));
    }

    console.log(`${'─'.repeat(60)}\n`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WS Chatbot Log Error]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
