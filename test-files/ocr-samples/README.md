# OCR Test Samples / OCR 測試圖片集

此目錄包含用於測試 OCR 辨識功能的樣本圖片。

## 目錄結構

```
ocr-samples/
├── tab/           # 六線譜 (Guitar Tab) 測試圖片
├── staff/         # 五線譜 (Staff) 測試圖片
└── jianpu/        # 簡譜 (Jianpu) 測試圖片
```

## 測試圖片命名規則

建議使用以下命名格式：
- `simple-XX.png` - 簡單的單音樂譜
- `chord-XX.png` - 包含和弦
- `techniques-XX.png` - 包含技巧標記 (如 h, p, b)
- `accidentals-XX.png` - 包含升降記號
- `octaves-XX.png` - 包含八度標記
- `duration-XX.png` - 包含時值標記

## 測試標準

| 類型 | 目標準確率 |
|------|-----------|
| Tab OCR | > 90% (簡單譜面) |
| Staff OCR | > 85% (簡單譜面) |
| Jianpu OCR | > 90% (簡單譜面) |

## 如何新增測試圖片

1. 準備清晰的樂譜圖片
2. 建議使用白底黑字
3. 圖片寬度建議 400-1200 像素
4. 放入對應的子目錄
