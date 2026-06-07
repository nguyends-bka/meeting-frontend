import { NextRequest, NextResponse } from 'next/server';

// const RAG_URL = 'https://rag.soictlab.com/query';
// const RAG_URL = 'http://localhost:3001/';
// Thực thế
// const RAG_QUERY_URL = 'https://rag.soictlab.com/query';
// const RAG_TRANSCRIPT_QUERY_URL = 'https://rag.soictlab.com/query/transcript';
// Local quakcomm
const RAG_QUERY_URL = 'http://bkmeeting.soict.io:18000/query';
const RAG_TRANSCRIPT_QUERY_URL = 'http://bkmeeting.soict.io:18000/query/transcript';

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  // ── 1. Đọc body từ client ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json(); 
  } catch (err) {
    console.error(`[RAG Proxy] [${timestamp}] ❌ Failed to parse request body:`, err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyObj = body as { collection?: string };

  const targetUrl =
    typeof bodyObj.collection === 'string' &&
    bodyObj.collection.startsWith('meeting-')
      ? RAG_TRANSCRIPT_QUERY_URL
      : RAG_QUERY_URL;


  // ── 2. Log REQUEST ra terminal ───────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[RAG Proxy] [${timestamp}] 📤 REQUEST → ${targetUrl}`);
  console.log(`[RAG Proxy] Body:`, JSON.stringify(body, null, 2));
  console.log(`${'─'.repeat(60)}`);

  // Forward Authorization header nếu client gửi kèm
  const authHeader = req.headers.get('authorization');

  // ── 3. Gọi RAG API ───────────────────────────────────────────────────────
  let ragRes: Response;
  try {
    ragRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[RAG Proxy] [${timestamp}] ❌ Network error calling RAG:`, err);
    return NextResponse.json({ error: 'RAG unreachable', detail: String(err) }, { status: 502 });
  }

  // ── 4. Đọc response body ─────────────────────────────────────────────────
  const rawText = await ragRes.text();

  let parsedBody: unknown = rawText;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch {
    // không phải JSON — giữ nguyên text
  }

  // ── 5. Log RESPONSE ra terminal ──────────────────────────────────────────
  const statusEmoji = ragRes.ok ? '✅' : '⚠️';
  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `[RAG Proxy] [${timestamp}] ${statusEmoji} RESPONSE ← ${targetUrl}`,
  );
  console.log(`[RAG Proxy] Status : ${ragRes.status} ${ragRes.statusText}`);
  console.log(`[RAG Proxy] Content-Type: ${ragRes.headers.get('content-type') ?? '(none)'}`);
  console.log(`[RAG Proxy] Body:`, typeof parsedBody === 'object'
    ? JSON.stringify(parsedBody, null, 2)
    : rawText,
  );
  console.log(`${'─'.repeat(60)}\n`);

  // ── 6. Trả về client ─────────────────────────────────────────────────────
  return new NextResponse(rawText, {
    status: ragRes.status,
    headers: {
      'Content-Type': ragRes.headers.get('content-type') ?? 'application/json',
    },
  });
}
