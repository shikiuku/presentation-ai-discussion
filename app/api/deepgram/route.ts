import { NextResponse } from 'next/server'
import { createClient } from '@deepgram/sdk'

export async function POST(request: Request) {
  console.log('=== Deepgram API endpoint called ===')
  
  // 環境変数のチェック
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('DEEPGRAM_API_KEY is not set in environment variables')
    return NextResponse.json(
      { error: 'Deepgram APIキーが設定されていません' },
      { status: 500 }
    )
  }
  
  console.log('Deepgram API key is set:', process.env.DEEPGRAM_API_KEY ? 'YES' : 'NO')
  console.log('API Key length:', process.env.DEEPGRAM_API_KEY?.length || 0)

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY)
  try {
    console.log('Parsing form data...')
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    console.log('Audio file received:', audioFile ? `${audioFile.name} (${audioFile.size} bytes)` : 'NO FILE')
    
    if (!audioFile) {
      console.error('No audio file provided')
      return NextResponse.json({ error: '音声ファイルが必要です' }, { status: 400 })
    }

    // 音声ファイルをBufferに変換
    console.log('Converting audio file to buffer...')
    const audioBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(audioBuffer)
    console.log('Buffer created successfully, size:', buffer.length, 'bytes')

    // 音声ファイルのmimeTypeとサイズを確認
    console.log('Audio file details:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      bufferSize: buffer.length
    })

    // 最小サイズチェック
    if (buffer.length < 100) {
      console.error('Audio buffer too small:', buffer.length, 'bytes')
      return NextResponse.json({ 
        error: '音声データが小さすぎます',
        details: `受信サイズ: ${buffer.length} bytes` 
      }, { status: 400 })
    }

    // Deepgram APIにリクエスト
    console.log('Calling Deepgram API...')
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        language: 'ja',
        punctuate: true,
        diarize: true,  // 話者識別を有効化
        smart_format: true,
        utterances: true,  // 発話ごとに区切る
        paragraphs: true,  // 段落の検出
        detect_language: false,  // 言語検出を無効化（日本語固定）
        vad_events: true,  // 音声活動検出イベント
        endpointing: 300,  // 無音期間300msで発話終了を検出
      }
    )
    
    console.log('Deepgram API call successful')
    console.log('Raw result:', JSON.stringify(result, null, 2))

    // レスポンスの整形
    const response = {
      transcript: result.results?.channels[0]?.alternatives[0]?.transcript || '',
      confidence: result.results?.channels[0]?.alternatives[0]?.confidence || 0,
      speakers: [] as any[]
    }

    // 話者ごとの発話を整理
    if (result.results?.utterances) {
      response.speakers = result.results.utterances.map((utterance: any) => ({
        speakerTag: utterance.speaker + 1, // 0ベースを1ベースに変換
        text: utterance.transcript,
        startTime: `${utterance.start}s`,
        endTime: `${utterance.end}s`,
        confidence: utterance.confidence
      }))
    } else if (result.results?.channels[0]?.alternatives[0]?.words) {
      // utterancesがない場合はwordsから再構築
      const words = result.results.channels[0].alternatives[0].words
      let currentSpeaker = null
      let currentText = ''
      let currentStartTime = null
      const speakers = []

      for (const word of words) {
        const speakerTag = (word.speaker || 0) + 1
        
        if (currentSpeaker !== speakerTag) {
          if (currentSpeaker !== null && currentText.trim()) {
            speakers.push({
              speakerTag: currentSpeaker,
              text: currentText.trim(),
              startTime: currentStartTime,
              endTime: `${word.start}s`
            })
          }
          currentSpeaker = speakerTag
          currentText = word.punctuated_word || word.word || ''
          currentStartTime = `${word.start}s`
        } else {
          currentText += ' ' + (word.punctuated_word || word.word || '')
        }
      }

      // 最後のセグメントを追加
      if (currentText.trim() && words.length > 0) {
        const lastWord = words[words.length - 1]
        speakers.push({
          speakerTag: currentSpeaker,
          text: currentText.trim(),
          startTime: currentStartTime,
          endTime: `${lastWord.end}s`
        })
      }

      response.speakers = speakers
    }

    console.log('Final response:', response)
    console.log('=== Deepgram API endpoint completed successfully ===')

    return NextResponse.json({
      success: true,
      result: response,
      timestamp: new Date().toISOString(),
      source: 'deepgram'
    })

  } catch (error) {
    console.error('Deepgram API error:', error)
    
    // エラーの詳細を判別
    let errorMessage = '音声認識中にエラーが発生しました'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = 'APIキーが無効です。環境変数を確認してください。'
        statusCode = 401
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください。'
        statusCode = 429
      }
      
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      })
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}