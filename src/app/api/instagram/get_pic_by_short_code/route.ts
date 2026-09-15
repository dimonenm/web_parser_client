import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  const shortCode = request.nextUrl.searchParams.get('shortCode')

  if (!type || !shortCode) {
    return NextResponse.json(
      { error: 'Missing type or shortCode parameter' },
      { status: 400 },
    )
  }

  const params = new URLSearchParams({ type, shortCode })

  try {
    const response = await fetch(
      `http://localhost:3000/instagram/get_pic_by_short_code?type=${type}&shortCode=${shortCode}`,
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