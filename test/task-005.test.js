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

  // Pre-populate localStorage with tasks if provided
  if (options.tasks) {
    const todayKey = window.todayKey ? window.todayKey() : 'time-tracker-tasks-' + new Date().toISOString().split('T')[0];
    localStorage.setItem(todayKey, JSON.stringify(options.tasks));
  }

  // Wait for DOMContentLoaded
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
// Tests for TASK-005: Task Deletion with Confirmation Dialog
// ========================================

// AC1: Task card shows "more" menu button in top-right corner
async function testMoreMenuButtonExists() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  
  const html = window.buildTaskCardHTML(testTask);
  assertIncludes(html, 'task-more-menu-btn', 'Card should contain more menu button');
  assertIncludes(html, '⋮', 'More button should show three-dot icon');
}

// AC2: Menu contains "Delete Task" option
async function testMenuContainsDeleteOption() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  
  const html = window.buildTaskCardHTML(testTask);
  assertIncludes(html, 'task-more-menu', 'Card should contain more menu container');
  assertIncludes(html, '删除任务', 'Menu should contain "Delete Task" option');
  assertIncludes(html, 'bp5-intent-danger', 'Delete option should use danger intent');
}

// AC3: Clicking delete shows confirmation dialog with correct message
async function testDeleteConfirmationDialog() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  testTask.id = 'test-delete-task-id';
  
  // Render the card
  window.todayTasks = [testTask];
  window.renderTaskCard(testTask);
  
  // Check that dialog functions exist
  assert(typeof window.showDeleteConfirmDialog === 'function', 'showDeleteConfirmDialog should be a function');
  assert(typeof window.closeDeleteConfirmDialog === 'function', 'closeDeleteConfirmDialog should be a function');
  
  // Show dialog
  window.showDeleteConfirmDialog(testTask);
  
  // Check dialog is in DOM
  const overlay = document.querySelector('.delete-dialog-overlay');
  assert(overlay !== null, 'Dialog overlay should exist in DOM');
  
  const dialog = document.querySelector('.delete-dialog');
  assert(dialog !== null, 'Dialog should exist in DOM');
  
  // Check title
  assertIncludes(dialog.textContent, '确认删除', 'Dialog should show confirmation title');
  
  // Check message contains task name
  assertIncludes(dialog.textContent, '测试删除任务', 'Dialog should show task name');
  assertIncludes(dialog.textContent, '此操作不可恢复', 'Dialog should show warning message');
  
  // Check buttons
  const cancelBtn = dialog.querySelector('[data-delete-dialog-action="cancel"]');
  const confirmBtn = dialog.querySelector('[data-delete-dialog-action="confirm"]');
  assert(cancelBtn !== null, 'Dialog should have cancel button');
  assert(confirmBtn !== null, 'Dialog should have confirm button');
  
  // Clean up
  window.closeDeleteConfirmDialog();
}

// AC4: Confirming deletion removes task from UI and localStorage
async function testConfirmDeletionRemovesTask() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  testTask.id = 'test-delete-task-id-2';
  
  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  
  // Render card
  window.renderTaskCard(testTask);
  
  // Verify card exists
  let card = document.getElementById('task-card-test-delete-task-id-2');
  assert(card !== null, 'Task card should exist before deletion');
  
  // Verify task in localStorage
  const tasksBefore = JSON.parse(localStorage.getItem(window.todayKey()));
  assertEquals(tasksBefore.length, 1, 'Should have 1 task in localStorage before deletion');
  
  // Re-set todayTasks to ensure it's correct (initDashboard may have overwritten it)
  window.todayTasks = [testTask];
  
  // Directly call deleteTask to verify core deletion logic
  window.deleteTask(testTask.id);
  
  // Verify card removed from DOM
  card = document.getElementById('task-card-test-delete-task-id-2');
  assert(card === null, 'Task card should be removed from DOM after deletion');
  
  // Verify task removed from localStorage
  const tasksAfter = JSON.parse(localStorage.getItem(window.todayKey()));
  assertEquals(tasksAfter.length, 0, 'Should have 0 tasks in localStorage after deletion');
}

// AC5: Canceling dialog closes it without removing task
async function testCancelDialogPreservesTask() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  testTask.id = 'test-delete-task-id-3';
  
  window.todayTasks = [testTask];
  window.saveTodayTasks(window.todayTasks);
  
  // Render card
  window.renderTaskCard(testTask);
  
  // Show dialog and cancel
  window.showDeleteConfirmDialog(testTask);
  const cancelBtn = document.querySelector('[data-delete-dialog-action="cancel"]');
  assert(cancelBtn !== null, 'Cancel button should exist');
  cancelBtn.click();
  
  // Verify card still exists
  const card = document.getElementById('task-card-test-delete-task-id-3');
  assert(card !== null, 'Task card should still exist after cancel');
  
  // Verify task still in localStorage
  const tasksAfter = JSON.parse(localStorage.getItem(window.todayKey()));
  assertEquals(tasksAfter.length, 1, 'Should still have 1 task in localStorage after cancel');
  assertEquals(tasksAfter[0].id, testTask.id, 'Task ID should match after cancel');
  
  // Verify dialog closed
  const overlay = document.querySelector('.delete-dialog-overlay');
  assert(overlay === null, 'Dialog overlay should be removed after cancel');
}

// Test: Delete function exists
async function testDeleteTaskFunctionExists() {
  assert(typeof window.deleteTask === 'function', 'deleteTask should be a function');
}

// Test: Clicking outside menu closes it
async function testClickOutsideClosesMenu() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  testTask.id = 'test-delete-task-id-4';
  
  window.todayTasks = [testTask];
  window.renderTaskCard(testTask);
  
  // Open menu
  const moreBtn = document.querySelector(`#task-card-test-delete-task-id-4 .task-more-menu-btn`);
  assert(moreBtn !== null, 'More button should exist');
  moreBtn.click();
  
  // Verify menu is visible
  let menu = document.querySelector(`#task-card-test-delete-task-id-4 .task-more-menu`);
  assert(menu !== null, 'Menu should exist');
  assert(menu.classList.contains('visible'), 'Menu should be visible after click');
  
  // Simulate click outside
  document.body.click();
  
  // Menu should be hidden
  menu = document.querySelector(`#task-card-test-delete-task-id-4 .task-more-menu`);
  if (menu) {
    assert(!menu.classList.contains('visible'), 'Menu should be hidden after clicking outside');
  }
}

// Test: Dialog uses Blueprint Card style
async function testDialogBlueprintStyle() {
  const testTask = window.createTask('测试删除任务');
  testTask.status = 'idle';
  
  window.showDeleteConfirmDialog(testTask);
  
  const dialog = document.querySelector('.delete-dialog');
  assert(dialog !== null, 'Dialog should exist');
  assertIncludes(dialog.className, 'bp5-card', 'Dialog should use bp5-card class');
  
  window.closeDeleteConfirmDialog();
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('=== TASK-005: Task Deletion with Confirmation Dialog Tests ===\n');

  await runTest('AC1: More menu button exists on task card', testMoreMenuButtonExists);
  await runTest('AC2: Menu contains delete task option', testMenuContainsDeleteOption);
  await runTest('AC3: Delete confirmation dialog shows correct message', testDeleteConfirmationDialog);
  await runTest('AC4: Confirming deletion removes task from UI and localStorage', testConfirmDeletionRemovesTask);
  await runTest('AC5: Canceling dialog preserves task', testCancelDialogPreservesTask);
  await runTest('Delete task function exists', testDeleteTaskFunctionExists);
  await runTest('Click outside closes menu', testClickOutsideClosesMenu);
  await runTest('Dialog uses Blueprint Card style', testDialogBlueprintStyle);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
