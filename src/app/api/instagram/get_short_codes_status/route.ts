import { NextResponse } from 'next/server'

export async function GET() {

  try {
    const response = await fetch(
      `http://localhost:3000/instagram/get_short_codes_status`,
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