import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: '音声ファイルが必要です' }, { status: 400 })
    }

    // Google Cloud Speech-to-Text APIを使用した音声認識
    // 現在はモックレスポンスを返します（Google Cloud Speech依存関係をインストール後に実装）
    const mockResponse = {
      transcript: "これはテスト音声です",
      speakers: [
        {
          speakerTag: 1,
          text: "これは",
          startTime: "0.0s",
          endTime: "0.5s"
        },
        {
          speakerTag: 2, 
          text: "テスト音声です",
          startTime: "0.5s",
          endTime: "1.5s"
        }
      ],
      confidence: 0.95
    }

    return NextResponse.json({
      success: true,
      result: mockResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Speech recognition API error:', error)
    return NextResponse.json(
      { error: '音声認識中にエラーが発生しました' },
      { status: 500 }
    )
  }
}