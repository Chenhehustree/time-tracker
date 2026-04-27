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

  // For state recovery tests, set localStorage before DOMContentLoaded triggers
  if (options.timerState) {
    localStorage.setItem('timerState', JSON.stringify(options.timerState));
  }

  // Wait for DOMContentLoaded to ensure scripts have initialized
  await new Promise(resolve => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve);
      // Also set a timeout as fallback
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
// Tests
// ========================================

async function testStartTimer() {
  const taskInput = document.getElementById('task-name-input');
  const startBtn = document.getElementById('start-stop-btn');
  const timerDisplay = document.getElementById('timer-display');

  taskInput.value = '测试任务';
  startBtn.click();

  // Check button text changed
  assertEquals(startBtn.textContent, '停止计时', 'Button text should change to "停止计时"');

  // Check button style changed to danger
  assert(startBtn.classList.contains('btn-danger'), 'Button should have btn-danger class');
  assert(!startBtn.classList.contains('btn-primary'), 'Button should not have btn-primary class');

  // Check timer display is in HH:MM format
  const displayText = timerDisplay.textContent;
  assert(/^\d{2}:\d{2}$/.test(displayText), `Timer display should be in HH:MM format, got: ${displayText}`);

  // Check localStorage
  const savedState = JSON.parse(localStorage.getItem('timerState'));
  assert(savedState !== null, 'timerState should be saved in localStorage');
  assertEquals(savedState.currentTask, '测试任务', 'Saved task name should match');
  assertEquals(savedState.isRunning, true, 'Saved isRunning should be true');
  assert(typeof savedState.startTime === 'number', 'Saved startTime should be a number');
}

async function testStopTimer() {
  const taskInput = document.getElementById('task-name-input');
  const startBtn = document.getElementById('start-stop-btn');
  const timerDisplay = document.getElementById('timer-display');

  taskInput.value = '测试任务';
  startBtn.click(); // Start
  await sleep(1100);

  const displayBeforeStop = timerDisplay.textContent;
  startBtn.click(); // Stop

  // Check button text restored
  assertEquals(startBtn.textContent, '开始计时', 'Button text should restore to "开始计时"');

  // Check button style restored
  assert(startBtn.classList.contains('btn-primary'), 'Button should have btn-primary class');
  assert(!startBtn.classList.contains('btn-danger'), 'Button should not have btn-danger class');

  // Check localStorage cleared
  assertEquals(localStorage.getItem('timerState'), null, 'timerState should be cleared from localStorage');

  // Wait and check timer stopped updating
  await sleep(1100);
  assertEquals(timerDisplay.textContent, displayBeforeStop, 'Timer should stop updating');
}

async function testStateRecovery() {
  const startBtn = document.getElementById('start-stop-btn');
  const timerDisplay = document.getElementById('timer-display');

  // Check button is in running state
  assertEquals(startBtn.textContent, '停止计时', 'Button should show "停止计时" after recovery');
  assert(startBtn.classList.contains('btn-danger'), 'Button should have btn-danger class after recovery');

  // Check timer display includes elapsed time before refresh
  // Note: HH:MM format, 5 seconds = 00:00, so we don't check !== '00:00' here
  await sleep(500);
  const displayText = timerDisplay.textContent;
  assert(/^\d{2}:\d{2}$/.test(displayText), `Timer display should be in HH:MM format, got: ${displayText}`);
}

async function testStateRecoveryWithMinutes() {
  const timerDisplay = document.getElementById('timer-display');
  await sleep(500);

  const displayText = timerDisplay.textContent;
  assert(displayText !== '00:00', 'Timer display should show 02:00 or more after recovery');
  assert(/^\d{2}:\d{2}$/.test(displayText), `Timer display should be in HH:MM format, got: ${displayText}`);
}

async function testStateRecoveryWithMinutes() {
  // Simulate an existing timer state with 2 minutes elapsed
  const pastTime = Date.now() - 120000; // Started 2 minutes ago
  localStorage.setItem('timerState', JSON.stringify({
    currentTask: '恢复任务',
    startTime: pastTime,
    isRunning: true
  }));

  // Re-trigger DOMContentLoaded
  const event = new window.Event('DOMContentLoaded');
  document.dispatchEvent(event);

  const timerDisplay = document.getElementById('timer-display');
  await sleep(500);

  const displayText = timerDisplay.textContent;
  assert(displayText !== '00:00', 'Timer display should show 02:00 or more after recovery');
  assert(/^\d{2}:\d{2}$/.test(displayText), `Timer display should be in HH:MM format, got: ${displayText}`);
}

async function testEmptyTaskName() {
  const taskInput = document.getElementById('task-name-input');
  const startBtn = document.getElementById('start-stop-btn');

  taskInput.value = '';
  
  // Mock alert to capture the message
  let alertMessage = null;
  window.alert = function(msg) {
    alertMessage = msg;
  };

  startBtn.click();

  assertEquals(alertMessage, '请输入任务名称', 'Should alert when task name is empty');
  assertEquals(startBtn.textContent, '开始计时', 'Button should not change when task name is empty');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running Timer Core Tests...\n');

  await runTest('Start Timer - updates UI and saves state', testStartTimer);
  await runTest('Stop Timer - restores UI and clears state', testStopTimer);
  await runTest('State Recovery - restores running state on load', testStateRecovery, {
    timerState: {
      currentTask: '恢复任务',
      startTime: Date.now() - 5000, // Started 5 seconds ago
      isRunning: true
    }
  });
  await runTest('State Recovery - includes pre-refresh elapsed time', testStateRecoveryWithMinutes, {
    timerState: {
      currentTask: '恢复任务',
      startTime: Date.now() - 120000, // Started 2 minutes ago
      isRunning: true
    }
  });
  await runTest('Empty Task Name - shows alert', testEmptyTaskName);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
