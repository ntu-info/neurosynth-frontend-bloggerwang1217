Frontend API Spec
=================

目的
----
本文件為前端工程師使用三個後端 API (/terms, /terms/<t1>, /query/<q_string>/studies) 時的詳細規格。
目標是讓前端可以提供即時的查詢反饋（AJAX-based, as-you-type），含 autocomplete、關聯詞候選、以及條件語法查詢（例如: "amygdala not emotion"）的研究列表呈現。

Configuration summary (confirmed defaults)
-----------------------------------------
- Debounce: 250ms
- minLength: 2
- Space operator semantics: space is treated as a literal "space" (simple adjacency/default operator). When the operator chooser appears, the chooser's default display is "AND" but inserting an operator writes the literal token chosen (e.g. "AND" or a literal space). Do NOT auto-convert user-entered space to AND when sending to the backend.
- Tab behavior: Tab accepts the ghost suggestion and fills the input but does NOT auto-submit. When the operator chooser is visible, Tab behaves like Enter and confirms the selected operator.
- Enter behavior:
  - **主查詢欄 (右側):** 若建議列表項目被選中，Enter 僅替換輸入（不提交）。若建議列表無焦點，Enter 提交當前輸入。
  - **左側單詞查詢欄 (左側):** 若建議列表項目被選中，Enter 替換輸入並**提交**。若建議列表無焦點，Enter 提交當前輸入。
- Click on suggestion/related item: The behavior depends on the context.
  - **主查詢欄的建議列表 (右側):** 點擊項目會替換輸入框中當前的詞彙並加上空格，方便快速構建查詢。
  - **左側單詞查詢欄的建議列表 (左側):** 點擊項目會將該詞彙填入輸入框，並**提交**查詢。
  - **左側單詞查詢欄的關聯詞列表 (左側):** 點擊項目**不會**替換輸入，僅供參考。使用者需使用專用的「Copy」按鈕複製詞彙。
 - Copy implementation: copy only the term text (no quotes, no trailing space). Use navigator.clipboard.writeText(term) with a document.execCommand('copy') fallback; show a short toast "Copied" on success. Requires secure context (HTTPS or localhost). If both methods fail, show an error toast prompting manual selection.
  
  Note: Copy buttons are shown only for **左側單詞查詢欄的關聯詞列表**。主查詢欄的建議列表和左側單詞查詢欄的建議列表不顯示 Copy 按鈕。
- Operator IME-like chooser: after typing a space, UI shows operator choices; ArrowUp/Down to change selection, Enter to confirm (insert operator + trailing space), Esc to cancel (keep the typed space). After confirm, focus returns to the input.

- Infinite-scroll threshold: fixed at 200 (do NOT expose as user-configurable in the demo).
- Virtualization: simple vanilla windowing (render visible slice + small buffer) — no third-party libs for the demo.
- Cache TTLs: /terms = session cache; /terms/<t1> = 5 minutes; /query/<q_string>/studies = 1 minute.
- UI language: English (all toasts/errors/messages/labels in English).
- Demo files: `index.html`, `index.js` (separate), and `style.css` (separate) — recommended structure for clarity and easy testing.

總體 UX/行為要點
------------------
- 使用者在輸入框鍵入時，邊輸入邊以 AJAX 列出相似詞（as‑you‑type similar terms），即時顯示匹配或相似詞列表供參考（非僅供選擇的傳統 autocomplete）。
- 對 /terms 的查詢應支援 local debounce（預設 250ms）與最小字數門檻（minLength = 2）以降低請求數量。
- 當在**左側單詞查詢欄**確認並提交一個 term（例如按 Enter 或點擊提交按鈕）時，向 /terms/<t1> 取得相關詞並顯示關聯詞清單與關聯強度（co_count、jaccard）。
- 支援複合查詢字串（query string）輸入，例如包含 boolean 運算子: "amygdala not emotion"，提交後呼叫 /query/<q_string>/studies，回傳研究清單並顯示分頁或 lazy-load。
- 所有 AJAX 請求需支援取消（AbortController 或等價方法），以避免過期回應覆蓋最新狀態。
- 顯示明確的 error state（含重試按鈕）。

Data contracts (前端視角)
-------------------------

1) GET /terms

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "terms": string[] }

前端處理
 - 用於即時相似詞提示（client-side strict prefix match；或由後端一次回傳後由前端篩選並顯示）。
 - 若詞量非常大（數千），後端應考慮提供分頁或 prefix filter；若後端只回傳完整清單，前端須 virtualize 顯示。

Example response
{"terms":["aberrant","abilities","ability","able","abnormal","amygdala", ...]}

2) GET /terms/<t1>

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "related": [ { "term": string, "co_count": number, "jaccard": number }, ... ] }

前端處理
 - 顯示 top-N 相關詞（預設 top 10），排序依照 jaccard 或 co_count（視需求）。
 - 每個相關詞旁顯示一個小 badge 或 bar 顯示 jaccard（0..1）或正規化後的分數。相關詞項目不會在整行點擊時替換或附加到輸入；項目右側僅提供 Copy 按鈕以複製該詞（不提供 append 按鈕或自動替換）。

Example response
{"related":[{"co_count":726,"jaccard":0.28348,"term":"emotional"},{"co_count":499,"jaccard":0.23571,"term":"emotion"}, ... ]}

3) GET /query/<q_string>/studies

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "applied": { ... }, "count": number, "results": [ { "id": string, "study_id": string, "contrast_id": string, "title": string, "authors": string, "journal": string, "year": number }, ... ] }

前端處理
 - 在結果列表顯示 count 與 results（標題、作者、期刊、年份）。
- 若後端支援分頁則優先使用；但若後端一次回傳全部結果，前端建議採用 infinite scroll（搭配 virtualized rendering）以避免一次渲染大量 DOM 元素。

Example response
{"applied":{"locations":false,"r":null,"terms":true},"count":292,"results":[{"authors":"Buchel C, Dolan RJ, Armony JL, Friston KJ","contrast_id":"1","id":"10594068-1","journal":"The Journal of neuroscience","study_id":"10594068","title":"Amygdala-hippocampal involvement ...","year":1999}, ... ]}



查詢語法（Grammar）
-------------------
- 支援的運算子：AND、OR、NOT（三者皆支援，大小寫不敏感）。
- 支援括號 () 以改變運算順序與分組。
- 支援用雙引號表示的精確短語（例如 "emotional faces"）。
- 若輸入不合法（語法錯誤或找不到詞等），前端顯示錯誤訊息格式："Not found"。

Operator IME-like behavior (after space)
--------------------------------------
- After the user types the first token and presses space, the input UI shows a gray, underlined inline candidate representing the default logical operator (displayed as "AND"). This behaves like an IME candidate: the user can press ArrowUp/ArrowDown to switch among operator choices (space / AND / OR / NOT), and press Enter to confirm the selected operator. On confirm the operator text is inserted literally followed by a trailing space, and focus returns to the input for the next token.
 - If the user continues typing characters immediately (without selecting an operator), the operator chooser hides and the typed space is kept (literal space). This preserves the meaning of space as an adjacency operator unless the user explicitly selects another operator.
 - Tab behavior in operator chooser: when the operator chooser is visible, Tab behaves the same as Enter (it confirms the selected operator and inserts it literally followed by a trailing space).
 - Backspace behavior: if the user presses Backspace after the space (before selecting an operator), do NOT auto-open the operator chooser; treat Backspace as normal deletion of characters.


Data contracts (前端視角)
-------------------------

1) GET /terms

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "terms": string[] }

前端處理
 - 用於 autocomplete 候選（client-side fuzzy / prefix match）。
 - 後端目前直接回傳完整詞清單（一次傳回所有 terms）；若日後詞量極大可再優化為 prefix filter 或分頁，現階段前端以完整清單為前提並在 UI 上 virtualize 顯示（若需要）。

Example response
{"terms":["aberrant","abilities","ability","able","abnormal","amygdala", ...]}

2) GET /terms/<t1>

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "related": [ { "term": string, "co_count": number, "jaccard": number }, ... ] }

前端處理
 - 關聯詞面板將分為兩欄顯示：一欄依 co_count 排序，另一欄依 jaccard 排序。兩欄應可獨立滾動。若列表很長，兩組都將採用 infinite scroll / virtualized rendering，其觸發閾值與研究結果列表相同（固定為 200）。
 - 若後端回傳空陣列（無相關詞），前端不顯示 related panel（保持隱藏或 collapse）。

Example response (from /terms/<t1>)
```
{"related":[{"co_count":726,"jaccard":0.2834830144474815,"term":"emotional"},{"co_count":499,"jaccard":0.23571091166745395,"term":"emotion"},{"co_count":425,"jaccard":0.20472061657032756,"term":"neutral"}, ... ]}
```

3) GET /query/<q_string>/studies

Response
 - 200 OK
 - Content-Type: application/json
 - body: { "applied": { ... }, "count": number, "results": [ { "id": string, "study_id": string, "contrast_id": string, "title": string, "authors": string, "journal": string, "year": number }, ... ] }

前端處理
 - 在結果列表顯示 count 與 results（標題、作者、期刊、年份）。
 - 支援分頁（如果後端支援），或在前端做 infinite scroll / lazy-load（建議分頁）。

Example response
{"applied":{"locations":false,"r":null,"terms":true},"count":292,"results":[{"authors":"Buchel C, Dolan RJ, Armony JL, Friston KJ","contrast_id":"1","id":"10594068-1","journal":"The Journal of neuroscience","study_id":"10594068","title":"Amygdala-hippocampal involvement ...","year":1999}, ... ]}

UI 元件與互動建議
--------------------

1) 主查詢欄（Query input）
- 單行文字輸入，支援鍵盤操作（ArrowUp/Down 切換 autocomplete、Enter 選擇、Esc 取消）。
- 行為：在輸入時（>= minLength）觸發 debounce 後，呼叫 local /terms 來篩選候選，顯示 top 10 候選。
- 顯示一個小提示列說明支援的查詢語法（例如: AND, OR, NOT, 引號支援短語）。

1.5) 左側單詞查詢欄 (Left-side Single Term Query Input)
- 單行文字輸入，專用於輸入單一詞彙以查詢其關聯詞。
- 行為：
  - 在輸入時（>= minLength）觸發 debounce 後，呼叫 `/terms` 取得建議列表，並顯示 ghost suggestion。
  - 只有在使用者按下 `Enter` 鍵或點擊提交按鈕後，才會呼叫 `/terms/<t1>` 並顯示關聯詞清單。
- 互動：
  - 支援鍵盤操作（ArrowUp/Down 切換建議、Tab 接受 ghost suggestion、Enter 提交）。
  - 點擊建議列表中的項目會將該詞彙填入輸入框，並提交查詢。
- 顯示：下方會顯示建議列表；提交後，關聯詞面板會更新。

2) As-you-type similar terms 列表 (主查詢欄)
- 當使用者在主查詢欄鍵入時，前端會以 AJAX（或從 /terms 的完整清單中篩選）即時顯示相似詞列表，供參考與補齊使用。
- 列表呈現細節：
  - 高亮匹配的 prefix（例如使用 <strong> 標示前綴）。
  - 顯示 ghost suggestion（淺灰色）顯示第一個建議；使用者可按 Tab 直接補齊該詞（補齊後仍不自動提交）。
  - 點擊建議項目會將該詞彙填入輸入框，取代當前正在輸入的詞彙，並在後方加上一個空格以便輸入下一個詞或運算子。焦點應返回輸入框。

  Note: 此處的建議列表不顯示 Copy 按鈕，主要用於快速構建查詢。

 - 互動要點：
   - Tab：接受 ghost suggestion（補齊，但不提交）。
   - ArrowUp/ArrowDown：在 suggestion 列表中移動焦點（不自動提交）。
   - Enter：當 suggestion 列表沒有 focus 時，提交目前輸入；若 suggestion 被選中，Enter 僅替換輸入（replace），不提交。

3) 關聯詞面板（Related terms）
- 當在**左側單詞查詢欄**輸入並確認一個主詞時，前端呼叫 /terms/<t1> 並顯示相關詞彙列表。
- 關聯詞面板將分為兩欄顯示：一欄依 co_count 排序，另一欄依 jaccard 排序。兩欄應可獨立滾動。
- 若後端回傳空陣列，related panel 保持隱藏。
- 互動：每個 related term 項目右側也可顯示「Copy」按鈕以複製該詞；點擊項目本身不會自動替換輸入或提交。
- Hover 行為：當滑鼠懸停在任一詞彙上時，應同時顯示該詞彙的 co_count 和 jaccard 值。

4) 結果清單（Studies results）
- 顯示 count 與結果清單（每筆一行）。
- 行為：點擊標題展開細節（contrast_id, study_id, authors, journal, year），提供外部連結按鈕。
 - 當後端一次回傳大量結果時，前端預設使用 infinite scroll 並搭配 virtualized rendering；閾值固定為 200（demo 不提供可調設定）。

交互細節與錯誤處理
---------------------
- Debounce: 250ms（可配置）。
- minLength: 2（可配置）。
- Abort previous requests: 每次發送新的 autocomplete / related / query 請求時，先 abort 上一個未完成的請求，避免競態。

- Error state: 顯示簡短訊息（例如『無法取得候選詞 — 重試』），並提供 retry 按鈕；若是 4xx 錯誤，顯示更具體訊息（如參數錯誤）。
- 空結果: 顯示友善提示（例如『找不到符合 "X" 的結果』）並提供放大搜尋或清除搜尋的選項。

Accessibility（可及性）
--------------------
- Autocomplete 與下拉結果需以 ARIA roles（combobox, listbox, option）標註。
- 鍵盤導航完整支援。

前端 API 使用範例（JavaScript, fetch + AbortController）
-------------------------------------------

簡單 autocomplete 範例：

const controller = new AbortController();
// 在每次新的請求前先呼叫 controller.abort()
fetch('/terms', { signal: controller.signal })
  .then(r => r.json())
  .then(data => {/* filter & show */})
  .catch(err => { if (err.name === 'AbortError') return; /* show error */ });

搜尋 studies 範例：

const q = encodeURIComponent(queryString);
fetch(`/query/${q}/studies`)
  .then(r => r.json())
  .then(data => {/* render results */})



Implementation notes / Tips
-------------------------
- 若 `/terms` 回傳非常龐大，注意：目前後端不提供 `/terms?prefix=...` 這類 prefix-filter API（demo 與前端實作須假設 backend 不支援 prefix 參數）。前端將採用 strict prefix-only client-side filtering（case-insensitive prefix match）並以 lazy-chunk loading + virtualization 減少記憶體與首次渲染負擔：
  - Chunking: fetch terms in chunks (default chunkSize = 5000). The client will attempt incremental parsing/streaming of the `/terms` payload and render chunks as they arrive. Fallback: if neither is possible, the client will download the full list and rely on virtualization.
  - Lazy load behavior: load initial chunk (first chunk), render and allow user interactions; when the user scrolls near the end of the loaded list, fetch the next chunk. Continue until full list loaded or user stops scrolling.
  - Filtering: prefix-only filtering is applied to the loaded terms; when not-yet-loaded chunks may contain matches, show a small "loading more" indicator and continue fetching as needed.
  - Default chunkSize can be tuned; demo will use 5000 as default.
 - 前端可在本地做簡單快取（map term -> related, map q_string -> results）以減少重複請求。
 - 建議使用 virtualized list 當候選或結果量很大時；實作細節：假定固定 item height = 40px，visible buffer = 10 items（上/下總和），以簡化 vanilla JS 的 windowing 實作。

CORS 與部署
-----------------
- API 是否允許跨域（CORS header）：允許，前端可以直接呼叫。
- HTTPS / TLS 相關（自簽章或憑證問題的處理）：無特殊處理，直接呼叫（假設伺服器憑證可被瀏覽器接受）。

效能與快取建議
-----------------
- 採用預設即可，不需特殊限制或 rate-limit 處理。
- API 速率限制（requests/min）或建議節流策略：建議前端維持 debounce（250ms）與每個元件的簡易快取，以降低請求頻率；不需要額外的速率限制處理。
- 建議 cache TTL（terms/related/results）與 invalidation 策略：
  - `/terms`：session 內快取直到頁面重載（cache TTL = session）。
  - `/terms/<t1>`：短期快取（例如 5 分鐘）以降低重複請求。
  - `/query/<q_string>/studies`：可快取最近的 query（例如 1 分鐘），但對大量或動態資料應減少快取時間。

詳細 UI/UX 未定義項目的具體說明
---------------------------------

- Autocomplete 顯示欄位 (更具體)：
  - 顯示詞文本（term），並高亮匹配的 prefix（例如使用 <strong> 標示前綴）。
  - 每個項目右側僅提供 Copy 按鈕：按下會把該詞複製到系統剪貼簿，整行點擊不會替換或附加至輸入欄。



- 搜尋提交行為（Enter 單鍵提交 vs 搜尋按鈕）：
  - 支援兩者：Enter 鍵將提交目前輸入（快捷方式）；搜尋按鈕則提供明確的提交行為，對 mobile 使用者更友善。

- Empty state 與 fallback（mobile / narrow viewport 行為）：
  - Empty state（沒有結果）:
    - Autocomplete：顯示『沒有候選詞』的小提示與建議（例如：檢查拼字、嘗試不同詞）。
    - Related panel：若無相關詞，關聯面板保持隱藏，不顯示錯誤。
    - Results：顯示『找不到符合 "<query>" 的結果』。