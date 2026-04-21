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
// Helper to get today's date string YYYY-MM-DD
// ========================================
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `time-tracker-${year}-${month}-${day}`;
}

// ========================================
// Tests - Export Data
// ========================================

async function testExportDataFunctionExists() {
  assert(typeof window.exportData === 'function', 'exportData should be a function');
}

async function testExportDataCreatesCorrectStructure() {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Set up some data
  localStorage.setItem(todayKey, JSON.stringify([
    { id: '1', taskName: '任务1', startTime: 123, endTime: 456, rawDuration: 333 }
  ]));
  localStorage.setItem(yesterdayKey, JSON.stringify([
    { id: '2', taskName: '任务2', startTime: 789, endTime: 1000, rawDuration: 211 }
  ]));
  localStorage.setItem('time-tracker-config', JSON.stringify([
    { name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }
  ]));

  window.exportData();

  const mocks = window.__testMocks;
  const blob = mocks.getLastBlob();
  assert(blob !== null, 'exportData should create a Blob');

  const jsonStr = blob.parts[0];
  const data = JSON.parse(jsonStr);

  assertEquals(data.version, '1.0', 'export data should have version 1.0');
  assert(typeof data.exportDate === 'string', 'export data should have exportDate string');
  assert(data.exportDate.includes('T'), 'exportDate should be ISO format');
  assertDeepEquals(data.records[todayKey.replace('time-tracker-', '')], [
    { id: '1', taskName: '任务1', startTime: 123, endTime: 456, rawDuration: 333 }
  ], 'records should contain today\'s data');
  assertDeepEquals(data.records[yesterdayKey.replace('time-tracker-', '')], [
    { id: '2', taskName: '任务2', startTime: 789, endTime: 1000, rawDuration: 211 }
  ], 'records should contain yesterday\'s data');
  assertDeepEquals(data.config, [
    { name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }
  ], 'config should contain break periods');
}

async function testExportDataTriggersDownload() {
  window.exportData();

  const mocks = window.__testMocks;
  const anchor = mocks.getLastAnchor();
  assert(anchor !== null, 'exportData should create an anchor element');
  assertIncludes(anchor.download, 'time-tracker-backup-', 'download filename should start with time-tracker-backup-');
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
// Tests - Import Data
// ========================================

async function testImportDataFunctionExists() {
  assert(typeof window.importData === 'function', 'importData should be a function');
}

async function testImportDataValidFile() {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  // Set up existing data to be overwritten
  localStorage.setItem('other-key', 'should-not-be-deleted');
  localStorage.setItem(todayKey, JSON.stringify([{ id: 'old', taskName: '旧任务' }]));

  const importData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    records: {
      '2026-04-20': [{ id: 'new1', taskName: '新任务1', startTime: 100, endTime: 200, rawDuration: 100 }]
    },
    config: [{ name: '新午休', start: '12:00', end: '13:00', color: '#FF0000' }]
  };

  // Create mock file
  const mockFile = {
    _content: JSON.stringify(importData),
    name: 'test-backup.json',
    type: 'application/json'
  };

  await window.importData(mockFile);
  await sleep(100);

  // Should clear time-tracker-* data and write imported data
  assertEquals(localStorage.getItem(todayKey), null, 'old today data should be cleared');
  assertEquals(localStorage.getItem('other-key'), 'should-not-be-deleted', 'non time-tracker keys should not be deleted');

  const importedRecords = JSON.parse(localStorage.getItem('time-tracker-2026-04-20'));
  assertDeepEquals(importedRecords, importData.records['2026-04-20'], 'imported records should be saved');

  const importedConfig = JSON.parse(localStorage.getItem('time-tracker-config'));
  assertDeepEquals(importedConfig, importData.config, 'imported config should be saved');
}

async function testImportDataShowsConfirm() {
  const importData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    records: {},
    config: []
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
    version: '1.0',
    exportDate: new Date().toISOString(),
    records: {},
    config: []
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
    version: '1.0',
    // missing records and config
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

async function testImportFileChangeEvent() {
  const importFile = document.getElementById('import-file');
  assert(importFile !== null, 'import file input should exist');

  const importData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    records: {},
    config: []
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
  console.log('Running Export/Import Tests...\n');

  await runTest('Export Data - function exists', testExportDataFunctionExists);
  await runTest('Export Data - creates correct structure', testExportDataCreatesCorrectStructure, {
    entries: {
      [getTodayKey()]: [{ id: '1', taskName: '任务1', startTime: 123, endTime: 456, rawDuration: 333 }],
      [getYesterdayKey()]: [{ id: '2', taskName: '任务2', startTime: 789, endTime: 1000, rawDuration: 211 }]
    },
    config: [{ name: '午休', start: '11:30', end: '13:30', color: '#FFD93D' }]
  });
  await runTest('Export Data - triggers download', testExportDataTriggersDownload);
  await runTest('Export Data - button click triggers export', testExportButtonClickTriggersExport);
  await runTest('Import Data - function exists', testImportDataFunctionExists);
  await runTest('Import Data - valid file imports correctly', testImportDataValidFile, { confirmResult: true });
  await runTest('Import Data - shows confirm dialog', testImportDataShowsConfirm, { confirmResult: true });
  await runTest('Import Data - cancel does not clear data', testImportDataCancelDoesNotClear, { confirmResult: false });
  await runTest('Import Data - invalid format alerts', testImportDataInvalidFormat, { confirmResult: true });
  await runTest('Import Data - invalid JSON alerts', testImportDataInvalidJson, { confirmResult: true });
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
