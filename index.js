// Configuration
const CONFIG = {
  API_BASE: 'https://hpc.psy.ntu.edu.tw:5000',
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
  operators: ['AND', 'OR', 'NOT'], // Only AND, OR, NOT (no space)
  cursorAfterSpace: 0, // Position where space was typed
  leftResults: [], // Related terms data
  resultsData: [], // Study results
  resultsTotal: 0,
  currentQuery: '',
  operatorChooserActive: false,
  // Related terms sorting and Top-K
  relatedSortBy: 'co_count',
  relatedTopK: 10,
  // Results sorting
  resultsSortBy: 'year',
};

// DOM Elements
const elements = {
  // Main query inputs
  mainInput: document.getElementById('mainInput'),
  leftInput: document.getElementById('leftInput'),


  // Suggestions
  mainSuggestionsContainer: document.getElementById('mainSuggestionsContainer'),
  mainSuggestions: document.getElementById('mainSuggestions'),
  leftSuggestionsContainer: document.getElementById('leftSuggestionsContainer'),
  leftSuggestions: document.getElementById('leftSuggestions'),

  // Operator chooser
  operatorChooserContainer: document.getElementById('operatorChooserContainer'),
  operatorChooser: document.getElementById('operatorChooser'),

  // Related panel
  relatedPanel: document.getElementById('relatedPanel'),
  relatedList: document.getElementById('relatedList'),
  relatedLoading: document.getElementById('relatedLoading'),
  relatedControls: document.getElementById('relatedControls'),
  relatedListContainer: document.getElementById('relatedListContainer'),
  sortByCoCountBtn: document.getElementById('sortByCoCountBtn'),
  sortByJaccardBtn: document.getElementById('sortByJaccardBtn'),
  topk10Btn: document.getElementById('topk10Btn'),
  topk20Btn: document.getElementById('topk20Btn'),
  topk50Btn: document.getElementById('topk50Btn'),

  // Results
  resultsSection: document.getElementById('resultsSection'),
  resultsList: document.getElementById('resultsList'),
  resultCount: document.getElementById('resultCount'),
  resultsError: document.getElementById('resultsError'),
  resultsLoading: document.getElementById('resultsLoading'),
  resultsControls: document.getElementById('resultsControls'),
  sortByYearBtn: document.getElementById('sortByYearBtn'),
  sortByTitleBtn: document.getElementById('sortByTitleBtn'),

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
    } else {
      state.mainSuggestionIndex = -1;
    }
    return;
  }

  container.parentElement.style.display = 'block';

  // Pre-select first item (set index to 0, not -1)
  if (isLeftPanel) {
    state.leftSuggestionIndex = 0;
  } else {
    state.mainSuggestionIndex = 0;
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

    // Copy buttons removed

    li.addEventListener('click', () => {
      selectSuggestion(term, isLeftPanel);
    });

    // Update suggestion focus on hover
    li.addEventListener('mouseenter', () => {
      if (isLeftPanel) {
        state.leftSuggestionIndex = index;
      } else {
        state.mainSuggestionIndex = index;
      }
      updateSuggestionFocus(container);
    });

    container.appendChild(li);
  });
}

function selectSuggestion(term, isLeftPanel) {
  if (isLeftPanel) {
    elements.leftInput.value = term;
    submitLeftQuery();
  } else {
    const cursorPos = elements.mainInput.selectionStart;
    const value = elements.mainInput.value;

    // Find the start of current word (last space or start of string)
    let wordStart = value.lastIndexOf(' ', cursorPos - 1) + 1;
    const before = value.substring(0, wordStart);
    elements.mainInput.value = before + term;
    elements.mainInput.focus();
    elements.mainInput.setSelectionRange(before.length + term.length, before.length + term.length);

    state.mainInput = elements.mainInput.value;
    hideSuggestions(false);
  }
}

function hideSuggestions(isLeftPanel) {
  const container = isLeftPanel ? elements.leftSuggestionsContainer : elements.mainSuggestionsContainer;
  container.style.display = 'none';
  if (isLeftPanel) {
    state.leftSuggestionIndex = -1;
  } else {
    state.mainSuggestionIndex = -1;
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

function renderRelatedTerms(related, sortBy = 'co_count', topK = 10) {
  if (!related || related.length === 0) {
    // Show panel and a friendly message when no related terms are found
    elements.relatedPanel.style.display = 'block';
    elements.relatedLoading.style.display = 'none';
    elements.relatedControls.style.display = 'none';
    elements.relatedListContainer.style.display = 'block';
    elements.relatedList.innerHTML = `<div style="padding:12px;color:#7f8c8d;">No related terms found</div>`;
    return;
  }

  state.leftResults = related;
  state.relatedSortBy = sortBy;
  state.relatedTopK = topK;

  // Calculate rankings based on ALL related terms
  const byCoCount = [...related].sort((a, b) => b.co_count - a.co_count);
  const coCountRanks = new Map();
  byCoCount.forEach((item, idx) => {
    coCountRanks.set(item.term, idx + 1);
  });

  const byJaccard = [...related].sort((a, b) => b.jaccard - a.jaccard);
  const jaccardRanks = new Map();
  byJaccard.forEach((item, idx) => {
    jaccardRanks.set(item.term, idx + 1);
  });

  // Sort by selected method and slice to topK
  const sorted = [...related].sort((a, b) =>
    sortBy === 'co_count'
      ? b.co_count - a.co_count
      : b.jaccard - a.jaccard
  ).slice(0, topK);

  // Render single column with ranking info
  elements.relatedList.innerHTML = '';
  sorted.forEach((item) => {
    elements.relatedList.appendChild(createRelatedTermElement(item, coCountRanks, jaccardRanks));
  });

  // Update button states
  elements.sortByCoCountBtn.classList.toggle('active', sortBy === 'co_count');
  elements.sortByJaccardBtn.classList.toggle('active', sortBy === 'jaccard');
  elements.topk10Btn.classList.toggle('active', topK === 10);
  elements.topk20Btn.classList.toggle('active', topK === 20);
  elements.topk50Btn.classList.toggle('active', topK === 50);

  // Show controls and list after rendering is complete
  elements.relatedControls.style.display = 'flex';
  elements.relatedListContainer.style.display = 'block';
}

function createRelatedTermElement(item, coCountRanks, jaccardRanks) {
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

  // Show ranking based on all related terms
  let coCountText = `co_count: ${item.co_count}`;
  if (coCountRanks && coCountRanks.has(item.term)) {
    coCountText += ` (#${coCountRanks.get(item.term)} for co_count)`;
  }

  let jaccardText = `jaccard: ${item.jaccard.toFixed(4)}`;
  if (jaccardRanks && jaccardRanks.has(item.term)) {
    jaccardText += ` (#${jaccardRanks.get(item.term)} for jaccard)`;
  }

  // Set text content with HTML to show rankings on separate lines
  scoresDiv.innerHTML = `${coCountText}<br>${jaccardText}`;

  // Also set as tooltip with both lines
  const tooltipText = `${coCountText}\n${jaccardText}`;
  scoresDiv.title = tooltipText;

  infoDiv.appendChild(termDiv);
  infoDiv.appendChild(scoresDiv);

  li.appendChild(infoDiv);

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

  state.resultsData = data.results;
  state.resultsTotal = data.count;

  elements.resultCount.textContent = state.resultsTotal;
  elements.resultsList.innerHTML = '';

  if (state.resultsTotal === 0) {
    elements.resultsList.innerHTML =
      `<div style="padding: 20px; text-align: center; color: #7f8c8d;">
      No results found for "${state.currentQuery}". Try a different search.
      </div>`;
    // Show results section even for no results
    elements.resultsControls.style.display = 'none';
    elements.resultsSection.style.display = 'block';
    return;
  }

  // Sort results
  const sortedData = sortResults([...state.resultsData], state.resultsSortBy);

  sortedData.slice(0, 200).forEach((result) => {
    const item = createResultElement(result);
    elements.resultsList.appendChild(item);
  });

  // Setup infinite scroll
  setupInfiniteScroll();

  // Show controls and results section after rendering is complete
  elements.resultsControls.style.display = 'flex';
  elements.resultsSection.style.display = 'block';
}

function sortResults(results, sortBy) {
  if (sortBy === 'year') {
    // Sort by year (descending), then by title (ascending)
    return results.sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.title.localeCompare(b.title);
    });
  } else if (sortBy === 'title') {
    // Sort by title (ascending)
    return results.sort((a, b) => a.title.localeCompare(b.title));
  }
  return results;
}

function renderSortedResults() {
  // Re-render results with new sorting
  elements.resultsList.innerHTML = '';

  // Sort results
  const sortedData = sortResults([...state.resultsData], state.resultsSortBy);

  // Update button states
  elements.sortByYearBtn.classList.toggle('active', state.resultsSortBy === 'year');
  elements.sortByTitleBtn.classList.toggle('active', state.resultsSortBy === 'title');

  sortedData.slice(0, 200).forEach((result) => {
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

  // Get the current word being typed
  const lastSpaceIndex = state.mainInput.lastIndexOf(' ', cursorPos - 1);
  const currentWord = state.mainInput.substring(lastSpaceIndex + 1, cursorPos);

  // Only hide operator chooser if we're not immediately after a space
  // and the operator chooser is active
  if (lastChar !== ' ' && state.operatorChooserActive) {
    hideOperatorChooser();
  }

  // Fetch and render suggestions for current word
  if (currentWord.length >= CONFIG.MIN_LENGTH && lastChar !== ' ') {
    const terms = await fetchTerms();
    renderSuggestions(terms, elements.mainSuggestions, currentWord, false);
  } else {
    hideSuggestions(false);
  }

  // Also auto-submit the full query (debounced) if it's long enough,
  // but do NOT auto-submit immediately after the user typed a space
  // (space is used to trigger the operator chooser and should be preserved).
  if (lastChar !== ' ' && !state.operatorChooserActive) {
    const fullQuery = state.mainInput.trim();
    if (fullQuery.length >= CONFIG.MIN_LENGTH) {
      await submitMainQuery();
    } else {
      // hide results when query is too short
      elements.resultsSection.style.display = 'none';
    }
  }
}

function handleMainKeydown(e) {
  const isOperatorChooserVisible = state.operatorChooserActive;

  if (isOperatorChooserVisible) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.operatorIndex = (state.operatorIndex - 1 + state.operators.length) % state.operators.length;
      updateOperatorFocus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.operatorIndex = (state.operatorIndex + 1) % state.operators.length;
      updateOperatorFocus();
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

  if (e.key === 'ArrowDown' && suggestionVisible) {
    e.preventDefault();
    state.mainSuggestionIndex = (state.mainSuggestionIndex + 1) % suggestions.length;
    updateSuggestionFocus(suggestions);

  } else if (e.key === 'ArrowUp' && suggestionVisible) {
    e.preventDefault();
    state.mainSuggestionIndex = (state.mainSuggestionIndex - 1 + suggestions.length) % suggestions.length;
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
  } else if (e.key === 'Escape' && suggestionVisible) {
    // Close only the main suggestions when Escape is pressed and suggestions are visible
    e.preventDefault();
    hideSuggestions(false);
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
      // Auto-scroll to focused item
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('focused');
    }
  });
}

function initializeOperatorChooser() {
  const operatorList = elements.operatorChooser;
  operatorList.innerHTML = '';

  state.operators.forEach((op, idx) => {
    const li = document.createElement('li');
    li.className = 'operator-item';
    li.textContent = op;
    li.dataset.value = op;
    li.dataset.index = idx;

    // Default to AND (index 0)
    if (idx === 0) {
      li.classList.add('focused');
    }

    // Click to select
    li.addEventListener('click', () => {
      state.operatorIndex = idx;
      updateOperatorFocus();
      confirmOperator();
    });

    // Hover to preview
    li.addEventListener('mouseenter', () => {
      state.operatorIndex = idx;
      updateOperatorFocus();
    });

    operatorList.appendChild(li);
  });
}

function updateOperatorFocus() {
  const items = document.querySelectorAll('.operator-item');
  items.forEach((item, idx) => {
    item.classList.toggle('focused', idx === state.operatorIndex);
  });
}

function showOperatorChooser() {
  state.operatorChooserActive = true;
  state.operatorIndex = 0; // Default to AND (first item)
  elements.operatorChooserContainer.style.display = 'block';
  updateOperatorFocus();
}

function hideOperatorChooser() {
  state.operatorChooserActive = false;
  elements.operatorChooserContainer.style.display = 'none';
  state.operatorIndex = 0;
}

function confirmOperator() {
  const selectedOp = state.operators[state.operatorIndex];
  const value = elements.mainInput.value;

  // Append operator and add space after it for next term
  elements.mainInput.value = value + selectedOp + ' ';
  elements.mainInput.focus();
  elements.mainInput.setSelectionRange(value.length + selectedOp.length + 1, value.length + selectedOp.length + 1);

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
  elements.mainInput.value = query;

  // Show loading indicator, hide results
  elements.resultsSection.style.display = 'block';
  elements.resultsLoading.style.display = 'block';
  elements.resultsList.innerHTML = '';
  elements.resultsError.style.display = 'none';

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

    // Auto-fetch related terms via AJAX (debounced)
    elements.relatedPanel.style.display = 'block';
    elements.relatedLoading.style.display = 'block';
    elements.relatedControls.style.display = 'none';
    elements.relatedListContainer.style.display = 'none';
    const related = await fetchRelatedTerms(currentWord);
    elements.relatedLoading.style.display = 'none';
    renderRelatedTerms(related);
  } else {
    hideSuggestions(true);
    elements.relatedPanel.style.display = 'none';
  }
}

function handleLeftKeydown(e) {
  const suggestions = elements.leftSuggestions.children;
  const suggestionVisible = elements.leftSuggestionsContainer.style.display !== 'none';

  if (e.key === 'Enter') {
    // Handle Enter key separately to ensure it always works
    e.preventDefault();
    if (suggestionVisible && state.leftSuggestionIndex >= 0) {
      // Select and submit
      const selectedText = suggestions[state.leftSuggestionIndex].textContent.trim();
      elements.leftInput.value = selectedText;
      submitLeftQuery();
    } else {
      // Submit current input
      submitLeftQuery();
    }
  } else if (e.key === 'ArrowDown' && suggestionVisible) {
    e.preventDefault();
    state.leftSuggestionIndex = (state.leftSuggestionIndex + 1) % suggestions.length;
    updateLeftSuggestionFocus(suggestions);
  } else if (e.key === 'ArrowUp' && suggestionVisible) {
    e.preventDefault();
    state.leftSuggestionIndex = (state.leftSuggestionIndex - 1 + suggestions.length) % suggestions.length;
    updateLeftSuggestionFocus(suggestions);
  } else if (e.key === 'Escape' && suggestionVisible) {
    // Close only the left suggestions when Escape is pressed
    e.preventDefault();
    hideSuggestions(true);
  }
}

function updateLeftSuggestionFocus(suggestions) {
  Array.from(suggestions).forEach((item, index) => {
    if (index === state.leftSuggestionIndex) {
      item.classList.add('focused');
      // Auto-scroll to focused item
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  // Show only loading indicator, hide controls and list
  elements.relatedPanel.style.display = 'block';
  elements.relatedLoading.style.display = 'block';
  elements.relatedControls.style.display = 'none';
  elements.relatedListContainer.style.display = 'none';

  const related = await fetchRelatedTerms(term);

  // Hide loading and render results
  elements.relatedLoading.style.display = 'none';
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

  // Left input
  const debouncedLeftInput = debounce(handleLeftInput, CONFIG.DEBOUNCE_MS);
  elements.leftInput.addEventListener('input', debouncedLeftInput);
  elements.leftInput.addEventListener('keydown', handleLeftKeydown);
  elements.leftInput.addEventListener('focus', () => {
    if (state.leftInput.length >= CONFIG.MIN_LENGTH) {
      handleLeftInput();
    }
  });

  // Initialize operator chooser list
  initializeOperatorChooser();

  // Related panel sort and Top-K buttons
  elements.sortByCoCountBtn.addEventListener('click', () => {
    renderRelatedTerms(state.leftResults, 'co_count', state.relatedTopK);
  });

  elements.sortByJaccardBtn.addEventListener('click', () => {
    renderRelatedTerms(state.leftResults, 'jaccard', state.relatedTopK);
  });

  elements.topk10Btn.addEventListener('click', () => {
    renderRelatedTerms(state.leftResults, state.relatedSortBy, 10);
  });

  elements.topk20Btn.addEventListener('click', () => {
    renderRelatedTerms(state.leftResults, state.relatedSortBy, 20);
  });

  elements.topk50Btn.addEventListener('click', () => {
    renderRelatedTerms(state.leftResults, state.relatedSortBy, 50);
  });

  // Results sort buttons
  elements.sortByYearBtn.addEventListener('click', () => {
    state.resultsSortBy = 'year';
    renderSortedResults();
  });

  elements.sortByTitleBtn.addEventListener('click', () => {
    state.resultsSortBy = 'title';
    renderSortedResults();
  });

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
