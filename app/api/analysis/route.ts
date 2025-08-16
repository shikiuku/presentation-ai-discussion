import { NextResponse } from 'next/server'
import { performFactCheck, generateRebuttal, explainTerm } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const { type, text, userClaim, opponentClaim, term, context } = await request.json()

    let result: string

    switch (type) {
      case 'fact-check':
        if (!text) {
          return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 })
        }
        result = await performFactCheck(text)
        break

      case 'rebuttal':
        if (!userClaim || !opponentClaim) {
          return NextResponse.json({ error: 'ユーザーの主張と相手の主張が必要です' }, { status: 400 })
        }
        result = await generateRebuttal(userClaim, opponentClaim)
        break

      case 'term-explanation':
        if (!term || !context) {
          return NextResponse.json({ error: '用語と文脈が必要です' }, { status: 400 })
        }
        result = await explainTerm(term, context)
        break

      default:
        return NextResponse.json({ error: '不正な分析タイプです' }, { status: 400 })
    }

    return NextResponse.json({ 
      result,
      timestamp: new Date().toISOString(),
      type
    })

  } catch (error) {
    console.error('Analysis API error:', error)
    return NextResponse.json(
      { error: 'AI分析中にエラーが発生しました' },
      { status: 500 }
    )
  }
}