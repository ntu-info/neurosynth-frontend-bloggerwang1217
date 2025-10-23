# 功能需求更新 - 第二版修正（UPDATE-2）

**日期**: 2025-10-24
**狀態**: 待實現
**優先級**: 高

## 需求概述

基於使用者進一步反饋，對 UPDATE-1 實現進行微調和修正，以改進 UI/UX 細節。

---

## 1. 中文按鈕改成英文

### 當前實現
- 「按 co_count」
- 「按 jaccard」
- 「顯示」

### 新需求
- **「按 co_count」改為「Sort by co_count」**
- **「按 jaccard」改為「Sort by jaccard」**
- **「顯示」改為「Display」**

### 修改位置
- `index.html` - 更新按鈕標籤文本
  - 第 54 行：`<button id="sortByCoCountBtn" class="sort-btn active">按 co_count</button>` → `Sort by co_count`
  - 第 55 行：`<button id="sortByJaccardBtn" class="sort-btn">按 jaccard</button>` → `Sort by jaccard`
  - 第 58 行：`<span>顯示:</span>` → `Display:`

---

## 2. 相關詞 Hover 顯示排名信息

### 當前實現
- Hover 時顯示 co_count 和 jaccard 的數值

### 新需求
- **Hover 時同時顯示排名**
- 排名基於「全部相關詞」，不是「當前顯示的 Top-K」
- 格式：`co_count: 726 (#1 for co_count)`
- 格式：`jaccard: 0.2835 (#2 for jaccard)`

### 設計細節
```
假設有 100 個相關詞，但只顯示 Top 10

Hover "emotional" 時（它在全部中排名第 1）：
────────────────────────────────────────
emotional
co_count: 726 (#1 for co_count)
jaccard: 0.2835 (#5 for jaccard)
────────────────────────────────────────

注意：排名 #1、#5 是基於全部 100 個相關詞，
不是基於當前顯示的 Top 10 中的排名
```

### 實現方法
在計算排名時，需要：
1. 計算全部相關詞在 co_count 方向的排名
2. 計算全部相關詞在 jaccard 方向的排名
3. 儲存排名信息到元素的 `title` 或 `data-*` 屬性
4. Hover 時顯示排名信息（使用 tooltip 或直接顯示在 hover 框中）

### 涉及文件
- `index.js` - `renderRelatedTerms()` 函數：
  - 計算全部相關詞的 co_count 排名 (Map)
  - 計算全部相關詞的 jaccard 排名 (Map)
  - 即使只顯示 Top-K，排名仍基於全部相關詞
  - 創建 related item 時附加排名信息

---

## 3. 選擇建議後都不加空格

### 當前實現
- 選擇建議項後，會在詞彙後方自動添加一個空格（用於連接運算子）

### 新需求
- **無論是 Complex Query 還是左側單詞查詢框，選擇建議後都不應加空格**
- 用戶自主決定是否需要空格或其他字符

### 原因
- 提供更大的靈活性，用戶可以自主決定後續操作
- 統一兩邊的行為

### 實現方法
```javascript
// 修改 selectMainSuggestion() 和 selectLeftSuggestion() 或相關函數
// 移除尾部空格的添加邏輯
// 例如改為：
state.mainInput = currentWord;  // 不添加空格
```

### 涉及文件
- `index.js` - 查找選擇建議的邏輯，移除自動添加空格

---

## 4. 邏輯符選擇器改為 Google 搜尋風格（完整重設計）

### 當前實現
- 運算子選擇器為灰色背景的 inline 框
- 僅顯示當前選中的運算子
- 有下劃線修飾

### 新需求

#### 樣式要求
- **改為類似建議列表的設計**（使用相同的邊框、背景、陰影）
- **貼著輸入框，不浮空**（與 ghost suggestion 列表一致）
- **框框要展開，一次顯示邏輯符選項**：`[AND] [OR] [NOT]`（不需要 space）
- **移除下劃線和灰色背景**
- **有淺字在輸入框背景**（與其他輸入實作一樣，ghost suggestion 的行為）

#### 交互要求
- **預設選中 AND**（即 `state.operatorIndex = 0`，因為只有 AND/OR/NOT 三個）
- Arrow Up/Down 導航運算子選項
- Hover 時高亮相應項（與建議列表一致）
- Enter/Tab 確認選擇並插入運算子
- Esc 取消選擇（保留之前輸入框中的空格）
- 繼續輸入任何字符隱藏選擇器

### 設計細節

```
輸入框: [amygdala |]
        ┌──────────────────────┐ ← 框框貼著輸入框
        │ ✓ AND                │ ← 預設選中
        │   OR                 │
        │   NOT                │
        └──────────────────────┘
```

### CSS 修改

**移除當前的 operator-chooser 樣式**：
```css
/* 移除以下內容 */
.operator-chooser {
  display: flex;
  gap: 10px;
  padding: 10px 15px;
  background: #f0f7ff;        ← 灰色背景，要移除
  border: 2px dashed #3498db;  ← dashed 線，要改為 solid
  ...
}

.operator-indicator {
  ...
  text-decoration: underline;   ← 下劃線，要移除
  ...
}
```

**新的樣式應該**：
```css
.operator-chooser {
  /* 與 .suggestions-container 和 .suggestions-list 類似 */
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  width: 100%;
  margin: 0;
  margin-top: -2px;
  z-index: 100;
}

.operator-list {
  /* 與 .suggestions-list 一致 */
  list-style: none;
  border: 1px solid #ecf0f1;
  border-radius: 4px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.operator-item {
  /* 與 .suggestion-item 一致 */
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid #ecf0f1;
  transition: all 0.15s ease;
  font-size: 14px;
}

.operator-item:last-child {
  border-bottom: none;
}

.operator-item:hover {
  background: #f0f7ff;
  color: #2c3e50;
}

.operator-item.focused {
  background: #3498db;
  color: white;
}
```

### HTML 修改

**當前**：
```html
<div id="operatorChooser" class="operator-chooser" style="display: none;">
  <span id="operatorIndicator" class="operator-indicator">AND</span>
</div>
```

**新的結構**：
```html
<div id="operatorChooserContainer" class="operator-chooser-container" style="display: none;">
  <ul id="operatorChooser" class="operator-list" role="listbox">
    <!-- 動態生成或預定義 -->
    <!-- <li class="operator-item focused">AND</li> -->
    <!-- <li class="operator-item">OR</li> -->
    <!-- <li class="operator-item">NOT</li> -->
  </ul>
</div>
```

### 實現方法

#### 1. 初始化運算子列表
```javascript
function initOperatorChooser() {
  const operatorList = document.getElementById('operatorChooser');
  const operators = ['AND', 'OR', 'NOT'];

  operators.forEach((op, idx) => {
    const li = document.createElement('li');
    li.className = 'operator-item';
    li.textContent = op;
    li.dataset.value = op;
    li.dataset.index = idx;

    if (idx === 0) li.classList.add('focused');  // AND 預設選中

    operatorList.appendChild(li);
  });
}
```

#### 2. 顯示運算子選擇器
```javascript
function showOperatorChooser() {
  const container = document.getElementById('operatorChooserContainer');
  container.style.display = 'block';
  state.operatorChooserActive = true;
  state.operatorIndex = 0;  // 預設 AND（索引 0）
  updateOperatorFocus();
}
```

#### 3. 更新 Arrow 導航
```javascript
function updateOperatorFocus() {
  const items = document.querySelectorAll('.operator-item');
  items.forEach((item, idx) => {
    item.classList.toggle('focused', idx === state.operatorIndex);
  });
}
```

### 涉及文件
- `index.html` - 修改運算子選擇器 HTML 結構
- `style.css` - 修改和新增運算子選擇器樣式
- `index.js` - 重寫 showOperatorChooser()、updateOperatorFocus() 等邏輯；更新 state.operators 為 ['AND', 'OR', 'NOT']

---

## 5. 選擇邏輯符後不替換空格，後面也不加空格

### 當前實現
- 選擇運算子後，會替換掉之前的空格

### 新需求
- **選擇運算子後，不要替換掉前面的空格**
- **運算子後面也不要自動添加空格**
- 用戶自主決定運算子後是否需要空格

### 設計細節

```
使用者輸入：「amygdala [space]」
選擇 "AND" 後應該是：「amygdala AND」
不應該是：「amygdala AND」（後面加空格）

如果用戶想要「amygdala AND emotion」，應該自己輸入空格或直接輸入下一個詞
```

### 實現方法
```javascript
// 在 confirmOperatorSelection() 或相關函數中
function confirmOperatorSelection() {
  const operator = state.operators[state.operatorIndex];
  const currentValue = state.mainInput;

  // 不替換空格，直接在光標位置插入運算子
  // 也不在運算子後添加空格

  state.mainInput = currentValue + operator;
  // 不添加額外空格
  updateGhostInput();
  closeOperatorChooser();
}
```

### 涉及文件
- `index.js` - 修改確認運算子選擇的邏輯

---

## 6. Ghost Input 文字對齊問題

### 當前實現
- Ghost input（背景淺灰色建議）與實際輸入框顯示的文字有輕微錯位

### 新需求
- **Ghost input 的文字應精確對齐於輸入框中的文字**
- 確保字體、大小、padding、line-height 完全一致

### 原因分析
- 背景層和前景層可能有微小的 padding/margin 差異
- Font rendering 可能導致視覺偏移

### 實現方法

#### 確保 CSS 完全一致
```css
.ghost-input,
.input-field {
  /* 完全相同的 padding */
  padding: 12px 15px;

  /* 完全相同的字體設置 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 14px;
  line-height: 1.5;  ← 很重要！

  /* 完全相同的 border */
  border: 2px solid #e0e0e0;
  border-radius: 6px;

  /* 完全相同的高度 */
  height: 44px;  ← 明確設定高度
}
```

#### 檢查 HTML 結構
```html
<div class="input-wrapper">
  <!-- 背景層 -->
  <div id="ghostInput" class="ghost-input"></div>

  <!-- 前景層（使用 input 元素） -->
  <input id="mainInput" type="text" class="input-field" />
</div>
```

#### JS 中同步寬度和內容
```javascript
function updateGhostInput() {
  const mainInput = document.getElementById('mainInput');
  const ghostInput = document.getElementById('ghostInput');

  // 同步內容
  ghostInput.textContent = mainInput.value + suggestedText;

  // 確保寬度相同
  ghostInput.style.width = mainInput.offsetWidth + 'px';
  ghostInput.style.height = mainInput.offsetHeight + 'px';
}
```

### 涉及文件
- `style.css` - 調整 `.ghost-input` 和 `.input-field` 的 padding、font、line-height
- `index.js` - 確保 JS 中的寬度/高度同步邏輯正確

---

## 7. 邏輯符選擇器上方的灰色框

### 當前實現
- 邏輯符選擇器顯示時，上方會出現一個灰色的框（`ghostSuggestion` 元素）
- 這是在輸入框和選項列表之間

### 新需求
- **移除邏輯符選擇器上方的灰色 ghost suggestion 框**
- 因為 ghost suggestion 現在已經在輸入框的背景裡了，不需要重複顯示

### 問題來源
- `index.html` 中的 `<div id="ghostSuggestion" class="ghost-suggestion"></div>` 在邏輯符選擇器上方
- 當邏輯符選擇器顯示時，這個灰色框會出現在選項列表上方

### 解決方案
**直接從 HTML 中移除 `ghostSuggestion` 元素**

### 實現方法

#### HTML 修改
從 `index.html` 中移除下列元素：

```html
<!-- 刪除這一行 -->
<div id="ghostSuggestion" class="ghost-suggestion"></div>
```

#### 具體位置
在 `index.html` 的主查詢建議容器中：
```html
<div id="mainSuggestionsContainer" class="suggestions-container" style="display: none;">
  <div id="ghostSuggestion" class="ghost-suggestion"></div>  <!-- ← 移除這一行 -->
  <ul
    id="mainSuggestions"
    class="suggestions-list"
    role="listbox"
    aria-label="Query suggestions"
  ></ul>
</div>
```

修改後應為：
```html
<div id="mainSuggestionsContainer" class="suggestions-container" style="display: none;">
  <ul
    id="mainSuggestions"
    class="suggestions-list"
    role="listbox"
    aria-label="Query suggestions"
  ></ul>
</div>
```

### 涉及文件
- `index.html` - 移除 `<div id="ghostSuggestion" class="ghost-suggestion"></div>` 元素

---

## 實現優先級

| 序號 | 功能 | 優先級 | 難度 |
|------|------|--------|------|
| 1 | 按鈕文字改英文 | 低 | 低 |
| 7 | 移除灰色框 | 低 | 低 |
| 3 | Complex Query 不加空格 | 中 | 低 |
| 6 | Ghost Input 文字對齐 | 中 | 低 |
| 5 | 選擇運算子後邏輯調整 | 中 | 中 |
| 2 | Hover 顯示排名 | 中 | 中 |
| 4 | 運算子選擇器完整重設計 | 高 | 高 |

---

## 實現順序建議

### 第一輪（微調 - 快速完成）
1. **1. 按鈕文字改英文**（<5 分鐘）
2. **7. 移除灰色框**（<5 分鐘）
3. **3. Complex Query 不加空格**（<10 分鐘）
4. **6. Ghost Input 文字對齐**（<15 分鐘）

完成後效果：
- UI 更國際化（英文按鈕）
- 視覺更整潔（無灰色框）
- 輸入框對齐更精確

### 第二輪（邏輯調整）
5. **5. 選擇運算子後邏輯調整**（<20 分鐘）
6. **2. Hover 顯示排名**（30-40 分鐘）

完成後效果：
- 運算子選擇更靈活
- 相關詞排名信息更豐富

### 第三輪（核心 UI 改進）
7. **4. 運算子選擇器完整重設計**（1-1.5 小時）

完成後效果：
- UI 風格統一（運算子選擇器與建議列表一致）
- 交互更直觀（Google 搜尋風格）
- 用戶體驗更佳

---

## 完成標記

### 第一輪（微調）
- [ ] 1. 按鈕文字改成英文
- [ ] 7. 移除運算子選擇器灰色框
- [ ] 3. Complex Query 選擇後不加空格
- [ ] 6. Ghost Input 文字精確對齐

### 第二輪（邏輯調整）
- [ ] 5. 選擇運算子後的邏輯修正
- [ ] 2. 相關詞 Hover 顯示排名

### 第三輪（核心改進）
- [ ] 4. 運算子選擇器完整重設計

### 最終驗收
- [ ] 全部功能測試驗證
- [ ] 視覺細節檢查
- [ ] 鍵盤交互測試
- [ ] 鼠標交互測試
