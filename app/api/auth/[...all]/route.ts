import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { NextRequest, NextResponse } from "next/server"

const handler = toNextJsHandler(auth.handler)

export async function GET(request: NextRequest) {
  try {
    return await handler.GET(request)
  } catch (error) {
    console.error("Auth GET error:", error)
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handler.POST(request)
  } catch (error) {
    console.error("Auth POST error:", error)
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    )
  }
}

