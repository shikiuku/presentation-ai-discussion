import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("=== Test API endpoint called ===")
    return NextResponse.json({ 
      message: "Test endpoint is working",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Test API error:", error)
    return NextResponse.json({
      error: "Test API failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
