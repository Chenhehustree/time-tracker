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
// Helper to get today's date string YYYY-MM-DD
// ========================================
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-${year}-${month}-${day}`;
}

// ========================================
// Tests
// ========================================

async function testFormatTime() {
  // Test that formatTime exists and works
  assert(typeof window.formatTime === 'function', 'formatTime should be a function');

  const date = new Date(2024, 0, 1, 9, 5); // Jan 1, 2024 09:05
  const result = window.formatTime(date);
  assertEquals(result, '09:05', 'formatTime should format as HH:MM');

  const date2 = new Date(2024, 0, 1, 14, 30); // 14:30
  const result2 = window.formatTime(date2);
  assertEquals(result2, '14:30', 'formatTime should handle afternoon');
}

async function testFormatDuration() {
  assert(typeof window.formatDuration === 'function', 'formatDuration should be a function');

  // 1 hour 23 minutes = 4980000 ms
  const ms1 = 1 * 60 * 60 * 1000 + 23 * 60 * 1000;
  assertEquals(window.formatDuration(ms1), '1小时23分钟', 'formatDuration should show hours and minutes');

  // 45 minutes
  const ms2 = 45 * 60 * 1000;
  assertEquals(window.formatDuration(ms2), '45分钟', 'formatDuration should show only minutes when less than 1 hour');

  // 2 hours 0 minutes
  const ms3 = 2 * 60 * 60 * 1000;
  assertEquals(window.formatDuration(ms3), '2小时0分钟', 'formatDuration should show 0 minutes');
}

async function testStopTimerSavesRecord() {
  const taskInput = document.getElementById('task-name-input');
  const startBtn = document.getElementById('start-stop-btn');

  taskInput.value = '测试任务';
  startBtn.click(); // Start
  await sleep(1100);
  startBtn.click(); // Stop

  const todayKey = getTodayKey();
  const raw = localStorage.getItem(todayKey);
  assert(raw !== null, `Record should be saved under key ${todayKey}`);

  const entries = JSON.parse(raw);
  assert(Array.isArray(entries), 'Saved data should be an array');
  assertEquals(entries.length, 1, 'Should have exactly one entry');

  const entry = entries[0];
  assertEquals(entry.taskName, '测试任务', 'Entry taskName should match');
  assert(typeof entry.id === 'string', 'Entry should have an id string');
  assert(typeof entry.startTime === 'number', 'Entry startTime should be a number');
  assert(typeof entry.endTime === 'number', 'Entry endTime should be a number');
  assert(typeof entry.rawDuration === 'number', 'Entry rawDuration should be a number');
  assert(entry.rawDuration > 0, 'rawDuration should be positive');
}

async function testRenderTodayEntries() {
  const todayKey = getTodayKey();
  const entries = [
    {
      id: 'test-id-1',
      taskName: '任务A',
      startTime: new Date(2024, 0, 1, 9, 0).getTime(),
      endTime: new Date(2024, 0, 1, 10, 30).getTime(),
      rawDuration: 90 * 60 * 1000
    }
  ];

  // After setup, initApp should have called renderTodayEntries
  // But since we set entries before DOMContentLoaded, it should render them
  // Wait, setup runs initApp after DOMContentLoaded, but entries are set before.
  // However, renderTodayEntries reads localStorage at call time.
  // So if entries are pre-populated before initApp runs, it should work.

  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assert(rows.length > 0, 'Should render at least one row');

  const firstRow = rows[0];
  const cells = firstRow.querySelectorAll('td');
  assertEquals(cells[0].textContent, '任务A', 'First cell should be task name');
  assertEquals(cells[1].textContent, '09:00', 'Second cell should be start time');
  assertEquals(cells[2].textContent, '10:30', 'Third cell should be end time');
  assertEquals(cells[3].textContent, '1小时30分钟', 'Fourth cell should be duration');
}

async function testRenderTodayEntriesEmpty() {
  const tbody = document.getElementById('records-tbody');
  assertIncludes(tbody.textContent, '暂无记录', 'Should show "暂无记录" when empty');
}

async function testDeleteEntry() {
  const todayKey = getTodayKey();
  const entries = [
    {
      id: 'test-id-1',
      taskName: '任务A',
      startTime: new Date(2024, 0, 1, 9, 0).getTime(),
      endTime: new Date(2024, 0, 1, 10, 30).getTime(),
      rawDuration: 90 * 60 * 1000
    },
    {
      id: 'test-id-2',
      taskName: '任务B',
      startTime: new Date(2024, 0, 1, 11, 0).getTime(),
      endTime: new Date(2024, 0, 1, 11, 30).getTime(),
      rawDuration: 30 * 60 * 1000
    }
  ];

  // Verify both entries rendered
  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assertEquals(rows.length, 2, 'Should render two rows initially');

  // Find and click delete button for first entry
  const deleteBtn = rows[0].querySelector('.btn-delete');
  assert(deleteBtn !== null, 'First row should have a delete button');
  deleteBtn.click();

  // Verify entry removed from localStorage
  const raw = localStorage.getItem(todayKey);
  const savedEntries = JSON.parse(raw);
  assertEquals(savedEntries.length, 1, 'Should have one entry left in localStorage');
  assertEquals(savedEntries[0].id, 'test-id-2', 'Remaining entry should be test-id-2');

  // Verify DOM updated
  const rowsAfter = tbody.querySelectorAll('tr');
  assertEquals(rowsAfter.length, 1, 'Should render one row after delete');
  assertEquals(rowsAfter[0].querySelectorAll('td')[0].textContent, '任务B', 'Remaining row should be 任务B');
}

async function testInitAppRendersExistingEntries() {
  const todayKey = getTodayKey();
  const entries = [
    {
      id: 'test-id-init',
      taskName: '初始化任务',
      startTime: new Date(2024, 0, 1, 8, 0).getTime(),
      endTime: new Date(2024, 0, 1, 9, 0).getTime(),
      rawDuration: 60 * 60 * 1000
    }
  ];

  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assertEquals(rows.length, 1, 'Should render existing entries on init');
  assertEquals(rows[0].querySelectorAll('td')[0].textContent, '初始化任务', 'Should show the existing task');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running Storage & Records Tests...\n');

  await runTest('Format Time - formats Date to HH:MM', testFormatTime);
  await runTest('Format Duration - converts ms to human readable', testFormatDuration);
  await runTest('Stop Timer - saves record to localStorage', testStopTimerSavesRecord);
  await runTest('Render Today Entries - renders existing records', testRenderTodayEntries, {
    entries: {
      [getTodayKey()]: [
        {
          id: 'test-id-1',
          taskName: '任务A',
          startTime: new Date(2024, 0, 1, 9, 0).getTime(),
          endTime: new Date(2024, 0, 1, 10, 30).getTime(),
          rawDuration: 90 * 60 * 1000
        }
      ]
    }
  });
  await runTest('Render Today Entries - shows empty message', testRenderTodayEntriesEmpty);
  await runTest('Delete Entry - removes record and updates UI', testDeleteEntry, {
    entries: {
      [getTodayKey()]: [
        {
          id: 'test-id-1',
          taskName: '任务A',
          startTime: new Date(2024, 0, 1, 9, 0).getTime(),
          endTime: new Date(2024, 0, 1, 10, 30).getTime(),
          rawDuration: 90 * 60 * 1000
        },
        {
          id: 'test-id-2',
          taskName: '任务B',
          startTime: new Date(2024, 0, 1, 11, 0).getTime(),
          endTime: new Date(2024, 0, 1, 11, 30).getTime(),
          rawDuration: 30 * 60 * 1000
        }
      ]
    }
  });
  await runTest('Init App - renders existing entries on load', testInitAppRendersExistingEntries, {
    entries: {
      [getTodayKey()]: [
        {
          id: 'test-id-init',
          taskName: '初始化任务',
          startTime: new Date(2024, 0, 1, 8, 0).getTime(),
          endTime: new Date(2024, 0, 1, 9, 0).getTime(),
          rawDuration: 60 * 60 * 1000
        }
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
