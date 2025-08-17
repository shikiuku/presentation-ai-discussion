import { NextResponse } from 'next/server'
import kuromoji from 'kuromoji'
import path from 'path'

// Kuromojiの辞書パスを設定
const dicPath = path.resolve('./node_modules/kuromoji/dict')

// Tokenizerをキャッシュ
let tokenizer: any = null

async function getTokenizer() {
  if (tokenizer) return tokenizer
  
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, _tokenizer) => {
      if (err) {
        reject(err)
      } else {
        tokenizer = _tokenizer
        resolve(tokenizer)
      }
    })
  })
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 })
    }

    const tokenizer = await getTokenizer()
    const tokens = tokenizer.tokenize(text)
    
    // 単語情報を整形
    const words = tokens.map((token: any) => ({
      surface: token.surface_form, // 表層形
      reading: token.reading || token.surface_form, // 読み
      pos: token.pos, // 品詞
      baseForm: token.basic_form || token.surface_form, // 基本形
      // 品詞の詳細情報から意味のある情報を抽出
      isContent: !['助詞', '助動詞', '記号', 'フィラー', 'その他'].includes(token.pos.split(',')[0])
    }))

    return NextResponse.json({
      success: true,
      words: words,
      original: text
    })

  } catch (error) {
    console.error('Tokenization error:', error)
    return NextResponse.json(
      { error: '形態素解析中にエラーが発生しました' },
      { status: 500 }
    )
  }
}