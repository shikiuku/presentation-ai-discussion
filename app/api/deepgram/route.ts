import { NextResponse } from 'next/server'
import { createClient } from '@deepgram/sdk'

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: '音声ファイルが必要です' }, { status: 400 })
    }

    // 音声ファイルをBufferに変換
    const audioBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(audioBuffer)

    // Deepgram APIにリクエスト
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        language: 'ja',
        punctuate: true,
        diarize: true,  // 話者識別を有効化
        smart_format: true,
        utterances: true,  // 発話ごとに区切る
      }
    )

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

    return NextResponse.json({
      success: true,
      result: response,
      timestamp: new Date().toISOString(),
      source: 'deepgram'
    })

  } catch (error) {
    console.error('Deepgram API error:', error)
    return NextResponse.json(
      { error: '音声認識中にエラーが発生しました' },
      { status: 500 }
    )
  }
}