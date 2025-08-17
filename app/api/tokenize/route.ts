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

// より実用的な日本語トークン化関数
function createPracticalTokens(text: string) {
  // 文字種別を判定する関数
  const isHiragana = (char: string) => /[\u3040-\u309F]/.test(char)
  const isKatakana = (char: string) => /[\u30A0-\u30FF]/.test(char)
  const isKanji = (char: string) => /[\u4E00-\u9FAF]/.test(char)
  const isAlpha = (char: string) => /[A-Za-z]/.test(char)
  const isNumeric = (char: string) => /[0-9]/.test(char)
  const isPunctuation = (char: string) => /[、。！？「」『』（）\s]/.test(char)
  
  const tokens = []
  let currentToken = ''
  let currentType = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    let charType = ''
    
    if (isPunctuation(char)) charType = 'punctuation'
    else if (isHiragana(char)) charType = 'hiragana'
    else if (isKatakana(char)) charType = 'katakana'
    else if (isKanji(char)) charType = 'kanji'
    else if (isAlpha(char)) charType = 'alpha'
    else if (isNumeric(char)) charType = 'numeric'
    else charType = 'other'
    
    // 同じ文字種なら継続、違うなら区切り
    if (currentType === charType && charType !== 'punctuation') {
      currentToken += char
    } else {
      if (currentToken) {
        tokens.push({
          surface: currentToken,
          reading: currentToken,
          pos: currentType,
          baseForm: currentToken,
          isContent: ['kanji', 'katakana', 'alpha', 'numeric'].includes(currentType) && currentToken.length >= 1
        })
      }
      currentToken = char
      currentType = charType
    }
  }
  
  // 最後のトークンを追加
  if (currentToken) {
    tokens.push({
      surface: currentToken,
      reading: currentToken,
      pos: currentType,
      baseForm: currentToken,
      isContent: ['kanji', 'katakana', 'alpha', 'numeric'].includes(currentType) && currentToken.length >= 1
    })
  }
  
  return tokens
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 })
    }

    console.log('Processing text with practical tokenizer:', text.substring(0, 50) + '...')
    
    // 実用的なトークン化を使用（高速で確実）
    const words = createPracticalTokens(text)
    console.log('Practical tokenization completed, token count:', words.length)

    return NextResponse.json({
      success: true,
      words: words,
      original: text,
      method: 'practical'
    })

  } catch (error) {
    console.error('Tokenization error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    
    return NextResponse.json(
      { 
        error: '形態素解析中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}