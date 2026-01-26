# 🎸 Guitar Scale Mixer 使用指南

> 一個功能強大的吉他音階學習與練習工具

---

## 📋 目錄

1. [專案簡介](#專案簡介)
2. [快速開始](#快速開始)
3. [功能詳解](#功能詳解)
4. [使用教學](#使用教學)
5. [專案結構](#專案結構)
6. [技術架構](#技術架構)
7. [常見問題](#常見問題)

---

## 專案簡介

**Guitar Scale Mixer** 是一款專為吉他學習者設計的互動式網頁應用程式。它提供視覺化的吉他指板、豐富的音階資料庫，以及即時音高偵測功能，幫助你更有效率地學習和練習音階。

### ✨ 主要特色

- 🎼 **22 種音階類型** - 從基礎到進階，涵蓋各種音樂風格
- 🎹 **多音階疊加** - 同時顯示最多 3 個音階，方便比較學習
- 🎤 **即時音高偵測** - 透過麥克風即時分析你演奏的音符
- 🎸 **多種吉他音色** - 7 種不同吉他音色供選擇
- 💾 **雲端儲存** - 儲存你的音階組合設定

---

## 快速開始

### 系統需求

- Node.js 18+ 或 Bun
- 現代瀏覽器 (Chrome, Firefox, Safari, Edge)
- 麥克風 (使用即時模式時需要)

### 安裝步驟

#### 1. 複製專案

```bash
git clone <repository-url>
cd guitar-scale-mixer
```

#### 2. 安裝依賴

使用 Bun (推薦):
```bash
bun install
```

或使用 npm:
```bash
npm install
```

#### 3. 設定環境變數

複製環境變數範例檔：
```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入你的 Supabase 連線資訊：
```env
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_supabase_anon_key
```

#### 4. 啟動開發伺服器

```bash
bun run dev
# 或
npm run dev
```

#### 5. 開啟瀏覽器

訪問 `http://localhost:5173` 開始使用！

### 其他指令

| 指令 | 說明 |
|------|------|
| `bun run dev` | 啟動開發伺服器 (支援熱更新) |
| `bun run build` | 建置生產版本 |
| `bun run preview` | 本地預覽生產版本 |
| `bun run lint` | 執行程式碼檢查 |

---

## 功能詳解

### 🎼 音階模式 (Scale Mode)

這是主要的學習模式，讓你在視覺化的指板上探索各種音階。

#### 支援的音階類型

**大調調式 (Major Modes)**
| 音階 | 英文名 | 特色 |
|------|--------|------|
| Major | Ionian | 明亮、歡樂的基礎大調 |
| Dorian | Dorian | 小調帶有明亮的六度 |
| Phrygian | Phrygian | 西班牙/Flamenco 風格 |
| Lydian | Lydian | 夢幻、飄渺的感覺 |
| Mixolydian | Mixolydian | 藍調、搖滾常用 |
| Aeolian | Natural Minor | 自然小調 |
| Locrian | Locrian | 不穩定、緊張感 |

**小調變體**
| 音階 | 英文名 | 特色 |
|------|--------|------|
| Harmonic Minor | 和聲小調 | 古典、中東風格 |
| Melodic Minor | 旋律小調 | 爵士常用 |

**五聲音階與藍調**
| 音階 | 英文名 | 特色 |
|------|--------|------|
| Major Pentatonic | 大調五聲 | 鄉村、流行樂 |
| Minor Pentatonic | 小調五聲 | 搖滾、藍調基礎 |
| Blues | 藍調音階 | 加入藍調音的五聲音階 |

**對稱音階**
| 音階 | 英文名 | 特色 |
|------|--------|------|
| Whole Tone | 全音音階 | 夢幻、模糊感 |
| Diminished (HW) | 減音階 (半全) | 爵士、金屬 |
| Diminished (WH) | 減音階 (全半) | 和弦配對用 |
| Chromatic | 半音音階 | 所有 12 個音 |

**異國/世界音階**
| 音階 | 英文名 | 特色 |
|------|--------|------|
| Phrygian Dominant | 弗里幾亞屬音階 | 中東、西班牙 |
| Hungarian Minor | 匈牙利小調 | 吉普賽風格 |
| Japanese (In Sen) | 日本音階 | 東方神秘感 |
| Arabic | 阿拉伯音階 | 中東風情 |

---

### 🎤 即時模式 (Live Mode)

透過麥克風即時偵測你演奏的音符，並在指板上顯示位置。

#### 功能特點

- **音高偵測** - 精確識別你彈奏的音符
- **八度顯示** - 顯示完整的音符名稱 (如 C4, E3)
- **音程標記** - 顯示相對於根音的音程關係
- **視覺反饋** - 在指板上即時標記偵測到的位置

---

### 🎸 吉他音色

提供 7 種不同的吉他音色：

| 音色 | 說明 | 適用風格 |
|------|------|----------|
| Acoustic Nylon | 尼龍弦古典吉他 | 古典、佛朗明哥 |
| Acoustic Steel | 鋼弦民謠吉他 | 民謠、流行 |
| Electric Clean | 電吉他清音 | 流行、R&B |
| Electric Jazz | 爵士電吉他 | 爵士、Fusion |
| Electric Muted | 悶音電吉他 | Funk、節奏 |
| Distortion | 破音電吉他 | 搖滾、金屬 |
| Overdriven | 過載電吉他 | 藍調、經典搖滾 |

---

### ⚙️ 設定選項

#### 指板設定
- **指板格數** - 可選擇 12 到 22 格
- **顯示模式** - 切換音符名稱或音程顯示

#### 音階設定
- **根音選擇** - 12 個根音 (C 到 B)
- **音階類型** - 22 種音階可選
- **音符開關** - 可單獨啟用/停用特定音符

---

## 使用教學

### 教學一：基礎音階學習

1. **選擇根音**
   - 在左側面板選擇你想學習的根音 (例如：A)

2. **選擇音階**
   - 從下拉選單選擇音階類型 (例如：Minor Pentatonic)

3. **觀察指板**
   - 指板上會以顏色標記該音階的所有音符位置
   - 不同的音符會有不同的顏色便於識別

4. **點擊音符**
   - 點擊指板上的音符可以播放該音的聲音
   - 使用右上角的吉他選擇器更換音色

### 教學二：多音階比較

1. **新增第二個音階**
   - 點擊「Scale Count」選擇器，選擇 2 或 3

2. **設定不同音階**
   - 為每個音階選擇不同的根音和類型
   - 例如：比較 A Minor Pentatonic 和 A Blues Scale

3. **觀察共同音**
   - 重疊的區域會顯示多個音階共有的音符
   - 這對於理解音階關係非常有幫助

### 教學三：即時練習模式

1. **切換到 Live Mode**
   - 點擊導航列的「Live」按鈕

2. **允許麥克風權限**
   - 瀏覽器會詢問麥克風權限，請允許

3. **開始演奏**
   - 彈奏吉他，系統會自動偵測音符
   - 偵測到的音符會在指板上即時顯示

4. **設定根音**
   - 選擇你正在練習的音階根音
   - 系統會顯示音程關係幫助你理解

### 教學四：儲存你的設定

1. **登入帳號**
   - 點擊登入/註冊以使用雲端功能

2. **儲存預設**
   - 設定好你喜歡的音階組合後
   - 點擊「儲存」按鈕並命名

3. **載入預設**
   - 下次使用時可以快速載入之前的設定

---

## 專案結構

```
guitar-scale-mixer/
├── 📄 index.html          # 應用程式入口 HTML
├── 📄 package.json        # 專案設定與依賴
├── 📄 vite.config.js      # Vite 建置設定
├── 📄 eslint.config.js    # ESLint 設定
├── 📄 deploy.sh           # 部署腳本
├── 📄 .env                # 環境變數 (不會上傳到 Git)
├── 📄 .env.example        # 環境變數範例
│
├── 📁 src/                # 主要程式碼
│   ├── 📄 main.jsx        # React 應用程式進入點
│   ├── 📄 App.jsx         # 主要應用元件
│   ├── 📄 App.css         # 主要樣式
│   ├── 📄 index.css       # 全域樣式
│   │
│   ├── 📁 components/     # UI 元件
│   │   ├── 📄 Fretboard.jsx           # 吉他指板 (主要)
│   │   ├── 📄 LiveFretboard.jsx       # 即時模式指板
│   │   ├── 📄 LiveMode.jsx            # 即時模式主元件
│   │   ├── 📄 ScalePanel.jsx          # 音階控制面板
│   │   ├── 📄 ScalePanelCompact.jsx   # 音階控制 (精簡版)
│   │   ├── 📄 SettingsPage.jsx        # 設定頁面
│   │   ├── 📄 GuitarSelector.jsx      # 吉他音色選擇
│   │   ├── 📄 DisplayModeSelector.jsx # 顯示模式切換
│   │   ├── 📄 ScaleCountSelector.jsx  # 音階數量選擇
│   │   ├── 📄 AudioInputPanel.jsx     # 音訊輸入設定
│   │   ├── 📄 AudioInputCompact.jsx   # 音訊輸入 (精簡版)
│   │   ├── 📄 Navigation.jsx          # 導航列
│   │   ├── 📄 ProtectedRoute.jsx      # 受保護路由
│   │   └── 📄 *.css                   # 對應的樣式檔
│   │
│   ├── 📁 pages/          # 頁面元件
│   │   ├── 📄 LoginPage.jsx           # 登入頁面
│   │   ├── 📄 RegisterPage.jsx        # 註冊頁面
│   │   └── 📄 AuthPages.css           # 認證頁面樣式
│   │
│   ├── 📁 hooks/          # 自訂 React Hooks
│   │   ├── 📄 useAudio.js             # 音訊播放邏輯
│   │   ├── 📄 usePitchDetection.js    # 音高偵測邏輯
│   │   └── 📄 usePresets.js           # 預設管理邏輯
│   │
│   ├── 📁 contexts/       # React Context
│   │   └── 📄 AuthContext.jsx         # 用戶認證狀態
│   │
│   ├── 📁 data/           # 資料定義
│   │   └── 📄 scaleData.js            # 音階、音程資料
│   │
│   ├── 📁 lib/            # 外部服務整合
│   │   └── 📄 supabase.js             # Supabase 客戶端
│   │
│   └── 📁 assets/         # 靜態資源
│
└── 📁 public/             # 公開靜態檔案
```

---

## 技術架構

### 前端技術

| 技術 | 版本 | 用途 |
|------|------|------|
| React | 19.2 | UI 框架 |
| Vite | 7.2 | 建置工具 |
| React Router DOM | 7.11 | 路由管理 |

### 音訊處理

| 套件 | 用途 |
|------|------|
| Tone.js | 音訊生成與處理 |
| soundfont-player | 吉他音色播放 |
| pitchfinder | 音高偵測演算法 |

### 後端服務

| 服務 | 用途 |
|------|------|
| Supabase | 用戶認證與資料儲存 |

---

## 常見問題

### Q: 為什麼麥克風沒有反應？

**A:** 請確認：
1. 瀏覽器已允許麥克風權限
2. 使用 HTTPS 或 localhost (HTTP 不支援麥克風)
3. 麥克風設備正常運作

### Q: 為什麼沒有聲音？

**A:** 請確認：
1. 瀏覽器沒有靜音
2. 第一次使用需要先點擊頁面才能播放音訊
3. 等待音色載入完成

### Q: 如何部署到線上？

**A:** 執行以下指令：
```bash
bun run build
```
建置完成後，將 `dist` 資料夾部署到任何靜態網站託管服務。

或使用部署腳本：
```bash
./deploy.sh
```

### Q: 環境變數如何取得？

**A:** 
1. 前往 [Supabase](https://supabase.com) 建立專案
2. 在專案設定中找到 API URL 和 anon key
3. 將這些值填入 `.env` 檔案

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

## 📄 授權

MIT License

---

**Happy Playing! 🎸🎶**
