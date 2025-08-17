import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!)

export async function POST(request: Request) {
  try {
    const { word, context } = await request.json()
    
    if (!word) {
      return NextResponse.json({ error: '単語が必要です' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    
    const prompt = `
単語「${word}」について、以下の形式で簡潔に説明してください：

【読み方】
【意味】（1-2文で簡潔に）
【例文】（短い例文1つ）

${context ? `文脈：「${context}」` : ''}

注意：
- 難しい専門用語は避ける
- 小学生でも理解できる説明にする
- 簡潔で分かりやすく
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const definition = response.text()

    return NextResponse.json({
      success: true,
      word: word,
      definition: definition.trim()
    })

  } catch (error) {
    console.error('Word definition error:', error)
    return NextResponse.json(
      { error: '単語の説明を取得できませんでした' },
      { status: 500 }
    )
  }
}