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

  if (options.tasks) {
    const todayKey = window.todayKey ? window.todayKey() : 'time-tracker-tasks-' + new Date().toISOString().split('T')[0];
    localStorage.setItem(todayKey, JSON.stringify(options.tasks));
  }

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
// Tests for TASK-006: Task Name Edit Functionality
// ========================================

// AC1: Clicking task name transforms it to an editable input with original text
async function testClickTaskNameBecomesInput() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-1';

  window.todayTasks = [testTask];
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  assert(taskNameEl !== null, 'Task name element should exist');

  // Click to enter edit mode
  taskNameEl.click();

  // The h3 should be replaced by an input
  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  assert(input !== null, 'Input should appear after clicking task name');
  assertEquals(input.value, '原始任务名称', 'Input should contain original task name');
  assert(input.classList.contains('bp5-input'), 'Input should have bp5-input class');
}

// AC2: Blur saves new name and updates localStorage
async function testBlurSavesNewName() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-2';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '修改后的任务名称';
  input.blur();

  // Check task object updated
  assertEquals(testTask.taskName, '修改后的任务名称', 'Task object should have new name');

  // Check localStorage updated
  const savedTasks = JSON.parse(localStorage.getItem(window.todayKey()));
  assertEquals(savedTasks[0].taskName, '修改后的任务名称', 'localStorage should have new name');

  // Check DOM updated
  const updatedNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  assert(updatedNameEl !== null, 'Task name element should exist after save');
  assertIncludes(updatedNameEl.textContent, '修改后的任务名称', 'DOM should show new name');
}

// AC2: Enter key saves new name
async function testEnterSavesNewName() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-3';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '回车保存的名称';

  const event = new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' });
  input.dispatchEvent(event);

  assertEquals(testTask.taskName, '回车保存的名称', 'Task object should have new name after Enter');
}

// AC3: Escape cancels editing and restores original title
async function testEscapeCancelsEdit() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-4';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '未保存的修改';

  const event = new window.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
  input.dispatchEvent(event);

  // Check task object NOT updated
  assertEquals(testTask.taskName, '原始任务名称', 'Task object should still have original name');

  // Check DOM shows original name
  const restoredNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  assert(restoredNameEl !== null, 'Task name element should exist after cancel');
  assertIncludes(restoredNameEl.textContent, '原始任务名称', 'DOM should show original name');
}

// AC4: Empty name shows red border and prevents save
async function testEmptyNameShowsError() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-5';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '';
  input.blur();

  // Task name should NOT be saved
  assertEquals(testTask.taskName, '原始任务名称', 'Task object should still have original name');

  // Input should have intent-danger class
  assert(input.classList.contains('bp5-intent-danger'), 'Input should have bp5-intent-danger class');

  // Error hint should be visible
  const errorEl = document.querySelector(`#task-card-${testTask.id} .task-name-error`);
  assert(errorEl !== null, 'Error hint element should exist');
  assertIncludes(errorEl.textContent, '请输入任务名称', 'Error hint should show required message');
}

// AC4: Empty name on Enter also prevents save
async function testEmptyNameEnterPreventsSave() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-6';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '   ';

  const event = new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' });
  input.dispatchEvent(event);

  // Task name should NOT be saved
  assertEquals(testTask.taskName, '原始任务名称', 'Task object should still have original name');
  assert(input.classList.contains('bp5-intent-danger'), 'Input should have bp5-intent-danger class');
}

// Test: Same name doesn't trigger save
async function testSameNameDoesNotTriggerSave() {
  const testTask = window.createTask('原始任务名称');
  testTask.status = 'idle';
  testTask.id = 'test-edit-task-id-7';

  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  window.renderTaskCard(testTask);

  const taskNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  taskNameEl.click();

  const input = document.querySelector(`#task-card-${testTask.id} .task-name-input`);
  input.value = '原始任务名称';
  input.blur();

  // Should still be fine, just reverted to h3
  const restoredNameEl = document.querySelector(`[data-task-name="${testTask.id}"]`);
  assert(restoredNameEl !== null, 'Task name element should exist');
  assertIncludes(restoredNameEl.textContent, '原始任务名称', 'DOM should show original name');
}

// Test: Task name has cursor pointer to indicate editability
async function testTaskNameHasPointerCursor() {
  const testTask = window.createTask('可编辑任务');
  testTask.status = 'idle';

  const html = window.buildTaskCardHTML(testTask);
  assertIncludes(html, 'data-task-name', 'Task name should have data-task-name attribute');
}

// Test: Functions exist
async function testEditFunctionsExist() {
  assert(typeof window.enableTaskNameEdit === 'function', 'enableTaskNameEdit should be a function');
  assert(typeof window.saveTaskName === 'function', 'saveTaskName should be a function');
  assert(typeof window.cancelTaskNameEdit === 'function', 'cancelTaskNameEdit should be a function');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('=== TASK-006: Task Name Edit Functionality Tests ===\n');

  await runTest('AC1: Clicking task name becomes editable input', testClickTaskNameBecomesInput);
  await runTest('AC2: Blur saves new name and updates localStorage', testBlurSavesNewName);
  await runTest('AC2: Enter key saves new name', testEnterSavesNewName);
  await runTest('AC3: Escape cancels editing and restores original', testEscapeCancelsEdit);
  await runTest('AC4: Empty name shows error and prevents save (blur)', testEmptyNameShowsError);
  await runTest('AC4: Empty name prevents save (Enter)', testEmptyNameEnterPreventsSave);
  await runTest('Same name does not trigger unnecessary save', testSameNameDoesNotTriggerSave);
  await runTest('Task name element has edit attribute', testTaskNameHasPointerCursor);
  await runTest('Edit functions exist', testEditFunctionsExist);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
