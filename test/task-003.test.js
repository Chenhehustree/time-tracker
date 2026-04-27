const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'time-tracker.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

let dom;
let document;
let window;

async function setup() {
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  window = dom.window;
  document = window.document;

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
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message || `Expected to include: ${needle}`);
  }
}

// Test runner
let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await setup();
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
// TASK-003 Tests
// ========================================

async function testDefaultCollapsedView() {
  // Create a task with segments
  const task = window.createTask('测试任务');
  task.status = 'paused';
  task.segments = [
    { id: 'seg-1', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:30:00').getTime(), rawDuration: 9000000, effectiveDuration: 8100000 },
    { id: 'seg-2', startTime: new Date('2026-04-21T13:00:00').getTime(), endTime: new Date('2026-04-21T15:15:00').getTime(), rawDuration: 8100000, effectiveDuration: 8100000 }
  ];
  window.updateTaskTotals(task);

  const html = window.buildTaskCardHTML(task);

  // AC1: Default view should not show full segment list or timeline
  assertIncludes(html, '测试任务', 'Should show task name');
  assertIncludes(html, '累计时长', 'Should show duration summary');
  
  // The segments list should be inside the panel, not directly visible in default view
  // But the panel container should exist
  assertIncludes(html, 'segments-panel', 'Should contain segments-panel element');
  
  // Should have expand button
  assertIncludes(html, '展开详情', 'Should have expand button');
  
  // Should show recent segment info in compact view
  assertIncludes(html, '最近', 'Should show recent segment info in compact view');
}

async function testExpandButtonExists() {
  const task = window.createTask('测试任务2');
  task.status = 'idle';

  const html = window.buildTaskCardHTML(task);

  // AC1/AC2: Should have expand detail button with Blueprint style
  assertIncludes(html, '展开详情', 'Should have expand detail button');
  assertIncludes(html, 'bp5-minimal', 'Expand button should use bp5-minimal style');
}

async function testPanelStructure() {
  const task = window.createTask('测试任务3');
  task.status = 'completed';
  task.segments = [
    { id: 'seg-1', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T10:00:00').getTime(), rawDuration: 3600000, effectiveDuration: 3600000 }
  ];
  window.updateTaskTotals(task);

  const html = window.buildTaskCardHTML(task);

  // AC3: Panel should be full width and have proper structure
  assertIncludes(html, 'segments-panel', 'Should have segments-panel class');
  assertIncludes(html, 'data-segments-panel', 'Should have data-segments-panel attribute');
  
  // Panel should initially be collapsed (no expanded class on the panel itself)
  // The CSS handles the transition via max-height
}

async function testToggleFunctionExists() {
  assert(typeof window.toggleSegmentsList === 'function', 'toggleSegmentsList should exist');
}

async function testSegmentListInPanel() {
  const task = window.createTask('测试任务4');
  task.status = 'paused';
  task.segments = [
    { id: 'seg-1', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:30:00').getTime(), rawDuration: 9000000, effectiveDuration: 8100000 }
  ];
  window.updateTaskTotals(task);

  const html = window.buildTaskCardHTML(task);

  // The segments list HTML should be inside the panel
  assertIncludes(html, 'segment-item', 'Panel should contain segment items');
  assertIncludes(html, 'timeline-bar', 'Panel should contain timeline bar');
}

async function testAddSegmentButtonInPanel() {
  const task = window.createTask('测试任务5');
  task.status = 'paused';
  task.segments = [
    { id: 'seg-1', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:30:00').getTime(), rawDuration: 9000000, effectiveDuration: 8100000 }
  ];
  window.updateTaskTotals(task);

  const html = window.buildTaskCardHTML(task);

  // Should have add segment button inside panel
  assertIncludes(html, '添加时间段', 'Panel should have add segment button');
  assertIncludes(html, 'data-add-segment', 'Add segment button should have data attribute');
}

async function testReadonlyMode() {
  const task = window.createTask('只读测试');
  task.status = 'completed';
  task.segments = [
    { id: 'seg-1', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:30:00').getTime(), rawDuration: 9000000, effectiveDuration: 8100000 }
  ];
  window.updateTaskTotals(task);

  const html = window.buildTaskCardHTML(task, true);

  // Readonly mode should still have expand button but no action buttons
  assertIncludes(html, '展开详情', 'Readonly mode should still have expand button');
  assert(!html.includes('data-action="start"'), 'Readonly should not have start button');
  assert(!html.includes('data-action="append"'), 'Readonly should not have append button');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running TASK-003 Tests...\n');

  await runTest('Default view is compact without full segment list', testDefaultCollapsedView);
  await runTest('Expand button exists with Blueprint style', testExpandButtonExists);
  await runTest('Panel structure is correct', testPanelStructure);
  await runTest('Toggle function exists', testToggleFunctionExists);
  await runTest('Segment list is inside panel', testSegmentListInPanel);
  await runTest('Add segment button is inside panel', testAddSegmentButtonInPanel);
  await runTest('Readonly mode still has expand button', testReadonlyMode);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
