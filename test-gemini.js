// Gemini API連続テスト用スクリプト
const fs = require('fs');

async function testGeminiAPI() {
  console.log('=== Gemini API連続テストを開始 ===');
  
  // 小さなテスト用音声データを作成（最小限のWebMデータ）
  const testAudioData = Buffer.from([
    0x1a, 0x45, 0xdf, 0xa3, // EBML header
    0x9f, 0x42, 0x86, 0x81, 0x01, // 最小限のWebMヘッダー
    // 実際の音声データは省略、最小限のサイズにする
  ]);
  
  // FormDataを模擬
  const formData = new FormData();
  const blob = new Blob([testAudioData], { type: 'audio/webm' });
  formData.append('audio', blob, 'test.webm');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- テスト ${i} 回目 ---`);
    
    try {
      const response = await fetch('http://localhost:3010/api/gemini-speech', {
        method: 'POST',
        body: formData
      });
      
      console.log(`レスポンス状態: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`成功: リクエストID ${data.requestId}`);
      } else {
        const errorText = await response.text();
        console.log(`エラー: ${errorText}`);
      }
      
      // 5秒待機
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error(`リクエスト ${i} でエラー:`, error.message);
    }
  }
}

// Node.js環境で実行
testGeminiAPI().catch(console.error);