import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { message, userId } = await req.json();

  try {
    // Forward request to FastAPI backend
    const response = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, userId }),
    });
    const data = await response.json();
    return NextResponse.json({ reply: data.reply });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to communicate with CrewAI backend' }, { status: 500 });
  }
}