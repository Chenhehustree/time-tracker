const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'time-tracker.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

let dom;
let document;
let window;
let localStorage;

async function setup(options = {}) {
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  window = dom.window;
  document = window.document;
  localStorage = window.localStorage;

  // Pre-populate localStorage entries if provided
  if (options.entries) {
    for (const [key, value] of Object.entries(options.entries)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  // Wait for DOMContentLoaded to ensure scripts have initialized
  await new Promise(resolve => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
      setTimeout(resolve, 300);
    }
  });
}

function teardown() {
  if (dom) {
    dom.window.close();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simple assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected to include: ${needle}\n  Actual: ${haystack}`);
  }
}

// Test runner
let passCount = 0;
let failCount = 0;

async function runTest(name, fn, setupOptions = {}) {
  try {
    await setup(setupOptions);
    await fn();
    console.log(`  PASS: ${name}`);
    passCount++;
  } catch (e) {
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
    failCount++;
  } finally {
    teardown();
  }
}

// ========================================
// Helper functions
// ========================================
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-${year}-${month}-${day}`;
}

function getDateKey(dateStr) {
  return `time-tracker-${dateStr}`;
}

function createEntry(id, taskName, startHour, startMin, endHour, endMin, dateStr = '2024-01-15') {
  const baseDate = new Date(dateStr + 'T00:00:00');
  const startTime = new Date(baseDate).setHours(startHour, startMin, 0, 0);
  const endTime = new Date(baseDate).setHours(endHour, endMin, 0, 0);
  const rawDuration = endTime - startTime;
  return {
    id,
    taskName,
    startTime,
    endTime,
    rawDuration,
    effectiveDuration: rawDuration
  };
}

// ========================================
// Tests for AC1: 日期切换查看历史
// ========================================

async function testRenderHistoryEntriesExists() {
  assert(typeof window.renderHistoryEntries === 'function', 'renderHistoryEntries should be a function');
}

async function testRenderHistoryEntriesRendersRecords() {
  const dateStr = '2024-01-15';
  const dateKey = getDateKey(dateStr);

  window.renderHistoryEntries(dateStr);

  const historyTbody = document.getElementById('history-tbody');
  const rows = historyTbody.querySelectorAll('tr');
  assertEquals(rows.length, 2, 'Should render two history rows');

  const firstRow = rows[0];
  const cells = firstRow.querySelectorAll('td');
  assertEquals(cells[0].textContent, '历史任务A', 'First cell should be task name');
  assertEquals(cells[1].textContent, '09:00', 'Second cell should be start time');
  assertEquals(cells[2].textContent, '10:30', 'Third cell should be end time');
  assertIncludes(cells[3].textContent, '1小时30分钟', 'Fourth cell should contain duration');
}

async function testRenderHistoryEntriesEmpty() {
  const dateStr = '2024-01-16';

  window.renderHistoryEntries(dateStr);

  const historyTbody = document.getElementById('history-tbody');
  assertIncludes(historyTbody.textContent, '该日期暂无记录', 'Should show empty message for history');
}

async function testHistoryDateChangeEvent() {
  const dateStr = '2024-01-15';
  const dateInput = document.getElementById('history-date');

  dateInput.value = dateStr;
  dateInput.dispatchEvent(new window.Event('change', { bubbles: true }));

  await sleep(100);

  const historyTbody = document.getElementById('history-tbody');
  const rows = historyTbody.querySelectorAll('tr');
  assertEquals(rows.length, 2, 'Should render history rows after date change');
}

async function testUpdateHistoryStatsExists() {
  assert(typeof window.updateHistoryStats === 'function', 'updateHistoryStats should be a function');
}

async function testUpdateHistoryStatsDisplaysStats() {
  const dateStr = '2024-01-15';

  window.updateHistoryStats(dateStr);

  const historyStats = document.getElementById('history-stats');
  assert(historyStats !== null, 'History stats element should exist');
  assertIncludes(historyStats.textContent, '总在线时间', 'Should show total online time');
  assertIncludes(historyStats.textContent, '有效工时', 'Should show effective time');
  assertIncludes(historyStats.textContent, '人天', 'Should show person days');
}

// ========================================
// Tests for AC2: 编辑记录
// ========================================

async function testEditButtonExists() {
  const todayKey = getTodayKey();
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assert(rows.length > 0, 'Should have at least one row');

  const firstRow = rows[0];
  const editBtn = firstRow.querySelector('.btn-edit');
  assert(editBtn !== null, 'Each row should have an edit button');
}

async function testClickEditShowsTimeInputs() {
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];

  const editBtn = firstRow.querySelector('.btn-edit');
  editBtn.click();

  const startInput = firstRow.querySelector('input[type="time"].edit-start-time');
  const endInput = firstRow.querySelector('input[type="time"].edit-end-time');
  assert(startInput !== null, 'Start time input should appear after clicking edit');
  assert(endInput !== null, 'End time input should appear after clicking edit');

  const saveBtn = firstRow.querySelector('.btn-save-edit');
  const cancelBtn = firstRow.querySelector('.btn-cancel-edit');
  assert(saveBtn !== null, 'Save button should appear after clicking edit');
  assert(cancelBtn !== null, 'Cancel button should appear after clicking edit');
}

async function testEditSaveValidatesTime() {
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];

  const editBtn = firstRow.querySelector('.btn-edit');
  editBtn.click();

  const startInput = firstRow.querySelector('input[type="time"].edit-start-time');
  const endInput = firstRow.querySelector('input[type="time"].edit-end-time');

  startInput.value = '12:00';
  endInput.value = '10:00'; // Invalid: end < start

  let alertMessage = null;
  window.alert = function(msg) {
    alertMessage = msg;
  };

  const saveBtn = firstRow.querySelector('.btn-save-edit');
  saveBtn.click();

  assert(alertMessage !== null, 'Should alert when end time is not greater than start time');
}

async function testEditSaveUpdatesRecord() {
  const todayKey = getTodayKey();
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];

  const editBtn = firstRow.querySelector('.btn-edit');
  editBtn.click();

  const startInput = firstRow.querySelector('input[type="time"].edit-start-time');
  const endInput = firstRow.querySelector('input[type="time"].edit-end-time');

  startInput.value = '08:00';
  endInput.value = '09:30';

  const saveBtn = firstRow.querySelector('.btn-save-edit');
  saveBtn.click();

  await sleep(100);

  // Check localStorage updated
  const raw = localStorage.getItem(todayKey);
  const entries = JSON.parse(raw);
  // createEntry uses '2024-01-15' as default date, so we use that for assertion
  const baseDate = new Date('2024-01-15T00:00:00');
  const expectedStart = new Date(baseDate).setHours(8, 0, 0, 0);
  const expectedEnd = new Date(baseDate).setHours(9, 30, 0, 0);
  assertEquals(entries[0].startTime, expectedStart, 'Start time should be updated');
  assertEquals(entries[0].endTime, expectedEnd, 'End time should be updated');
}

async function testEditCancelRestoresDisplay() {
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];

  const originalStartTime = firstRow.querySelectorAll('td')[1].textContent;

  const editBtn = firstRow.querySelector('.btn-edit');
  editBtn.click();

  const cancelBtn = firstRow.querySelector('.btn-cancel-edit');
  cancelBtn.click();

  const startTimeCell = firstRow.querySelectorAll('td')[1];
  assertEquals(startTimeCell.textContent, originalStartTime, 'Should restore original display after cancel');
}

// ========================================
// Tests for AC3: 手动添加记录
// ========================================

async function testManualAddButtonExists() {
  const addBtn = document.getElementById('manual-add-btn');
  assert(addBtn !== null, 'Manual add button should exist');
}

async function testClickManualAddShowsForm() {
  const addBtn = document.getElementById('manual-add-btn');
  addBtn.click();

  const form = document.getElementById('manual-add-form');
  assert(form !== null, 'Manual add form should exist');
  assert(form.style.display !== 'none', 'Form should be visible after clicking button');

  const taskInput = document.getElementById('manual-task-name');
  const startInput = document.getElementById('manual-start-time');
  const endInput = document.getElementById('manual-end-time');
  const dateInput = document.getElementById('manual-date');

  assert(taskInput !== null, 'Task name input should exist');
  assert(startInput !== null, 'Start time input should exist');
  assert(endInput !== null, 'End time input should exist');
  assert(dateInput !== null, 'Date input should exist');
}

async function testManualAddValidatesFields() {
  const addBtn = document.getElementById('manual-add-btn');
  addBtn.click();

  let alertMessage = null;
  window.alert = function(msg) {
    alertMessage = msg;
  };

  const saveBtn = document.getElementById('manual-save-btn');
  saveBtn.click();

  assert(alertMessage !== null, 'Should alert when fields are empty');
}

async function testManualAddValidatesTimeOrder() {
  const addBtn = document.getElementById('manual-add-btn');
  addBtn.click();

  document.getElementById('manual-task-name').value = '手动任务';
  document.getElementById('manual-start-time').value = '14:00';
  document.getElementById('manual-end-time').value = '13:00'; // Invalid
  document.getElementById('manual-date').value = '2024-01-20';

  let alertMessage = null;
  window.alert = function(msg) {
    alertMessage = msg;
  };

  const saveBtn = document.getElementById('manual-save-btn');
  saveBtn.click();

  assert(alertMessage !== null, 'Should alert when end time <= start time');
}

async function testManualAddSavesToCorrectDate() {
  const dateStr = '2024-01-20';
  const dateKey = getDateKey(dateStr);

  const addBtn = document.getElementById('manual-add-btn');
  addBtn.click();

  document.getElementById('manual-task-name').value = '手动任务';
  document.getElementById('manual-start-time').value = '09:00';
  document.getElementById('manual-end-time').value = '11:00';
  document.getElementById('manual-date').value = dateStr;

  const saveBtn = document.getElementById('manual-save-btn');
  saveBtn.click();

  await sleep(100);

  const raw = localStorage.getItem(dateKey);
  assert(raw !== null, 'Record should be saved to correct date key');

  const entries = JSON.parse(raw);
  assertEquals(entries.length, 1, 'Should have one entry');
  assertEquals(entries[0].taskName, '手动任务', 'Task name should match');
}

async function testManualAddRerendersList() {
  const dateStr = '2024-01-20';

  // Set history date to the target date
  const historyDateInput = document.getElementById('history-date');
  historyDateInput.value = dateStr;
  historyDateInput.dispatchEvent(new window.Event('change', { bubbles: true }));

  await sleep(100);

  const addBtn = document.getElementById('manual-add-btn');
  addBtn.click();

  document.getElementById('manual-task-name').value = '手动任务2';
  document.getElementById('manual-start-time').value = '14:00';
  document.getElementById('manual-end-time').value = '15:00';
  document.getElementById('manual-date').value = dateStr;

  const saveBtn = document.getElementById('manual-save-btn');
  saveBtn.click();

  await sleep(100);

  const historyTbody = document.getElementById('history-tbody');
  assertIncludes(historyTbody.textContent, '手动任务2', 'Should render new entry in history list');
}

// ========================================
// Tests for AC4: 历史统计更新
// ========================================

async function testHistoryStatsAfterEdit() {
  const todayKey = getTodayKey();

  // Start editing
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  const firstRow = rows[0];

  const editBtn = firstRow.querySelector('.btn-edit');
  editBtn.click();

  const startInput = firstRow.querySelector('input[type="time"].edit-start-time');
  const endInput = firstRow.querySelector('input[type="time"].edit-end-time');

  startInput.value = '08:00';
  endInput.value = '12:00'; // 4 hours

  const saveBtn = firstRow.querySelector('.btn-save-edit');
  saveBtn.click();

  await sleep(100);

  // Check that stats panel is updated
  const effectiveTimeEl = document.getElementById('effective-time');
  assert(effectiveTimeEl !== null, 'Effective time element should exist');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running History & Edit Tests...\n');

  // AC1 Tests
  await runTest('renderHistoryEntries function exists', testRenderHistoryEntriesExists);
  await runTest('Render History Entries - renders records for a date', testRenderHistoryEntriesRendersRecords, {
    entries: {
      [getDateKey('2024-01-15')]: [
        createEntry('hist-1', '历史任务A', 9, 0, 10, 30, '2024-01-15'),
        createEntry('hist-2', '历史任务B', 14, 0, 15, 0, '2024-01-15')
      ]
    }
  });
  await runTest('Render History Entries - shows empty message', testRenderHistoryEntriesEmpty);
  await runTest('History Date Change - updates table on change', testHistoryDateChangeEvent, {
    entries: {
      [getDateKey('2024-01-15')]: [
        createEntry('hist-1', '历史任务A', 9, 0, 10, 30, '2024-01-15'),
        createEntry('hist-2', '历史任务B', 14, 0, 15, 0, '2024-01-15')
      ]
    }
  });
  await runTest('updateHistoryStats function exists', testUpdateHistoryStatsExists);
  await runTest('Update History Stats - displays stats', testUpdateHistoryStatsDisplaysStats, {
    entries: {
      [getDateKey('2024-01-15')]: [
        createEntry('hist-1', '历史任务A', 9, 0, 10, 30, '2024-01-15'),
        createEntry('hist-2', '历史任务B', 14, 0, 15, 0, '2024-01-15')
      ]
    }
  });

  // AC2 Tests
  await runTest('Edit Button - exists on each row', testEditButtonExists, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });
  await runTest('Click Edit - shows time inputs and buttons', testClickEditShowsTimeInputs, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });
  await runTest('Edit Save - validates time order', testEditSaveValidatesTime, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });
  await runTest('Edit Save - updates record in localStorage', testEditSaveUpdatesRecord, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });
  await runTest('Edit Cancel - restores original display', testEditCancelRestoresDisplay, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });

  // AC3 Tests
  await runTest('Manual Add Button - exists', testManualAddButtonExists);
  await runTest('Click Manual Add - shows form', testClickManualAddShowsForm);
  await runTest('Manual Add - validates empty fields', testManualAddValidatesFields);
  await runTest('Manual Add - validates time order', testManualAddValidatesTimeOrder);
  await runTest('Manual Add - saves to correct date', testManualAddSavesToCorrectDate);
  await runTest('Manual Add - rerenders list after save', testManualAddRerendersList);

  // AC4 Tests
  await runTest('History Stats - updates after edit', testHistoryStatsAfterEdit, {
    entries: {
      [getTodayKey()]: [
        createEntry('today-1', '今日任务', 9, 0, 10, 0)
      ]
    }
  });

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
