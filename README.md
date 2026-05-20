# 🎙️ iNote v2 – 即時語音筆記 Web App

> 免費、無需後端、無需付費API的語音轉文字筆記，針對手機使用優化。

## ✨ v2 新功能

| 功能 | 說明 |
|------|------|
| 🎙 錄音回播 | MediaRecorder 儲存音訊，筆記內可回播 |
| 🎥 字幕同步 | 回播時自動醒目關鍵字幕，點擊字幕可跳轉 |
| ✨ AI 總結 | 使用 HuggingFace mT5 多語言模型，免費、無需API Key |
| 📝 字幕/總結/全文分頁 | 筆記詳情分三個小頁果分開顯示 |
| 🔍 搜尋筆記 | 全文搜尋所有筆記 |
| 🗑 刪除筆記 | 在筆記列表刪除 |
| ⏱ 錄音計時 | 顯示錄音時長 |

## 🚀 快速開始

### GitHub Pages (免費托管)
1. 進入倉庫 Settings → Pages
2. Source 選 **Deploy from branch → main → / (root)**
3. 儲存後等一分鐘，訪問：
```
https://leohkz.github.io/iNote
```

### 本地開發
```bash
git clone https://github.com/leohkz/iNote.git
cd iNote
npx serve .
```

## 🛠️ 技術架構

| 功能 | 技術 |
|------|------|
| 語音識別 | Web Speech API (`zh-HK`/`zh-TW`/`zh-CN`/`en-US`) |
| 錄音儲存 | MediaRecorder API → Base64 儲入 localStorage |
| AI 總結 | HuggingFace mT5_multilingual_XLSum (免費) |
| 本地備用 | 詞頻抽取式摘要 |
| 資料儲存 | localStorage |
| 樣式 | 純 CSS Variables 双主題 |
| 部署 | GitHub Pages |

## ⚠️ 注意事項

- **語音識別需要 Chrome**（Android 或桌面）
- **錄音以 Base64 儲入 localStorage**，3MB 以内的錄音會自動儲存
- **AI 總結**使用 HuggingFace 免費 API，高峰期可能較慢，會自動備用本地摘要
- iOS Safari 語音支援有限，建議 Android Chrome

## 📄 授權

MIT License
