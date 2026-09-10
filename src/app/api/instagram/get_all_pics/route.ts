import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'Missing id parameter' },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(
      `http://localhost:3000/instagram/get_all_pics?id=${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    )

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Proxy error', details: (error as Error).message },
      { status: 502 },
    )
  }
}