# 功能需求更新 - UI/UX 改進

**日期**: 2025-10-23
**狀態**: 待實現
**優先級**: 高

## 需求概述

基於使用者反饋，需要對 UI/UX 進行以下改進，使應用更符合使用者期望。

---

## 1. Ghost Suggestion 直接顯示在輸入框

### 當前實現
- Ghost suggestion 在輸入框下方的單獨框中顯示（淺灰色）

### 新需求
- **Ghost suggestion 應直接顯示在輸入框內**
- 用淺色文字表示可以 Tab 補齊
- 視覺效果類似瀏覽器 URL bar 的自動完成
- **應該有改動就要更新 ghost suggestion**（實時更新，每次輸入/選擇都更新）

### 設計細節
```
輸入框: [am|ygdala (淺灰色)]
         ↑ 用戶輸入: "am"
         ↑ 自動提示: "ygdala" (淺灰色)
         ↑ 任何改動都實時更新
```

### 實現方法
- 使用雙層輸入框設計（推薦）：
  - 真實輸入框（黑色文字，正常輸入）
  - 背景層（淺灰色，顯示完整建議詞）
  - 背景層使用 `pointer-events: none`（避免交互干擾）
  - 前景層 `background: transparent`（讓背景層可見）
  - 同步光標位置和文字寬度
- 在以下時機更新 ghost suggestion：
  - 用戶輸入時（實時，每個 keystroke）
  - 鍵盤選擇建議項時（ArrowUp/Down）
  - 點擊建議項時（即使沒有按 Tab/Enter）

### 涉及文件
- `index.html` - 修改輸入框結構（雙層設計）
- `style.css` - 調整輸入框 positioning 和 z-index
- `index.js` - 每個會改變建議的操作都更新 ghost suggestion

---

## 2. 建議列表框改為 Google Search 風格

### 當前實現
- 建議列表顯示在輸入框下方的固定位置

### 新需求
- **改為類似 Google Search 的設計**（不要懸浮框，要貼著輸入框）
- 推薦框直接黏著輸入框下邊
- **預設要選取第一個建議項**（初始時第一項自動聚焦）
- 鍵盤導航選擇不同項時，Ghost suggestion 實時更新

### 設計細節
```
輸入框: [amyg|dala (淺灰色)]
        ┌──────────────────┐ ← 貼著輸入框，不浮空
        │ amygdala    [✓] │ ← 第一項預設選中
        │ amygdalae       │
        │ amygdalin       │
        └──────────────────┘
```

### 交互行為
- 初始：第一個建議項自動選中（視覺上高亮，focused 狀態）
- 鍵盤 ArrowDown：選擇下一項，ghost suggestion 更新
- 鍵盤 ArrowUp：選擇上一項，ghost suggestion 更新
- 鼠標 Hover：選擇該項，ghost suggestion 更新
- Tab/Enter：確認選擇，如果有選項則替換/提交

### 實現方法建議
- 使用 `position: absolute` 或 `position: relative` 流式佈局
- 建議框黏著輸入框下邊（無間距）
- 容器 `max-width: 100%`，寬度與輸入框一致
- 預設 `state.mainSuggestionIndex = 0`（而非 -1）
- **ArrowUp/ArrowDown 循環導航**（Google 搜尋行為）：
  - 從最後一項按 ArrowDown → 回到第一項
  - 從第一項按 ArrowUp → 回到最後一項

### 涉及文件
- `style.css` - 調整定位為貼著式，移除浮空效果
- `index.js` - 修改初始 suggestion 索引為 0，添加 hover 更新 ghost suggestion

---

## 3. Enter 鍵提交時移除尾部空白

### 當前實現
- 按 Enter 提交查詢後，輸入框可能包含尾部空白

### 新需求
- **提交前自動 trim() 查詢字符串**
- 無需手動移除空白

### 實現方法
```javascript
const query = state.mainInput.trim(); // 已實現
// 但需確保提交時輸入框也被清空或 trim
```

### 涉及文件
- `index.js` - submitMainQuery() 函數

---

## 4. 邏輯運算符選擇器改為 Google Search 風格

### 當前實現
- 運算子選擇器顯示為灰色的 inline 候選框（underlined）

### 新需求
- **改為類似 Google Search 的設計**（貼著輸入框，不要懸浮）
- 類似建議列表的樣式（統一設計）
- 顯示所有可選運算子：[space] [AND] [OR] [NOT]
- **預設選中 AND**（推薦的操作符）

### 設計細節
```
輸入框: [amygdala |]
        ┌──────────────────┐ ← 貼著輸入框
        │   space          │
        │ ✓ AND            │ ← 預設選中
        │   OR
        │   NOT
        └──────────────────┘
```

### 交互行為
- Space 後顯示選擇框，AND 預設選中
- Arrow Up/Down 導航不同運算子
- Enter/Tab 確認選擇並插入運算子
- Esc 取消（保留空格）
- 繼續輸入則隱藏選擇器

### 實現方法建議
- 使用 `position: absolute` 或 `position: relative` 流式佈局
- 與建議列表樣式統一（相同的邊框、背景、字體）
- 預設 `state.operatorIndex = 1`（AND 在索引 1）
- **運算子顯示**：
  - Space 運算子顯示為空白（中間留空）
  - AND/OR/NOT 顯示為大寫字母

### 涉及文件
- `style.css` - 新增運算子選擇器樣式（與建議列表統一）
- `index.js` - 更新 showOperatorChooser() 使用相同的 DOM 和樣式類

---

## 5. 關聯詞面板改為單欄 + 排序切換按鈕

### 當前實現
- 兩欄並排顯示：co_count 欄和 jaccard 欄

### 新需求
- **改為單欄顯示**
- **添加按鈕切換排序方式**：「按 co_count」「按 jaccard」
- 點擊按鈕切換排序，列表動態更新

### 設計細節
```
Related Terms
┌──────────────────────────────┐
│ [按 co_count] [按 jaccard]  │
├──────────────────────────────┤
│ 1. emotional                 │
│ 2. emotion                   │
│ 3. neutral                   │
│    ...                       │
└──────────────────────────────┘
```

### 交互
- 默認：按 co_count 排序
- 點擊「按 jaccard」按鈕：重新排序並顯示
- 點擊「按 co_count」按鈕：回到 co_count 排序

### 實現方法
```javascript
// State
state.relatedSortBy = 'co_count'; // or 'jaccard'

// 函數
function renderRelatedTerms(related, sortBy = 'co_count') {
  const sorted = [...related].sort((a, b) =>
    sortBy === 'co_count'
      ? b.co_count - a.co_count
      : b.jaccard - a.jaccard
  );
  // 渲染排序後的列表
}
```

### 涉及文件
- `index.html` - 移除雙欄結構，添加排序按鈕
- `style.css` - 移除 grid 佈局，改為單欄
- `index.js` - 修改 renderRelatedTerms()，添加排序邏輯

---

## 5.5 相關詞面板 - 添加 Top-K 選擇按鈕

### 新增需求
- 當前未實現「選擇要顯示多少個相關詞」的功能
- **需要添加按鈕讓用戶選擇 Top-K**：10 / 20 / 50

### 設計細節
```
Related Terms
┌────────────────────────────────────────┐
│ [按 co_count] [按 jaccard]             │
│ 顯示: [Top 10] [Top 20] [Top 50]       │
├────────────────────────────────────────┤
│ 1. emotional                           │
│ 2. emotion                             │
│ 3. neutral                             │
│    ...                                 │
└────────────────────────────────────────┘
```

### 交互行為
- 默認：Top 10, 按 co_count 排序
- 點擊「按 jaccard」：切換排序，保持當前 Top-K 設定
- 點擊「Top 20」/「Top 50」：顯示更多項目，保持當前排序方式

### 實現方法
```javascript
state.relatedTopK = 10;      // 默認 10
state.relatedSortBy = 'co_count'; // 默認 co_count

function renderRelatedTerms(related, sortBy = 'co_count', topK = 10) {
  const sorted = [...related].sort((a, b) =>
    sortBy === 'co_count'
      ? b.co_count - a.co_count
      : b.jaccard - a.jaccard
  ).slice(0, topK);  // 取前 topK 個
  // 渲染排序後的列表
}
```

### 涉及文件
- `index.html` - 添加 Top-K 選擇按鈕
- `style.css` - 按鈕樣式
- `index.js` - renderRelatedTerms() 接收 topK 參數，按鈕事件監聽

---

## 6. Hover 信息增加排名信息 - 基於全部相關詞

### 當前實現
- Hover 顯示：`co_count: 726, jaccard: 0.2835`

### 新需求
- **Hover 時顯示排名**：
  - **排名應基於「全部相關詞」，不是基於當前顯示的 Top-K**
  - co_count 數值和排名（e.g., "#1 in co_count"）
  - jaccard 數值和排名（e.g., "#3 in jaccard"）

### 設計細節
```
假設相關詞列表有 50 項，但只顯示 Top 10

Hover "emotional" 時：
────────────────────────────────────────
emotional
co_count: 726 (#1 in co_count)      ← 在全部 50 項中排第 1
jaccard: 0.2835 (#2 in jaccard)     ← 在全部 50 項中排第 2
────────────────────────────────────────
```

### 實現方法
```javascript
function renderRelatedTerms(related, sortBy = 'co_count', topK = 10) {
  // =========== 第一步：計算全部相關詞的排名（基準） ===========
  // 這些排名是基於「全部 related 列表」的，不管最後顯示多少個

  const byCoCount = [...related].sort((a,b) => b.co_count - a.co_count);
  const coCountRanks = new Map();
  byCoCount.forEach((item, idx) => {
    coCountRanks.set(item.term, idx + 1);  // 在全部中的排名
  });

  const byJaccard = [...related].sort((a,b) => b.jaccard - a.jaccard);
  const jaccardRanks = new Map();
  byJaccard.forEach((item, idx) => {
    jaccardRanks.set(item.term, idx + 1);  // 在全部中的排名
  });

  // =========== 第二步：按選擇的排序方式和 Top-K 過濾要顯示的項 ===========
  const sorted = [...related].sort((a, b) =>
    sortBy === 'co_count'
      ? b.co_count - a.co_count
      : b.jaccard - a.jaccard
  ).slice(0, topK);  // 只取前 topK 個

  // =========== 第三步：渲染時使用全部計算的排名 ===========
  sorted.forEach(item => {
    const scoresDiv = document.createElement('div');
    // 重要：這裡使用的排名是基於全部相關詞的排名，不是基於當前顯示的 topK
    scoresDiv.textContent =
      `co_count: ${item.co_count} (#${coCountRanks.get(item.term)} in co_count), ` +
      `jaccard: ${item.jaccard.toFixed(4)} (#${jaccardRanks.get(item.term)} in jaccard)`;
  });
}
```

### 涉及文件
- `index.js` - 修改 renderRelatedTerms() 和 createRelatedTermElement()
  - 在函數開始計算全部相關詞的排名
  - 創建元素時使用這些排名

---

## 7. 移除所有 Copy 按鈕

### 當前實現
- 主查詢建議列表：每項有 Copy 按鈕
- 關聯詞項目：每項有 Copy 按鈕

### 新需求
- **移除所有 Copy 按鈕**
- 用戶可以手動選中並複製

### 涉及文件
- `index.html` - 無需修改（按鈕在 JS 中動態創建）
- `style.css` - 移除 `.copy-btn` 和 `.related-copy-btn` 樣式
- `index.js` - 移除所有 copyToClipboard() 相關代碼
  - 移除建議項目中的 copy 按鈕創建（第 281-288 行）
  - 移除關聯詞項目中的 copy 按鈕創建（第 424-431 行）
  - 移除 copyToClipboard() 函數（第 344-358 行）

---

## 實現優先級

| 序號 | 功能 | 優先級 | 難度 |
|------|------|--------|------|
| 7 | 移除 Copy 按鈕 | 低 | 低 |
| 3 | Enter 移除空白 | 低 | 低 |
| 5 | 關聯詞單欄+按鈕+Top-K 選擇 | 中 | 低 |
| 6 | Hover 顯示排名（基於全部） | 中 | 中 |
| 1 | Ghost suggestion 在輸入框內（雙層） | 高 | 中 |
| 2 | 建議列表改為 Google 風格 | 高 | 中 |
| 4 | 運算子選擇器改為 Google 風格 | 高 | 中 |

---

## 實現順序建議

### 第一輪（基礎修改 - 最快完成）
1. **7. 移除 Copy 按鈕**（最簡單，<10 分鐘）
2. **3. Enter 移除空白**（簡單，<5 分鐘）
3. **5. 關聯詞單欄 + 排序按鈕 + Top-K 選擇**（中等難度，30-45 分鐘）

完成後效果：
- UI 更乾淨（無 Copy）
- 關聯詞面板更靈活（可選擇 Top-10/20/50）
- 用戶可更好地控制顯示內容

### 第二輪（核心 UI 改進 - 改動最大）
4. **1. Ghost suggestion 在輸入框內（雙層設計）**（中等難度，1-1.5 小時）
   - 需要改 HTML 結構（雙層輸入框）
   - 需要 CSS positioning 和 z-index 調整
   - 需要 JS 同步光標位置和寬度

5. **2. 建議列表改為 Google 搜尋風格**（中等難度，1-1.5 小時）
   - 改為貼著輸入框（無浮空）
   - 預設選中第一項
   - 實時更新 ghost suggestion

6. **4. 運算子選擇器改為 Google 搜尋風格**（中等難度，45-60 分鐘）
   - 風格與建議列表統一
   - 預設選中 AND
   - 貼著輸入框

完成後效果：
- UI 風格統一（Google 搜尋風格）
- Ghost suggestion 實時同步
- 鍵盤和鼠標交互一致

### 第三輪（增強功能）
7. **6. Hover 顯示排名（基於全部相關詞）**（中等難度，45-60 分鐘）
   - 計算全部相關詞的排名
   - 在 hover 時顯示排名信息
   - 排名基於全部，不是當前顯示的 Top-K

完成後效果：
- 用戶可以了解詞彙在全部相關詞中的排名
- 提供更多上下文信息

---

## 技術注意事項

### Ghost Suggestion 實現（雙層輸入框）
```html
<!-- 外層容器 -->
<div class="input-wrapper">
  <!-- 背景層：顯示完整建議詞（淺灰色） -->
  <input id="mainInputBg" type="text" disabled readonly />

  <!-- 前景層：真實輸入框（黑色，光標可見） -->
  <input id="mainInput" type="text" placeholder="..." />
</div>
```

CSS 要點：
- 背景層和前景層使用絕對定位疊起來
- 前景層 `background: transparent` 讓背景層可見
- 兩層使用相同的字體/大小/行高以對齊
- 需要同步寬度和光標位置

JS 要點：
- 每次用戶輸入，提取當前單詞，查詢第一個建議
- 更新背景層值為完整建議詞
- 每個改變建議的操作都要更新（Arrow、Click、直接輸入）

### Google 搜尋風格建議列表
- 列表應貼著輸入框下邊（`margin-top: 0`）
- 列表寬度 = 輸入框寬度
- 預設選中第一項（`state.mainSuggestionIndex = 0`）
- Hover 項目時更新 ghost suggestion
- 點擊時替換/提交

### 性能考慮
- Ghost suggestion 更新（實時，每個 keystroke）→ 已有 debounce，OK
- 排名計算（在 API 響應時一次性計算，使用 Map 存儲）→ O(n log n) 可接受
- Top-K 選擇（直接 slice，效率高）

### 浮點數格式化
- Jaccard 值顯示為 4 位小數：`.toFixed(4)`

---

## 相關文件變更清單

| 文件 | 變更類型 | 說明 |
|------|--------|------|
| `index.html` | 修改 | 移除 ghost suggestion div，調整關聯詞面板結構 |
| `style.css` | 修改 | 新增浮出框樣式，調整定位和佈局 |
| `index.js` | 修改 | 核心邏輯更新，新增定位計算和排序邏輯 |

---

## 完成標記

### 第一輪（基礎修改）
- [ ] 7. 移除所有 Copy 按鈕
- [ ] 3. Enter 提交時移除尾部空白
- [ ] 5. 關聯詞面板：單欄 + 排序按鈕 + Top-K 選擇 (10/20/50)

### 第二輪（核心 UI 改進）
- [ ] 1. Ghost suggestion 在輸入框內（雙層設計）
- [ ] 2. 建議列表改為 Google 搜尋風格（貼著輸入框，預設選中第一項）
- [ ] 4. 運算子選擇器改為 Google 搜尋風格（貼著輸入框，預設選中 AND）

### 第三輪（增強功能）
- [ ] 6. Hover 顯示排名（基於全部相關詞計算）

### 最終驗收
- [ ] 全部功能測試驗證
- [ ] 鍵盤交互測試
- [ ] 鼠標交互測試
- [ ] 邊界情況測試

