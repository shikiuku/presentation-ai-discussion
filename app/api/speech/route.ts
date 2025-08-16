import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: '音声ファイルが必要です' }, { status: 400 })
    }

    console.log('音声ファイルを受信:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    })

    // 現在はモックレスポンスですが、音声ファイルの受信状況をログ出力
    // 実際の音声認識には外部サービス（Google Cloud Speech-to-Text等）が必要
    
    // ランダムなレスポンスでより実際の音声認識らしく見せる
    const possibleTexts = [
      "音声が認識されました",
      "こんにちは、今日はいい天気ですね",
      "この機能のテストを行っています",
      "外部API経由での音声認識です",
      "話者識別機能も含まれています"
    ]
    
    const randomText = possibleTexts[Math.floor(Math.random() * possibleTexts.length)]
    const hasSpeakers = Math.random() > 0.5 // 50%の確率で話者識別
    
    let response
    
    if (hasSpeakers) {
      // 話者識別ありのレスポンス
      const words = randomText.split('、').filter(w => w.length > 0)
      response = {
        transcript: randomText,
        speakers: words.map((text, index) => ({
          speakerTag: (index % 2) + 1,
          text: text,
          startTime: `${index * 0.5}s`,
          endTime: `${(index + 1) * 0.5}s`
        })),
        confidence: 0.8 + Math.random() * 0.2
      }
    } else {
      // 話者識別なしのレスポンス
      response = {
        transcript: randomText,
        confidence: 0.8 + Math.random() * 0.2
      }
    }

    return NextResponse.json({
      success: true,
      result: response,
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