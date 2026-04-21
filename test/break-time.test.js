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

  // Pre-populate localStorage if provided
  if (options.localStorage) {
    for (const [key, value] of Object.entries(options.localStorage)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
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

function assertArrayEquals(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
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
// Tests
// ========================================

async function testGetBreakPeriodsDefault() {
  assert(typeof window.getBreakPeriods === 'function', 'getBreakPeriods should be a function');

  const periods = window.getBreakPeriods();
  assert(Array.isArray(periods), 'getBreakPeriods should return an array');
  assertEquals(periods.length, 2, 'Should return 2 default break periods');

  assertEquals(periods[0].name, '午休', 'First period should be 午休');
  assertEquals(periods[0].start, '11:30', 'First period start should be 11:30');
  assertEquals(periods[0].end, '13:30', 'First period end should be 13:30');
  assertEquals(periods[0].color, '#FFD93D', 'First period color should be #FFD93D');

  assertEquals(periods[1].name, '晚间休息', 'Second period should be 晚间休息');
  assertEquals(periods[1].start, '17:30', 'Second period start should be 17:30');
  assertEquals(periods[1].end, '19:00', 'Second period end should be 19:00');
  assertEquals(periods[1].color, '#FF6B6B', 'Second period color should be #FF6B6B');
}

async function testGetBreakPeriodsFromStorage() {
  const customPeriods = [
    { name: '早休', start: '10:00', end: '10:30', color: '#ABCDEF' }
  ];

  const periods = window.getBreakPeriods();
  assertEquals(periods.length, 1, 'Should return 1 custom period');
  assertEquals(periods[0].name, '早休', 'Should return custom period name');
}

async function testSaveBreakPeriods() {
  assert(typeof window.saveBreakPeriods === 'function', 'saveBreakPeriods should be a function');

  const periods = [
    { name: '测试休息', start: '15:00', end: '15:30', color: '#123456' }
  ];

  window.saveBreakPeriods(periods);

  const saved = localStorage.getItem('time-tracker-config');
  assert(saved !== null, 'Config should be saved to localStorage');

  const parsed = JSON.parse(saved);
  assertArrayEquals(parsed, periods, 'Saved config should match input');
}

async function testCalculateOverlap() {
  assert(typeof window.calculateOverlap === 'function', 'calculateOverlap should be a function');

  // Create timestamps for a specific day
  const baseDate = new Date(2024, 0, 15); // Jan 15, 2024
  const dayStart = baseDate.getTime();

  // Work 09:00 - 12:00, break 11:30 - 13:30 → overlap 30 min = 1800000 ms
  const workStart = dayStart + 9 * 60 * 60 * 1000;
  const workEnd = dayStart + 12 * 60 * 60 * 1000;
  const overlap1 = window.calculateOverlap(workStart, workEnd, '11:30', '13:30');
  assertEquals(overlap1, 30 * 60 * 1000, 'Should calculate 30 min overlap');

  // Work 14:00 - 16:00, break 11:30 - 13:30 → no overlap
  const workStart2 = dayStart + 14 * 60 * 60 * 1000;
  const workEnd2 = dayStart + 16 * 60 * 60 * 1000;
  const overlap2 = window.calculateOverlap(workStart2, workEnd2, '11:30', '13:30');
  assertEquals(overlap2, 0, 'Should calculate 0 overlap when no intersection');

  // Work 11:00 - 14:00, break 11:30 - 13:30 → overlap 120 min
  const workStart3 = dayStart + 11 * 60 * 60 * 1000;
  const workEnd3 = dayStart + 14 * 60 * 60 * 1000;
  const overlap3 = window.calculateOverlap(workStart3, workEnd3, '11:30', '13:30');
  assertEquals(overlap3, 120 * 60 * 1000, 'Should calculate 120 min overlap');

  // Work completely inside break: 12:00 - 13:00, break 11:30 - 13:30 → overlap 60 min
  const workStart4 = dayStart + 12 * 60 * 60 * 1000;
  const workEnd4 = dayStart + 13 * 60 * 60 * 1000;
  const overlap4 = window.calculateOverlap(workStart4, workEnd4, '11:30', '13:30');
  assertEquals(overlap4, 60 * 60 * 1000, 'Should calculate 60 min overlap when work is inside break');
}

async function testCalculateEffectiveTime() {
  assert(typeof window.calculateEffectiveTime === 'function', 'calculateEffectiveTime should be a function');

  const baseDate = new Date(2024, 0, 15);
  const dayStart = baseDate.getTime();

  // Work 09:00 - 12:00 (3 hours), break 11:30 - 13:30 → effective = 2.5 hours
  const workStart = dayStart + 9 * 60 * 60 * 1000;
  const workEnd = dayStart + 12 * 60 * 60 * 1000;
  const effective1 = window.calculateEffectiveTime(workStart, workEnd);
  assertEquals(effective1, 2.5 * 60 * 60 * 1000, 'Should subtract 30 min break overlap');

  // Work 14:00 - 16:00 (2 hours), no break overlap → effective = 2 hours
  const workStart2 = dayStart + 14 * 60 * 60 * 1000;
  const workEnd2 = dayStart + 16 * 60 * 60 * 1000;
  const effective2 = window.calculateEffectiveTime(workStart2, workEnd2);
  assertEquals(effective2, 2 * 60 * 60 * 1000, 'Should not subtract when no overlap');

  // Work 09:00 - 18:00 (9 hours), breaks 11:30-13:30 (2h) and 17:30-19:00 (0.5h) → effective = 6.5 hours
  const workStart3 = dayStart + 9 * 60 * 60 * 1000;
  const workEnd3 = dayStart + 18 * 60 * 60 * 1000;
  const effective3 = window.calculateEffectiveTime(workStart3, workEnd3);
  assertEquals(effective3, 6.5 * 60 * 60 * 1000, 'Should subtract multiple break overlaps');
}

async function testSaveEntryIncludesEffectiveDuration() {
  const todayKey = window.getTodayStorageKey();

  const entry = {
    id: 'test-effective-id',
    taskName: '有效时长测试',
    startTime: new Date(2024, 0, 15, 9, 0).getTime(),
    endTime: new Date(2024, 0, 15, 12, 0).getTime(),
    rawDuration: 3 * 60 * 60 * 1000
  };

  window.saveEntry(entry);

  const raw = localStorage.getItem(todayKey);
  assert(raw !== null, 'Entry should be saved');

  const entries = JSON.parse(raw);
  assertEquals(entries.length, 1, 'Should have one entry');

  const savedEntry = entries[0];
  assert(typeof savedEntry.effectiveDuration === 'number', 'Entry should have effectiveDuration');
  assertEquals(savedEntry.effectiveDuration, 2.5 * 60 * 60 * 1000, 'effectiveDuration should subtract break overlap');
}

async function testRenderTodayEntriesShowsEffectiveDuration() {
  const todayKey = window.getTodayStorageKey();
  const entries = [
    {
      id: 'test-id-effective',
      taskName: '任务重叠',
      startTime: new Date(2024, 0, 15, 9, 0).getTime(),
      endTime: new Date(2024, 0, 15, 12, 0).getTime(),
      rawDuration: 3 * 60 * 60 * 1000,
      effectiveDuration: 2.5 * 60 * 60 * 1000
    }
  ];

  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assertEquals(rows.length, 1, 'Should render one row');

  const cells = rows[0].querySelectorAll('td');
  assertEquals(cells[3].textContent, '3小时0分钟（有效：2小时30分钟）', 'Duration cell should show raw and effective');
}

async function testRenderTodayEntriesColorBorder() {
  const todayKey = window.getTodayStorageKey();
  const entries = [
    {
      id: 'test-id-color',
      taskName: '重叠任务',
      startTime: new Date(2024, 0, 15, 9, 0).getTime(),
      endTime: new Date(2024, 0, 15, 12, 0).getTime(),
      rawDuration: 3 * 60 * 60 * 1000,
      effectiveDuration: 2.5 * 60 * 60 * 1000,
      breakColor: '#FFD93D'
    }
  ];

  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assertEquals(rows.length, 1, 'Should render one row');

  const row = rows[0];
  const borderLeft = row.style.borderLeft;
  const hasColor = borderLeft.includes('#FFD93D') || borderLeft.includes('rgb(255, 217, 61)');
  assert(hasColor, 'Row should have colored left border, got: ' + borderLeft);
}

async function testRenderTodayEntriesNoColorWhenNoOverlap() {
  const todayKey = window.getTodayStorageKey();
  const entries = [
    {
      id: 'test-id-nocolor',
      taskName: '不重叠任务',
      startTime: new Date(2024, 0, 15, 14, 0).getTime(),
      endTime: new Date(2024, 0, 15, 16, 0).getTime(),
      rawDuration: 2 * 60 * 60 * 1000,
      effectiveDuration: 2 * 60 * 60 * 1000
    }
  ];

  const tbody = document.getElementById('records-tbody');
  const rows = tbody.querySelectorAll('tr');
  assertEquals(rows.length, 1, 'Should render one row');

  const row = rows[0];
  assertEquals(row.style.borderLeft, '', 'Row should not have colored left border when no overlap');
}

async function testBreakPeriodEditButtonExists() {
  const breakItems = document.querySelectorAll('.break-setting-item');
  assertEquals(breakItems.length, 2, 'Should have 2 break setting items');

  breakItems.forEach((item, index) => {
    const editBtn = item.querySelector('.btn-edit');
    assert(editBtn !== null, `Break item ${index} should have edit button`);
    assertEquals(editBtn.textContent, '编辑', `Edit button should say 编辑`);
  });
}

async function testBreakPeriodEditMode() {
  const breakItems = document.querySelectorAll('.break-setting-item');
  const firstItem = breakItems[0];
  const editBtn = firstItem.querySelector('.btn-edit');

  editBtn.click();

  const nameInput = firstItem.querySelector('.break-name-input');
  assert(nameInput !== null, 'Should show name input in edit mode');
  assertEquals(nameInput.value, '午休', 'Name input should have current value');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running Break Time Tests...\n');

  await runTest('Get Break Periods - returns defaults when no config', testGetBreakPeriodsDefault);
  await runTest('Get Break Periods - returns saved config from localStorage', testGetBreakPeriodsFromStorage, {
    localStorage: {
      'time-tracker-config': JSON.stringify([
        { name: '早休', start: '10:00', end: '10:30', color: '#ABCDEF' }
      ])
    }
  });
  await runTest('Save Break Periods - saves to localStorage', testSaveBreakPeriods);
  await runTest('Calculate Overlap - computes correct overlap', testCalculateOverlap);
  await runTest('Calculate Effective Time - subtracts break overlaps', testCalculateEffectiveTime);
  await runTest('Save Entry - includes effectiveDuration', testSaveEntryIncludesEffectiveDuration);
  await runTest('Render Today Entries - shows effective duration', testRenderTodayEntriesShowsEffectiveDuration, {
    localStorage: {
      [(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `time-tracker-${year}-${month}-${day}`;
      })()]: [
        {
          id: 'test-id-effective',
          taskName: '任务重叠',
          startTime: new Date(2024, 0, 15, 9, 0).getTime(),
          endTime: new Date(2024, 0, 15, 12, 0).getTime(),
          rawDuration: 3 * 60 * 60 * 1000,
          effectiveDuration: 2.5 * 60 * 60 * 1000
        }
      ]
    }
  });
  await runTest('Render Today Entries - adds color border for overlap', testRenderTodayEntriesColorBorder, {
    localStorage: {
      [(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `time-tracker-${year}-${month}-${day}`;
      })()]: [
        {
          id: 'test-id-color',
          taskName: '重叠任务',
          startTime: new Date(2024, 0, 15, 9, 0).getTime(),
          endTime: new Date(2024, 0, 15, 12, 0).getTime(),
          rawDuration: 3 * 60 * 60 * 1000,
          effectiveDuration: 2.5 * 60 * 60 * 1000,
          breakColor: '#FFD93D'
        }
      ]
    }
  });
  await runTest('Render Today Entries - no color border when no overlap', testRenderTodayEntriesNoColorWhenNoOverlap, {
    localStorage: {
      [(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `time-tracker-${year}-${month}-${day}`;
      })()]: [
        {
          id: 'test-id-nocolor',
          taskName: '不重叠任务',
          startTime: new Date(2024, 0, 15, 14, 0).getTime(),
          endTime: new Date(2024, 0, 15, 16, 0).getTime(),
          rawDuration: 2 * 60 * 60 * 1000,
          effectiveDuration: 2 * 60 * 60 * 1000
        }
      ]
    }
  });
  await runTest('Break Period Edit Button - exists for each period', testBreakPeriodEditButtonExists);
  await runTest('Break Period Edit Mode - shows inputs when clicked', testBreakPeriodEditMode);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
