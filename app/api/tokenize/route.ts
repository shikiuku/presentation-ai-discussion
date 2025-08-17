import { NextResponse } from 'next/server'
import kuromoji from 'kuromoji'

// Tokenizerをキャッシュ
let tokenizer: any = null

async function getTokenizer() {
  if (tokenizer) return tokenizer
  
  return new Promise((resolve, reject) => {
    // Vercel環境では辞書をCDNから読み込み
    kuromoji.builder({ 
      dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'
    }).build((err, _tokenizer) => {
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
  let requestText = ''
  
  try {
    const { text } = await request.json()
    requestText = text
    
    if (!text) {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 })
    }

    console.log('Attempting to get tokenizer...')
    const tokenizer = await getTokenizer()
    console.log('Tokenizer obtained, processing text:', text.substring(0, 50) + '...')
    
    const tokens = tokenizer.tokenize(text)
    console.log('Tokenization completed, token count:', tokens.length)
    
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
    console.error('Tokenization error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    
    // フォールバック: 簡単な分割を返す
    if (requestText) {
      const fallbackWords = requestText.split(/(\s+|[、。！？])/).map((word: string) => ({
        surface: word,
        reading: word,
        pos: '',
        baseForm: word,
        isContent: word.trim().length >= 2 && !/^\s+$/.test(word) && !/^[、。！？]+$/.test(word)
      }))
      
      return NextResponse.json({
        success: true,
        words: fallbackWords,
        original: requestText,
        fallback: true
      })
    }
    
    return NextResponse.json(
      { 
        error: '形態素解析中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}