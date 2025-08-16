import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY

if (!apiKey) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not defined')
}

const genAI = new GoogleGenerativeAI(apiKey)

// Gemini Pro モデルを取得
export const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

// ファクトチェック用のプロンプト
export const factCheckPrompt = (statement: string) => `
以下の発言に対してファクトチェックを行い、信頼性の高い情報を基に評価してください：

発言: "${statement}"

以下の形式で回答してください：
- 評価: [正確/部分的に正確/不正確/不明]
- 理由: [具体的な理由と根拠]
- 補足情報: [追加の関連情報があれば]
`

// 反論提案用のプロンプト
export const rebuttalPrompt = (userClaim: string, opponentClaim: string) => `
以下の状況で、相手の主張に対する効果的な反論を提案してください：

あなたの主張: "${userClaim}"
相手の主張: "${opponentClaim}"

論理的で建設的な反論を3つ提案してください。各反論には：
1. 反論のポイント
2. 根拠となる理由
3. 具体例（可能であれば）

を含めてください。
`

// 用語説明用のプロンプト
export const termExplanationPrompt = (term: string, context: string) => `
以下の用語について、文脈に合わせて分かりやすく説明してください：

用語: "${term}"
文脈: "${context}"

以下の要素を含めて説明してください：
- 基本的な定義
- この文脈での意味
- 関連する重要なポイント
- 具体例（あれば）
`

// AI分析を実行する汎用関数
export async function analyzeWithGemini(prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Gemini API error:', error)
    throw new Error('AI分析中にエラーが発生しました')
  }
}

// ファクトチェック実行
export async function performFactCheck(statement: string): Promise<string> {
  const prompt = factCheckPrompt(statement)
  return analyzeWithGemini(prompt)
}

// 反論提案実行
export async function generateRebuttal(userClaim: string, opponentClaim: string): Promise<string> {
  const prompt = rebuttalPrompt(userClaim, opponentClaim)
  return analyzeWithGemini(prompt)
}

// 用語説明実行
export async function explainTerm(term: string, context: string): Promise<string> {
  const prompt = termExplanationPrompt(term, context)
  return analyzeWithGemini(prompt)
}