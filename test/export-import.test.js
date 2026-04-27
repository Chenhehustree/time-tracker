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

  // Pre-populate config if provided
  if (options.config) {
    localStorage.setItem('time-tracker-config', JSON.stringify(options.config));
  }

  // Mock Blob and URL.createObjectURL for export tests
  let lastBlob = null;
  let lastBlobUrl = null;
  let downloadTriggered = false;

  window.Blob = class MockBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
      lastBlob = this;
    }
  };

  window.URL.createObjectURL = function(blob) {
    lastBlobUrl = 'blob:mock-url';
    return lastBlobUrl;
  };

  window.URL.revokeObjectURL = function() {};

  // Track created elements for download verification
  let lastAnchor = null;
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName) {
    const el = originalCreateElement(tagName);
    if (tagName.toLowerCase() === 'a') {
      lastAnchor = el;
    }
    return el;
  };

  // Store mocks on window for test access
  window.__testMocks = {
    getLastBlob: () => lastBlob,
    getLastBlobUrl: () => lastBlobUrl,
    getLastAnchor: () => lastAnchor,
    reset: () => {
      lastBlob = null;
      lastBlobUrl = null;
      lastAnchor = null;
    }
  };

  // Mock confirm for import tests
  window.confirm = function(message) {
    window.__testMocks.confirmMessage = message;
    return options.confirmResult !== undefined ? options.confirmResult : true;
  };

  // Mock alert for import tests
  window.alert = function(message) {
    window.__testMocks.alertMessage = message;
  };

  // Mock FileReader
  window.FileReader = class MockFileReader {
    readAsText(file) {
      this.file = file;
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: file._content || '' } });
        }
      }, 0);
    }
  };

  // Wait for DOMContentLoaded to ensure scripts have initialized
  await new Promise(resolve => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
      setTimeout(resolve, 300);
    }
  });

  // Wait for any async FileReader callbacks
  await new Promise(resolve => setTimeout(resolve, 50));
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

function assertDeepEquals(actual, expected, message) {
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
// Helper to get today's date string YYYY-MM-DD with correct prefix
// ========================================
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-tasks-${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-tasks-${year}-${month}-${day}`;
}

// ========================================
// Tests - Export Data V2
// ========================================

async function testExportDataFunctionExists() {
  assert(typeof window.exportData === 'function', 'exportData should be a function');
}

async function testExportDataCreatesCorrectV2Structure() {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Set up some V2 task data
  const todayTasks = [
    { id: '1', taskName: '任务1', status: 'completed', segments: [{ id: 's1', startTime: 123, endTime: 456, rawDuration: 333, effectiveDuration: 300 }], totalRawDuration: 333, totalEffectiveDuration: 300 }
  ];
  const yesterdayTasks = [
    { id: '2', taskName: '任务2', status: 'completed', segments: [{ id: 's2', startTime: 789, endTime: 1000, rawDuration: 211, effectiveDuration: 200 }], totalRawDuration: 211, totalEffectiveDuration: 200 }
  ];

  localStorage.setItem(todayKey, JSON.stringify(todayTasks));
  localStorage.setItem(yesterdayKey, JSON.stringify(yesterdayTasks));
  localStorage.setItem('time-tracker-config', JSON.stringify({ breakPeriods: [{ name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }] }));

  window.exportData();

  const mocks = window.__testMocks;
  const blob = mocks.getLastBlob();
  assert(blob !== null, 'exportData should create a Blob');

  const jsonStr = blob.parts[0];
  const data = JSON.parse(jsonStr);

  assertEquals(data.version, '2.0', 'export data should have version 2.0');
  assert(typeof data.exportDate === 'string', 'export data should have exportDate string');
  assert(data.exportDate.includes('T'), 'exportDate should be ISO format');
  assert(typeof data.tasks === 'object', 'export data should have tasks object');
  assertDeepEquals(data.tasks[todayKey.replace('time-tracker-tasks-', '')], todayTasks, 'tasks should contain today\'s data');
  assertDeepEquals(data.tasks[yesterdayKey.replace('time-tracker-tasks-', '')], yesterdayTasks, 'tasks should contain yesterday\'s data');
  assertDeepEquals(data.config, { breakPeriods: [{ name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }] }, 'config should contain break periods');
}

async function testExportDataTriggersDownload() {
  window.exportData();

  const mocks = window.__testMocks;
  const anchor = mocks.getLastAnchor();
  assert(anchor !== null, 'exportData should create an anchor element');
  assertIncludes(anchor.download, 'time-tracker-v2-backup-', 'download filename should start with time-tracker-v2-backup-');
  assertIncludes(anchor.download, '.json', 'download filename should end with .json');
  assertEquals(anchor.href, 'blob:mock-url', 'anchor href should be blob URL');
}

async function testExportButtonClickTriggersExport() {
  const exportBtn = document.getElementById('export-btn');
  assert(exportBtn !== null, 'export button should exist');

  // Reset mocks before clicking
  window.__testMocks.reset();

  exportBtn.click();

  const mocks = window.__testMocks;
  const blob = mocks.getLastBlob();
  assert(blob !== null, 'clicking export button should create a Blob');
}

// ========================================
// Tests - Import Data V2
// ========================================

async function testImportDataFunctionExists() {
  assert(typeof window.importData === 'function', 'importData should be a function');
}

async function testConvertV1ToV2FunctionExists() {
  assert(typeof window.convertV1ToV2 === 'function', 'convertV1ToV2 should be a function');
}

async function testConvertV1ToV2() {
  const v1Data = {
    version: '1.0',
    exportDate: '2026-04-21T10:00:00.000Z',
    records: {
      '2026-04-21': [
        { id: 'r1', taskName: '任务A', startTime: 1000, endTime: 5000, rawDuration: 4000, effectiveDuration: 3500 },
        { id: 'r2', taskName: '任务A', startTime: 6000, endTime: 10000, rawDuration: 4000, effectiveDuration: 3500 },
        { id: 'r3', taskName: '任务B', startTime: 1000, endTime: 3000, rawDuration: 2000, effectiveDuration: 2000 }
      ]
    },
    config: { breakPeriods: [{ name: '午休', start: '12:00', end: '13:00' }] }
  };

  const v2Data = window.convertV1ToV2(v1Data);

  assertEquals(v2Data.version, '2.0', 'converted data should have version 2.0');
  assert(typeof v2Data.tasks === 'object', 'converted data should have tasks');
  assert(v2Data.tasks['2026-04-21'].length === 2, 'should have 2 tasks (grouped by taskName)');

  // Find taskA and taskB
  const taskA = v2Data.tasks['2026-04-21'].find(t => t.taskName === '任务A');
  const taskB = v2Data.tasks['2026-04-21'].find(t => t.taskName === '任务B');

  assert(taskA !== undefined, 'taskA should exist');
  assert(taskB !== undefined, 'taskB should exist');
  assertEquals(taskA.status, 'completed', 'taskA status should be completed');
  assertEquals(taskA.segments.length, 2, 'taskA should have 2 segments');
  assertEquals(taskB.segments.length, 1, 'taskB should have 1 segment');

  // Check segment conversion
  assertEquals(taskA.segments[0].startTime, 1000, 'first segment startTime correct');
  assertEquals(taskA.segments[0].endTime, 5000, 'first segment endTime correct');
  assertEquals(taskA.segments[0].rawDuration, 4000, 'first segment rawDuration correct');
  assertEquals(taskA.segments[0].effectiveDuration, 3500, 'first segment effectiveDuration correct');

  assertDeepEquals(v2Data.config, v1Data.config, 'config should be preserved');
}

async function testImportDataValidV2File() {
  const todayKey = getTodayKey();

  // Set up existing data to be overwritten
  localStorage.setItem('other-key', 'should-not-be-deleted');
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  const importData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    tasks: {
      '2026-04-20': [{ id: 'new1', taskName: '新任务1', status: 'completed', segments: [], totalRawDuration: 0, totalEffectiveDuration: 0 }]
    },
    config: { breakPeriods: [{ name: '新午休', start: '12:00', end: '13:00', color: '#FF0000' }] }
  };

  // Create mock file
  const mockFile = {
    _content: JSON.stringify(importData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  // Should clear time-tracker-tasks-* data and write imported data
  assertEquals(localStorage.getItem(todayKey), null, 'old today data should be cleared');
  assertEquals(localStorage.getItem('other-key'), 'should-not-be-deleted', 'non time-tracker keys should not be deleted');

  const importedTasks = JSON.parse(localStorage.getItem('time-tracker-tasks-2026-04-20'));
  assertDeepEquals(importedTasks, importData.tasks['2026-04-20'], 'imported tasks should be saved');

  const importedConfig = JSON.parse(localStorage.getItem('time-tracker-config'));
  assertDeepEquals(importedConfig, importData.config, 'imported config should be saved');
}

async function testImportDataShowsConfirm() {
  const importData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    tasks: {},
    config: { breakPeriods: [] }
  };

  const mockFile = {
    _content: JSON.stringify(importData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  assertEquals(window.__testMocks.confirmMessage, '导入将覆盖现有数据，是否继续？', 'confirm should show correct message');
}

async function testImportDataCancelDoesNotClear() {
  const todayKey = getTodayKey();
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  const importData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    tasks: {},
    config: { breakPeriods: [] }
  };

  const mockFile = {
    _content: JSON.stringify(importData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  // User cancels
  const originalConfirm = window.confirm;
  window.confirm = () => false;

  await window.importData(mockFile);
  await sleep(100);

  window.confirm = originalConfirm;

  // Data should not be cleared
  const existing = localStorage.getItem(todayKey);
  assert(existing !== null, 'existing data should not be cleared when user cancels');
}

async function testImportDataInvalidFormat() {
  const todayKey = getTodayKey();
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  // Missing required fields
  const invalidData = {
    version: '2.0',
    // missing tasks and config
  };

  const mockFile = {
    _content: JSON.stringify(invalidData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  assertEquals(window.__testMocks.alertMessage, '文件格式不正确', 'should alert about invalid format');

  // Data should not be cleared
  const existing = localStorage.getItem(todayKey);
  assert(existing !== null, 'existing data should not be cleared when format is invalid');
}

async function testImportDataInvalidJson() {
  const todayKey = getTodayKey();
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  const mockFile = {
    _content: 'not valid json',
    name: 'test-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  assertEquals(window.__testMocks.alertMessage, '文件格式不正确', 'should alert about invalid JSON');

  // Data should not be cleared
  const existing = localStorage.getItem(todayKey);
  assert(existing !== null, 'existing data should not be cleared when JSON is invalid');
}

async function testImportV1DataShowsAlertAndConverts() {
  const todayKey = getTodayKey();
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  const v1Data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    records: {
      '2026-04-20': [
        { id: 'r1', taskName: '旧任务A', startTime: 1000, endTime: 5000, rawDuration: 4000, effectiveDuration: 3500 }
      ]
    },
    config: { breakPeriods: [{ name: '午休', start: '12:00', end: '13:00' }] }
  };

  const mockFile = {
    _content: JSON.stringify(v1Data),
    name: 'test-v1-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  assertEquals(window.__testMocks.alertMessage, '检测到 V1 格式数据，将尝试转换导入', 'should alert about V1 conversion');

  const importedTasks = JSON.parse(localStorage.getItem('time-tracker-tasks-2026-04-20'));
  assert(importedTasks !== null, 'V1 data should be converted and imported');
  assertEquals(importedTasks.length, 1, 'should have 1 task');
  assertEquals(importedTasks[0].taskName, '旧任务A', 'task name should be preserved');
  assertEquals(importedTasks[0].status, 'completed', 'status should be completed');
  assertEquals(importedTasks[0].segments.length, 1, 'should have 1 segment');
}

async function testImportFileChangeEvent() {
  const importFile = document.getElementById('import-file');
  assert(importFile !== null, 'import file input should exist');

  const importData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    tasks: {},
    config: { breakPeriods: [] }
  };

  // Simulate file selection
  const mockFile = {
    _content: JSON.stringify(importData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  // Set files property
  Object.defineProperty(importFile, 'files', {
    value: [mockFile],
    writable: false
  });

  // Trigger change event
  const event = new window.Event('change', { bubbles: true });
  importFile.dispatchEvent(event);

  await sleep(100);

  assertEquals(window.__testMocks.confirmMessage, '导入将覆盖现有数据，是否继续？', 'change event should trigger import');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running Export/Import V2 Tests...\n');

  await runTest('Export Data - function exists', testExportDataFunctionExists);
  await runTest('Export Data - creates correct V2 structure', testExportDataCreatesCorrectV2Structure, {
    entries: {
      [getTodayKey()]: [{ id: '1', taskName: '任务1', status: 'completed', segments: [{ id: 's1', startTime: 123, endTime: 456, rawDuration: 333, effectiveDuration: 300 }], totalRawDuration: 333, totalEffectiveDuration: 300 }],
      [getYesterdayKey()]: [{ id: '2', taskName: '任务2', status: 'completed', segments: [{ id: 's2', startTime: 789, endTime: 1000, rawDuration: 211, effectiveDuration: 200 }], totalRawDuration: 211, totalEffectiveDuration: 200 }]
    },
    config: { breakPeriods: [{ name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }] }
  });
  await runTest('Export Data - triggers download', testExportDataTriggersDownload);
  await runTest('Export Data - button click triggers export', testExportButtonClickTriggersExport);
  await runTest('Import Data - function exists', testImportDataFunctionExists);
  await runTest('Convert V1 to V2 - function exists', testConvertV1ToV2FunctionExists);
  await runTest('Convert V1 to V2 - conversion logic', testConvertV1ToV2);
  await runTest('Import Data - valid V2 file imports correctly', testImportDataValidV2File, { confirmResult: true });
  await runTest('Import Data - shows confirm dialog', testImportDataShowsConfirm, { confirmResult: true });
  await runTest('Import Data - cancel does not clear data', testImportDataCancelDoesNotClear, { confirmResult: false });
  await runTest('Import Data - invalid format alerts', testImportDataInvalidFormat, { confirmResult: true });
  await runTest('Import Data - invalid JSON alerts', testImportDataInvalidJson, { confirmResult: true });
  await runTest('Import Data - V1 format converts and imports', testImportV1DataShowsAlertAndConverts, { confirmResult: true });
  await runTest('Import Data - file change event triggers import', testImportFileChangeEvent, { confirmResult: true });

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
