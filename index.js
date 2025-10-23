// Configuration
const CONFIG = {
  API_BASE: 'https://mil.psy.ntu.edu.tw:5000',
  DEBOUNCE_MS: 250,
  MIN_LENGTH: 2,
  INFINITE_SCROLL_THRESHOLD: 200,
  CACHE_TTL: {
    terms: Infinity,
    related: 5 * 60 * 1000,
    studies: 1 * 60 * 1000,
  },
};

// Cache Management
const cache = {
  terms: new Map(),
  related: new Map(),
  studies: new Map(),
  timestamps: {
    related: new Map(),
    studies: new Map(),
  },
};

// State Management
const state = {
  termsData: [], // All terms from /terms API
  mainInput: '',
  leftInput: '',
  mainSuggestionIndex: -1,
  leftSuggestionIndex: -1,
  operatorChooserVisible: false,
  operatorIndex: 0,
  operators: [' ', 'AND', 'OR', 'NOT'],
  cursorAfterSpace: 0, // Position where space was typed
  leftResults: [], // Related terms data
  resultsData: [], // Study results
  resultsTotal: 0,
  currentQuery: '',
  operatorChooserActive: false,
};

// DOM Elements
const elements = {
  // Main query inputs
  mainInput: document.getElementById('mainInput'),
  leftInput: document.getElementById('leftInput'),
  mainSubmitBtn: document.getElementById('mainSubmitBtn'),
  leftSubmitBtn: document.getElementById('leftSubmitBtn'),

  // Suggestions
  mainSuggestionsContainer: document.getElementById('mainSuggestionsContainer'),
  mainSuggestions: document.getElementById('mainSuggestions'),
  ghostSuggestion: document.getElementById('ghostSuggestion'),
  leftSuggestionsContainer: document.getElementById('leftSuggestionsContainer'),
  leftSuggestions: document.getElementById('leftSuggestions'),
  leftGhostSuggestion: document.getElementById('leftGhostSuggestion'),

  // Operator chooser
  operatorChooser: document.getElementById('operatorChooser'),
  operatorIndicator: document.getElementById('operatorIndicator'),

  // Related panel
  relatedPanel: document.getElementById('relatedPanel'),
  relatedByCoCount: document.getElementById('relatedByCoCount'),
  relatedByJaccard: document.getElementById('relatedByJaccard'),

  // Results
  resultsSection: document.getElementById('resultsSection'),
  resultsList: document.getElementById('resultsList'),
  resultCount: document.getElementById('resultCount'),
  resultsError: document.getElementById('resultsError'),
  resultsLoading: document.getElementById('resultsLoading'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),
};

// AbortControllers for canceling requests
let abortControllers = {
  terms: null,
  related: null,
  studies: null,
};

// ======================
// Utility Functions
// ======================

function showToast(message, type = 'info', duration = 2000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

function highlightPrefix(text, prefix) {
  if (!prefix) return text;
  const regex = new RegExp(`^(${prefix})`, 'i');
  return text.replace(regex, '<strong>$1</strong>');
}

function cancelRequest(type) {
  if (abortControllers[type]) {
    abortControllers[type].abort();
  }
  abortControllers[type] = new AbortController();
  return abortControllers[type];
}

function isCacheFresh(type, key) {
  const timestamp = cache.timestamps[type]?.get(key);
  if (!timestamp) return false;
  const ttl = CONFIG.CACHE_TTL[type];
  if (ttl === Infinity) return true;
  return Date.now() - timestamp < ttl;
}

function setCacheEntry(type, key, value) {
  cache[type].set(key, value);
  if (cache.timestamps[type]) {
    cache.timestamps[type].set(key, Date.now());
  }
}

// ======================
// API Functions
// ======================

async function fetchTerms() {
  if (cache.terms.size > 0) {
    return cache.terms.get('all') || [];
  }

  try {
    const controller = cancelRequest('terms');
    const response = await fetch(`${CONFIG.API_BASE}/terms`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const terms = data.terms || [];
    cache.terms.set('all', terms);
    return terms;
  } catch (error) {
    if (error.name === 'AbortError') return [];
    console.error('Error fetching terms:', error);
    showToast('Failed to fetch terms', 'error');
    return [];
  }
}

async function fetchRelatedTerms(term) {
  if (isCacheFresh('related', term)) {
    return cache.related.get(term) || [];
  }

  try {
    const controller = cancelRequest('related');
    const response = await fetch(`${CONFIG.API_BASE}/terms/${encodeURIComponent(term)}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const related = data.related || [];
    setCacheEntry('related', term, related);
    return related;
  } catch (error) {
    if (error.name === 'AbortError') return [];
    console.error('Error fetching related terms:', error);
    showToast('Failed to fetch related terms', 'error');
    return [];
  }
}

async function fetchStudies(query) {
  if (isCacheFresh('studies', query)) {
    return cache.studies.get(query) || {};
  }

  try {
    const controller = cancelRequest('studies');
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`${CONFIG.API_BASE}/query/${encodedQuery}/studies`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setCacheEntry('studies', query, data);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') return null;
    console.error('Error fetching studies:', error);
    showToast('Failed to fetch studies', 'error');
    return null;
  }
}

// ======================
// Suggestion Rendering
// ======================

function renderSuggestions(terms, container, prefix, isLeftPanel = false) {
  container.innerHTML = '';

  if (prefix.length < CONFIG.MIN_LENGTH) {
    container.parentElement.style.display = 'none';
    return;
  }

  // Filter terms with strict prefix match
  const filtered = terms
    .filter((term) => term.toLowerCase().startsWith(prefix.toLowerCase()))
    .slice(0, 10);

  if (filtered.length === 0) {
    container.parentElement.style.display = 'none';
    if (isLeftPanel) {
      state.leftSuggestionIndex = -1;
      elements.leftGhostSuggestion.textContent = '';
    } else {
      state.mainSuggestionIndex = -1;
      elements.ghostSuggestion.textContent = '';
    }
    return;
  }

  container.parentElement.style.display = 'block';

  // Show ghost suggestion
  if (filtered.length > 0) {
    if (isLeftPanel) {
      elements.leftGhostSuggestion.textContent = filtered[0];
    } else {
      elements.ghostSuggestion.textContent = filtered[0];
    }
  }

  // Render suggestion items
  filtered.forEach((term, index) => {
    const li = document.createElement('li');
    li.role = 'option';
    li.className = 'suggestion-item';
    if (
      (isLeftPanel && index === state.leftSuggestionIndex) ||
      (!isLeftPanel && index === state.mainSuggestionIndex)
    ) {
      li.classList.add('focused');
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'suggestion-text';
    textSpan.innerHTML = highlightPrefix(term, prefix);
    li.appendChild(textSpan);

    // Copy button (visible only in left panel suggestions, not main query suggestions)
    // According to spec: Copy buttons only appear in left side related terms, not in suggestion lists
    // Actually re-reading: Copy in suggestion list for main query (2.7), but NOT in left suggestions
    // Let me re-check: section 2.7 says "Copy" appears in "主查詢欄的建議列表"
    // Let me add copy button only for main suggestions
    if (!isLeftPanel) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(term);
      });
      li.appendChild(copyBtn);
    }

    li.addEventListener('click', () => {
      selectSuggestion(term, isLeftPanel);
    });

    container.appendChild(li);
  });

  // Reset focus index when rendering
  if (isLeftPanel) {
    state.leftSuggestionIndex = -1;
  } else {
    state.mainSuggestionIndex = -1;
  }
}

function selectSuggestion(term, isLeftPanel) {
  if (isLeftPanel) {
    elements.leftInput.value = term;
    submitLeftQuery();
  } else {
    // Replace current word and add space
    const cursorPos = elements.mainInput.selectionStart;
    const value = elements.mainInput.value;

    // Find the start of current word (last space or start of string)
    let wordStart = value.lastIndexOf(' ', cursorPos - 1) + 1;
    const before = value.substring(0, wordStart);
    elements.mainInput.value = before + term + ' ';
    elements.mainInput.focus();
    elements.mainInput.setSelectionRange(before.length + term.length + 1, before.length + term.length + 1);

    state.mainInput = elements.mainInput.value;
    hideSuggestions(false);
  }
}

function hideSuggestions(isLeftPanel) {
  const container = isLeftPanel ? elements.leftSuggestionsContainer : elements.mainSuggestionsContainer;
  container.style.display = 'none';
  if (isLeftPanel) {
    state.leftSuggestionIndex = -1;
    elements.leftGhostSuggestion.textContent = '';
  } else {
    state.mainSuggestionIndex = -1;
    elements.ghostSuggestion.textContent = '';
  }
}

function copyToClipboard(text) {
  // Try modern clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied', 'success', 1500);
    });
  } else {
    // Fallback: execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy'); // Fallback for older browsers
      showToast('Copied', 'success', 1500);
    } catch (err) {
      showToast('Copy failed - please select manually', 'error');
    }
    document.body.removeChild(textArea);
  }
}

// ======================
// Related Terms Rendering
// ======================

function renderRelatedTerms(related) {
  if (!related || related.length === 0) {
    elements.relatedPanel.style.display = 'none';
    return;
  }

  elements.relatedPanel.style.display = 'block';
  state.leftResults = related;

  // Sort by co_count (descending)
  const byCoCount = [...related].sort((a, b) => b.co_count - a.co_count).slice(0, 10);

  // Sort by jaccard (descending)
  const byJaccard = [...related].sort((a, b) => b.jaccard - a.jaccard).slice(0, 10);

  // Render co_count column
  elements.relatedByCoCount.innerHTML = '';
  byCoCount.forEach((item) => {
    elements.relatedByCoCount.appendChild(createRelatedTermElement(item));
  });

  // Render jaccard column
  elements.relatedByJaccard.innerHTML = '';
  byJaccard.forEach((item) => {
    elements.relatedByJaccard.appendChild(createRelatedTermElement(item));
  });
}

function createRelatedTermElement(item) {
  const li = document.createElement('li');
  li.className = 'related-item';
  li.role = 'option';

  const infoDiv = document.createElement('div');
  infoDiv.className = 'related-item-info';

  const termDiv = document.createElement('div');
  termDiv.className = 'related-item-term';
  termDiv.textContent = item.term;

  const scoresDiv = document.createElement('div');
  scoresDiv.className = 'related-item-scores';
  scoresDiv.textContent = `co_count: ${item.co_count}, jaccard: ${item.jaccard.toFixed(4)}`;

  infoDiv.appendChild(termDiv);
  infoDiv.appendChild(scoresDiv);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'related-copy-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(item.term);
  });

  li.appendChild(infoDiv);
  li.appendChild(copyBtn);

  return li;
}

// ======================
// Results Rendering
// ======================

function renderResults(data) {
  if (!data || !data.results) {
    elements.resultsSection.style.display = 'none';
    return;
  }

  elements.resultsSection.style.display = 'block';
  state.resultsData = data.results;
  state.resultsTotal = data.count;

  elements.resultCount.textContent = state.resultsTotal;
  elements.resultsList.innerHTML = '';

  if (state.resultsTotal === 0) {
    elements.resultsList.innerHTML =
      `<div style="padding: 20px; text-align: center; color: #7f8c8d;">
      No results found for "${state.currentQuery}". Try a different search.
      </div>`;
    return;
  }

  state.resultsData.slice(0, 200).forEach((result) => {
    const item = createResultElement(result);
    elements.resultsList.appendChild(item);
  });

  // Setup infinite scroll
  setupInfiniteScroll();
}

function createResultElement(result) {
  const div = document.createElement('div');
  div.className = 'result-item';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'result-title';
  titleDiv.textContent = result.title;

  const metaDiv = document.createElement('div');
  metaDiv.className = 'result-meta';

  const authors = document.createElement('div');
  authors.className = 'result-meta-item';
  authors.innerHTML = `<strong>Authors:</strong> ${result.authors}`;

  const journal = document.createElement('div');
  journal.className = 'result-meta-item';
  journal.innerHTML = `<strong>Journal:</strong> ${result.journal}`;

  const year = document.createElement('div');
  year.className = 'result-meta-item';
  year.innerHTML = `<strong>Year:</strong> ${result.year}`;

  metaDiv.appendChild(authors);
  metaDiv.appendChild(journal);
  metaDiv.appendChild(year);

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'result-details';
  const studyIdDiv = document.createElement('div');
  studyIdDiv.className = 'result-meta-item';
  studyIdDiv.innerHTML = `<strong>Study ID:</strong> ${result.study_id}`;
  const contrastIdDiv = document.createElement('div');
  contrastIdDiv.className = 'result-meta-item';
  contrastIdDiv.innerHTML = `<strong>Contrast ID:</strong> ${result.contrast_id}`;
  detailsDiv.appendChild(studyIdDiv);
  detailsDiv.appendChild(contrastIdDiv);

  div.appendChild(titleDiv);
  div.appendChild(metaDiv);
  div.appendChild(detailsDiv);

  div.addEventListener('click', () => {
    div.classList.toggle('expanded');
  });

  return div;
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && state.resultsData.length < state.resultsTotal) {
        const currentCount = elements.resultsList.children.length;
        const nextBatch = state.resultsData.slice(
          currentCount,
          Math.min(currentCount + 200, state.resultsData.length)
        );

        nextBatch.forEach((result) => {
          elements.resultsList.appendChild(createResultElement(result));
        });
      }
    });
  });

  const sentinel = document.createElement('div');
  sentinel.className = 'infinite-scroll-sentinel';
  sentinel.style.height = '1px';
  elements.resultsList.appendChild(sentinel);
  observer.observe(sentinel);
}

// ======================
// Main Query Input Handlers
// ======================

async function handleMainInput() {
  state.mainInput = elements.mainInput.value;
  const cursorPos = elements.mainInput.selectionStart;
  const lastChar = state.mainInput[cursorPos - 1];

  // Hide operator chooser if we're not at space position
  if (lastChar !== ' ' || !state.operatorChooserActive) {
    hideOperatorChooser();
  }

  // Get the current word being typed
  const lastSpaceIndex = state.mainInput.lastIndexOf(' ', cursorPos - 1);
  const currentWord = state.mainInput.substring(lastSpaceIndex + 1, cursorPos);

  // Fetch and render suggestions for current word
  if (currentWord.length >= CONFIG.MIN_LENGTH && lastChar !== ' ') {
    const terms = await fetchTerms();
    renderSuggestions(terms, elements.mainSuggestions, currentWord, false);
  } else {
    hideSuggestions(false);
  }
}

function handleMainKeydown(e) {
  const isOperatorChooserVisible = state.operatorChooserActive;

  if (isOperatorChooserVisible) {
    // Handle operator chooser keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.operatorIndex = (state.operatorIndex - 1 + state.operators.length) % state.operators.length;
      updateOperatorDisplay();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.operatorIndex = (state.operatorIndex + 1) % state.operators.length;
      updateOperatorDisplay();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      confirmOperator();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideOperatorChooser();
    }
    return;
  }

  // Handle normal suggestion keys
  const suggestions = elements.mainSuggestions.children;
  const suggestionVisible = elements.mainSuggestionsContainer.style.display !== 'none';

  if (e.key === 'Tab' && suggestionVisible && elements.ghostSuggestion.textContent) {
    e.preventDefault();
    // Accept ghost suggestion
    const ghostText = elements.ghostSuggestion.textContent;
    const cursorPos = elements.mainInput.selectionStart;
    const lastSpaceIndex = elements.mainInput.value.lastIndexOf(' ', cursorPos - 1);
    const before = elements.mainInput.value.substring(0, lastSpaceIndex + 1);
    elements.mainInput.value = before + ghostText;
    elements.mainInput.focus();
    elements.mainInput.setSelectionRange(before.length + ghostText.length, before.length + ghostText.length);
    state.mainInput = elements.mainInput.value;
    handleMainInput();
  } else if (e.key === 'ArrowDown' && suggestionVisible) {
    e.preventDefault();
    state.mainSuggestionIndex = Math.min(
      state.mainSuggestionIndex + 1,
      suggestions.length - 1
    );
    updateSuggestionFocus(suggestions);
  } else if (e.key === 'ArrowUp' && suggestionVisible) {
    e.preventDefault();
    state.mainSuggestionIndex = Math.max(state.mainSuggestionIndex - 1, -1);
    updateSuggestionFocus(suggestions);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggestionVisible && state.mainSuggestionIndex >= 0) {
      // Just replace, don't submit
      const selectedTerm = suggestions[state.mainSuggestionIndex].textContent
        .split('Copy')[0]
        .trim();
      selectSuggestion(selectedTerm, false);
    } else {
      // Submit query
      submitMainQuery();
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    // Type space and prepare operator chooser
    const cursorPos = elements.mainInput.selectionStart;
    elements.mainInput.value =
      elements.mainInput.value.substring(0, cursorPos) +
      ' ' +
      elements.mainInput.value.substring(cursorPos);
    elements.mainInput.setSelectionRange(cursorPos + 1, cursorPos + 1);
    state.mainInput = elements.mainInput.value;
    state.cursorAfterSpace = cursorPos + 1;

    // Show operator chooser
    showOperatorChooser();

    // Continue handling input
    handleMainInput();
  }
}

function updateSuggestionFocus(suggestions) {
  Array.from(suggestions).forEach((item, index) => {
    if (index === state.mainSuggestionIndex) {
      item.classList.add('focused');
    } else {
      item.classList.remove('focused');
    }
  });
}

function showOperatorChooser() {
  state.operatorChooserActive = true;
  state.operatorIndex = 1; // Default to AND
  elements.operatorChooser.style.display = 'flex';
  updateOperatorDisplay();
}

function hideOperatorChooser() {
  state.operatorChooserActive = false;
  elements.operatorChooser.style.display = 'none';
  state.operatorIndex = 0;
}

function updateOperatorDisplay() {
  elements.operatorIndicator.textContent = state.operators[state.operatorIndex];
}

function confirmOperator() {
  const selectedOp = state.operators[state.operatorIndex];
  const cursorPos = state.cursorAfterSpace;
  const value = elements.mainInput.value;

  // Replace the space with the operator + space
  const before = value.substring(0, cursorPos - 1);
  const after = value.substring(cursorPos);
  elements.mainInput.value = before + selectedOp + ' ' + after;
  elements.mainInput.focus();
  elements.mainInput.setSelectionRange(before.length + selectedOp.length + 1, before.length + selectedOp.length + 1);

  state.mainInput = elements.mainInput.value;
  hideOperatorChooser();
  handleMainInput();
}

async function submitMainQuery() {
  const query = state.mainInput.trim();
  if (query.length === 0) {
    showToast('Please enter a query', 'error');
    return;
  }

  state.currentQuery = query;
  elements.resultsLoading.style.display = 'block';
  elements.resultsList.innerHTML = '';

  const result = await fetchStudies(query);
  elements.resultsLoading.style.display = 'none';

  if (result === null) {
    elements.resultsError.style.display = 'block';
    elements.resultsError.innerHTML = `Failed to fetch results. <button class="retry-btn" onclick="submitMainQuery()">Retry</button>`;
  } else {
    elements.resultsError.style.display = 'none';
    renderResults(result);
  }
}

// ======================
// Left Query Input Handlers
// ======================

async function handleLeftInput() {
  state.leftInput = elements.leftInput.value;

  const currentWord = state.leftInput;

  if (currentWord.length >= CONFIG.MIN_LENGTH) {
    const terms = await fetchTerms();
    renderSuggestions(terms, elements.leftSuggestions, currentWord, true);
  } else {
    hideSuggestions(true);
  }
}

function handleLeftKeydown(e) {
  const suggestions = elements.leftSuggestions.children;
  const suggestionVisible = elements.leftSuggestionsContainer.style.display !== 'none';

  if (e.key === 'Tab' && suggestionVisible && elements.leftGhostSuggestion.textContent) {
    e.preventDefault();
    // Accept ghost suggestion
    const ghostText = elements.leftGhostSuggestion.textContent;
    elements.leftInput.value = ghostText;
    elements.leftInput.focus();
  } else if (e.key === 'ArrowDown' && suggestionVisible) {
    e.preventDefault();
    state.leftSuggestionIndex = Math.min(
      state.leftSuggestionIndex + 1,
      suggestions.length - 1
    );
    updateLeftSuggestionFocus(suggestions);
  } else if (e.key === 'ArrowUp' && suggestionVisible) {
    e.preventDefault();
    state.leftSuggestionIndex = Math.max(state.leftSuggestionIndex - 1, -1);
    updateLeftSuggestionFocus(suggestions);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggestionVisible && state.leftSuggestionIndex >= 0) {
      // Select and submit
      const selectedText = suggestions[state.leftSuggestionIndex].textContent.trim();
      elements.leftInput.value = selectedText;
      submitLeftQuery();
    } else {
      // Submit current
      submitLeftQuery();
    }
  }
}

function updateLeftSuggestionFocus(suggestions) {
  Array.from(suggestions).forEach((item, index) => {
    if (index === state.leftSuggestionIndex) {
      item.classList.add('focused');
    } else {
      item.classList.remove('focused');
    }
  });
}

async function submitLeftQuery() {
  const term = elements.leftInput.value.trim();
  if (term.length === 0) {
    showToast('Please enter a term', 'error');
    return;
  }

  hideSuggestions(true);
  const related = await fetchRelatedTerms(term);
  renderRelatedTerms(related);
}

// ======================
// Event Listeners
// ======================

document.addEventListener('DOMContentLoaded', () => {
  // Main input
  const debouncedMainInput = debounce(handleMainInput, CONFIG.DEBOUNCE_MS);
  elements.mainInput.addEventListener('input', debouncedMainInput);
  elements.mainInput.addEventListener('keydown', handleMainKeydown);
  elements.mainInput.addEventListener('focus', () => {
    if (state.mainInput.length >= CONFIG.MIN_LENGTH) {
      handleMainInput();
    }
  });
  elements.mainSubmitBtn.addEventListener('click', submitMainQuery);

  // Left input
  const debouncedLeftInput = debounce(handleLeftInput, CONFIG.DEBOUNCE_MS);
  elements.leftInput.addEventListener('input', debouncedLeftInput);
  elements.leftInput.addEventListener('keydown', handleLeftKeydown);
  elements.leftInput.addEventListener('focus', () => {
    if (state.leftInput.length >= CONFIG.MIN_LENGTH) {
      handleLeftInput();
    }
  });
  elements.leftSubmitBtn.addEventListener('click', submitLeftQuery);

  // Click outside to hide suggestions
  document.addEventListener('click', (e) => {
    if (!elements.mainInput.contains(e.target) && !elements.mainSuggestionsContainer.contains(e.target)) {
      hideSuggestions(false);
      hideOperatorChooser();
    }
    if (!elements.leftInput.contains(e.target) && !elements.leftSuggestionsContainer.contains(e.target)) {
      hideSuggestions(true);
    }
  });

  // Initialize by fetching terms
  fetchTerms();
});
