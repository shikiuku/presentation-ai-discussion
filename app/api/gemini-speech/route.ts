import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// リクエスト追跡用のグローバル状態
let requestCounter = 0
let lastRequestTime = 0
let lastSuccessfulRequest = 0

export async function GET() {
  try {
    console.log('=== Gemini Speech API endpoint called ===')
    console.log('Environment check:', {
      hasApiKey: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      apiKeyLength: process.env.NEXT_PUBLIC_GEMINI_API_KEY?.length || 0
    })
    
    return NextResponse.json({ 
      message: 'Gemini Speech endpoint is working',
      hasApiKey: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      apiKeyLength: process.env.NEXT_PUBLIC_GEMINI_API_KEY?.length || 0,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('GET endpoint error:', error)
    return NextResponse.json({
      error: 'GET endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7)
  const currentTime = Date.now()
  
  requestCounter++
  console.log(`=== Gemini Speech API POST endpoint called (Request ID: ${requestId}) ===`)
  console.log(`Request #${requestCounter}, Time since last request: ${currentTime - lastRequestTime}ms`)
  console.log(`Last successful request was ${currentTime - lastSuccessfulRequest}ms ago`)
  console.log(`Request headers:`, Object.fromEntries(request.headers.entries()))
  
  lastRequestTime = currentTime
  
  try {
    console.log(`Step 1 (${requestId}): Checking environment variables...`)
    // 環境変数のチェック
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.error('NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'Gemini APIキーが設定されていません' },
        { status: 500 }
      )
    }
    
    console.log('Gemini API key is set:', process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'YES' : 'NO')
    console.log('Step 2: Environment check completed successfully')

    console.log('Step 3: Parsing form data...')
    const formData = await request.formData()
    console.log('Step 4: Form data parsed successfully')
    
    const audioFile = formData.get('audio') as File
    console.log('Step 5: Audio file extracted from form data')
    
    console.log('Audio file received:', audioFile ? `${audioFile.name} (${audioFile.size} bytes)` : 'NO FILE')
    
    if (!audioFile) {
      console.error('No audio file provided')
      return NextResponse.json({ error: '音声ファイルが必要です' }, { status: 400 })
    }

    console.log('Step 6: Checking audio file details...')
    // 音声ファイルのmimeTypeとサイズを確認
    console.log('Audio file details:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    })

    // サイズチェック：最小8KB、最大20MB
    if (audioFile.size < 8000) {
      console.error('Audio file too small:', audioFile.size, 'bytes')
      return NextResponse.json({ 
        error: '音声データが小さすぎます（最小8KB必要）',
        details: `受信サイズ: ${audioFile.size} bytes` 
      }, { status: 400 })
    }
    
    if (audioFile.size > 20 * 1024 * 1024) { // 20MB制限
      console.error('Audio file too large:', audioFile.size, 'bytes')
      return NextResponse.json({ 
        error: '音声データが大きすぎます（最大20MB）',
        details: `受信サイズ: ${audioFile.size} bytes` 
      }, { status: 400 })
    }

    console.log('Step 7: Converting audio to Base64...')
    // 音声データをBase64に変換
    const audioBuffer = await audioFile.arrayBuffer()
    console.log('Step 8: Audio buffer created successfully')
    
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    console.log('Audio buffer created, size:', audioBuffer.byteLength, 'bytes')
    console.log('Base64 length:', base64Audio.length)
    console.log('Step 9: Base64 conversion completed')

    console.log('Step 10: Initializing Gemini API...')
    // 各リクエストで新しいインスタンスを作成（状態管理問題を避けるため）
    console.log('Calling Gemini API for audio analysis...')
    console.log(`Creating fresh GoogleGenerativeAI instance for request ${requestCounter}`)
    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY)
    console.log('Step 11: GoogleGenerativeAI instance created')
    
    console.log(`Getting fresh model instance for request ${requestCounter}`)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.1, // 一貫性のために低温度設定
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 2048,
      }
    })
    console.log('Step 12: Gemini model obtained successfully with config')

    const prompt = `リクエストID: ${requestId}, リクエスト番号: ${requestCounter}
この音声ファイルを分析して、以下の形式でJSONレスポンスを返してください：

{
  "transcript": "音声から認識したテキスト",
  "confidence": 0.95,
  "speakers": [
    {
      "speakerTag": 1,
      "text": "話者1の発話内容",
      "startTime": "0s",
      "endTime": "5s",
      "confidence": 0.9
    },
    {
      "speakerTag": 2, 
      "text": "話者2の発話内容",
      "startTime": "6s",
      "endTime": "10s",
      "confidence": 0.85
    }
  ]
}

重要な点：
- 話者が複数いる場合は、speakerTagを1, 2, 3...と割り当ててください
- 1人の場合はspeakerTag: 1のみ
- 日本語の音声です
- 可能な限り正確に文字起こししてください`

    console.log('Step 13: Preparing to call Gemini API with audio data...')
    
    // MIME typeを正規化
    let mimeType = audioFile.type
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = 'audio/webm' // デフォルトとしてWebMを使用
    }
    
    // Gemini APIが対応している音声形式かチェック
    const supportedMimeTypes = [
      'audio/webm',
      'audio/wav', 
      'audio/mp3',
      'audio/aac',
      'audio/ogg',
      'audio/flac'
    ]
    
    if (!supportedMimeTypes.some(type => mimeType.includes(type.split('/')[1]))) {
      console.error('Unsupported MIME type for Gemini:', mimeType)
      return NextResponse.json({ 
        error: `サポートされていない音声形式: ${mimeType}`,
        details: `対応形式: ${supportedMimeTypes.join(', ')}` 
      }, { status: 400 })
    }
    
    console.log('Audio type (normalized):', mimeType)
    console.log('Base64 length:', base64Audio.length)

    // レート制限対策: リクエスト間隔制御
    console.log(`Step 13.5 (${requestId}): Applying rate limit protection...`)
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5秒に延長

    let result
    let retryCount = 0
    const maxRetries = 3

    // リクエスト毎の詳細ログを記録
    console.log(`=== DETAILED REQUEST ANALYSIS (Request ${requestCounter}) ===`)
    console.log(`Request ID: ${requestId}`)
    console.log(`Request Counter: ${requestCounter}`)
    console.log(`Time since last successful: ${currentTime - lastSuccessfulRequest}ms`)
    console.log(`Audio buffer byte length: ${audioBuffer.byteLength}`)
    console.log(`Base64 length: ${base64Audio.length}`)
    console.log(`MIME type: ${mimeType}`)
    console.log(`Base64 first 100 chars: ${base64Audio.substring(0, 100)}`)
    console.log(`Base64 last 100 chars: ${base64Audio.substring(base64Audio.length - 100)}`)
    
    // プロンプトのハッシュを計算
    const crypto = require('crypto')
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex')
    const audioHash = crypto.createHash('md5').update(base64Audio).digest('hex')
    console.log(`Prompt hash: ${promptHash}`)
    console.log(`Audio data hash: ${audioHash}`)
    console.log(`=== END DETAILED REQUEST ANALYSIS ===`)

    while (retryCount < maxRetries) {
      try {
        console.log(`Step 14.${retryCount + 1} (${requestId}): Attempting Gemini API call (attempt ${retryCount + 1}/${maxRetries})...`)
        
        console.log(`Payload: RequestID=${requestId}, Counter=${requestCounter}, MimeType=${mimeType}, Base64Length=${base64Audio.length}`)
        
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          prompt
        ])
        
        console.log(`Step 15 (${requestId}): Gemini API call completed successfully`)
        lastSuccessfulRequest = Date.now()
        break // 成功したらループを抜ける
        
      } catch (apiError) {
        retryCount++
        console.error(`=== GEMINI API CALL ERROR (Request ${requestCounter}, Attempt ${retryCount}) ===`)
        console.error('API Error:', apiError)
        console.error('Error message:', apiError instanceof Error ? apiError.message : 'No message')
        console.error('Error type:', apiError?.constructor?.name)
        console.error('Error code:', (apiError as any)?.code)
        console.error('Error status:', (apiError as any)?.status)
        console.error('Error details:', JSON.stringify(apiError, null, 2))
        
        if (retryCount >= maxRetries) {
          throw apiError // 最大リトライ回数に達したらエラーを投げる
        }
        
        // リトライ前に待機時間を増やす（指数バックオフ）
        const waitTime = Math.pow(2, retryCount) * 2000 // 2秒, 4秒, 8秒
        console.log(`Step 14.${retryCount}.5: Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    const response = result.response
    const text = response.text()
    
    console.log('Gemini API response:', text)

    try {
      // JSONレスポンスをパース
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()
      const parsedResult = JSON.parse(cleanText)
      
      console.log('Parsed Gemini result:', parsedResult)

      // レスポンス形式を統一
      const formattedResponse = {
        transcript: parsedResult.transcript || '',
        confidence: parsedResult.confidence || 0.8,
        speakers: parsedResult.speakers || [{
          speakerTag: 1,
          text: parsedResult.transcript || '',
          startTime: '0s',
          endTime: '0s',
          confidence: parsedResult.confidence || 0.8
        }]
      }

      console.log('Final formatted response:', formattedResponse)

      return NextResponse.json({
        success: true,
        result: formattedResponse,
        timestamp: new Date().toISOString(),
        source: 'gemini',
        requestId: requestId
      })

    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', parseError)
      console.log('Raw response text:', text)
      
      // JSONパースに失敗した場合のフォールバック
      return NextResponse.json({
        success: true,
        result: {
          transcript: text,
          confidence: 0.7,
          speakers: [{
            speakerTag: 1,
            text: text,
            startTime: '0s',
            endTime: '0s',
            confidence: 0.7
          }]
        },
        timestamp: new Date().toISOString(),
        source: 'gemini-fallback'
      })
    }
    
  } catch (error) {
    console.error(`=== GEMINI API ERROR OCCURRED (Request ID: ${requestId}) ===`)
    console.error('Error at step: Unknown - check logs above for last completed step')
    console.error('Error object:', error)
    console.error('Error message:', error instanceof Error ? error.message : 'No message')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error type:', error?.constructor?.name || 'UnknownError')
    console.error('=== END GEMINI API ERROR ===')
    
    return NextResponse.json({
      error: 'Gemini API processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || 'UnknownError',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}