# 🎙️ iNote – 即時語音筆記 Web App

> 免費、無需後端、無需付費API的語音轉文字筆記應用，針對手機使用優化。

## ✨ 功能特色

- 🎤 **即時語音轉文字** — 使用瀏覽器內建 Web Speech API（完全免費）
- ✨ **自動摘要生成** — 本地端抽取式摘要，無需任何外部 API
- 🕐 **時間戳紀錄** — 每次總結附帶時間戳，點擊即可查看該段內容
- 🌙 **亮色 / 暗色主題切換** — 自動記憶主題偏好
- 📱 **手機優先設計** — 響應式介面，適合單手操作

## 🚀 快速開始

1. Clone 此專案：
   ```bash
   git clone https://github.com/leohkz/iNote.git
   cd iNote
   ```
2. 用任意本地伺服器開啟（語音API需要 HTTPS 或 localhost）：
   ```bash
   npx serve .
   # 或直接用 VS Code Live Server
   ```
3. 在 Chrome（手機/電腦）開啟，授予麥克風權限，開始錄音！

## 🌐 直接使用（GitHub Pages）

啟用 GitHub Pages 後，直接訪問：
```
https://leohkz.github.io/iNote
```

## 🛠️ 技術架構

| 功能 | 技術 |
|------|------|
| 語音識別 | Web Speech API（免費，瀏覽器內建）|
| 摘要算法 | 詞頻抽取式摘要（本地運算）|
| 資料儲存 | localStorage（本地儲存）|
| 樣式框架 | 純 CSS（CSS Variables 主題切換）|
| 部署 | GitHub Pages（完全免費）|

## 📱 使用說明

1. **錄音頁面**：點擊「▶ 開始」，說話，即時看到文字。
2. **生成總結**：點擊「✨ 生成總結」，自動摘要並儲存。
3. **總結頁面**：切換到「總結」頁，點擊時間戳按鈕查看內容。
4. **主題切換**：右上角 🌙/☀️ 按鈕切換亮暗模式。

## ⚠️ 注意事項

- 語音識別需要 **Chrome 瀏覽器**（桌面版或 Android 版）
- 需要麥克風授權
- iOS Safari 支援有限，建議使用 Android Chrome
- 總結儲存在本地裝置，清除瀏覽器資料會同時清除筆記

## 📄 授權

MIT License
