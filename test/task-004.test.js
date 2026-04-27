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
// TASK-004 Tests: Timeline optimization in panel
// ========================================

async function testTimelineWidthOptimization() {
  // AC1: Timeline should have sufficient width styling
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  // Check that timeline-track or timeline-bar has min-width or width optimization
  assert(
    allStyles.includes('min-width: 700px') || allStyles.includes('width: calc(100%'),
    'Timeline should have width optimization (min-width: 700px or calc width)'
  );

  // Build a timeline and verify the HTML structure
  const task = window.createTask('宽度测试任务');
  task.status = 'completed';
  task.segments = [
    { id: 'seg-wide', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:30:00').getTime(), rawDuration: 9000000, effectiveDuration: 9000000 }
  ];
  window.updateTaskTotals(task);

  const timelineHTML = window.buildTimelineHTML(task.segments[0], task);
  assertIncludes(timelineHTML, 'timeline-bar', 'Timeline HTML should contain timeline-bar');
  assertIncludes(timelineHTML, 'timeline-track', 'Timeline HTML should contain timeline-track');
}

async function testShortSegmentVisibility() {
  // AC2: Short segments (< 30 min) should be visible with min-width
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  assertIncludes(allStyles, 'min-width: 20px', 'Segment fill should have min-width: 20px for short segments');

  // Test with a 15-minute segment
  const task = window.createTask('短时段测试');
  task.status = 'completed';
  const startTime = new Date('2026-04-21T09:00:00').getTime();
  const endTime = new Date('2026-04-21T09:15:00').getTime();
  task.segments = [
    { id: 'seg-short', startTime, endTime, rawDuration: 900000, effectiveDuration: 900000 }
  ];
  window.updateTaskTotals(task);

  const timelineHTML = window.buildTimelineHTML(task.segments[0], task);
  assertIncludes(timelineHTML, 'segment-fill', 'Short segment should still have fill element');
  assertIncludes(timelineHTML, 'handle-start', 'Short segment should have start handle');
  assertIncludes(timelineHTML, 'handle-end', 'Short segment should have end handle');
}

async function testBlueprintColors() {
  // Verify Blueprint color system is used
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  // Track background should be Blueprint gray
  assertIncludes(allStyles, '#E1E8ED', 'Timeline track should use Blueprint background color #E1E8ED');

  // Fill should be Blueprint primary blue
  assertIncludes(allStyles, '#2B95D6', 'Segment fill should use Blueprint primary color #2B95D6');

  // Handle should use Blueprint dark blue
  assertIncludes(allStyles, '#106BA3', 'Handle should use Blueprint dark blue #106BA3');

  // Conflict should be Blueprint danger red
  assertIncludes(allStyles, '#DB3737', 'Conflict state should use Blueprint danger red #DB3737');
}

async function testHandleStyling() {
  // AC3: Handle should be 16px with Blueprint styling
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  // Check handle size
  assertIncludes(allStyles, 'width: 16px', 'Handle should be 16px wide');
  assertIncludes(allStyles, 'height: 16px', 'Handle should be 16px tall');

  // Check for hover effects
  assertIncludes(allStyles, 'handle:hover', 'Handle should have hover styles');

  // Check for rounded handle (Blueprint style)
  assertIncludes(allStyles, 'border-radius: 50%', 'Handle should be circular (Blueprint style)');
}

async function testTooltipStyling() {
  // AC3: Tooltip should show real-time time with Blueprint styling
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  assertIncludes(allStyles, 'timeline-tooltip', 'Timeline tooltip styles should exist');

  // Tooltip should use Blueprint primary color
  assertIncludes(allStyles, '#2B95D6', 'Tooltip should use Blueprint color');

  // Verify tooltip functions exist
  assert(typeof window.createDragTooltip === 'function', 'createDragTooltip should exist');
  assert(typeof window.updateDragTooltip === 'function', 'updateDragTooltip should exist');
  assert(typeof window.removeDragTooltip === 'function', 'removeDragTooltip should exist');
}

async function testConflictDetectionStyling() {
  // AC4: Conflict detection should work with Blueprint red
  const styles = document.querySelectorAll('style');
  let allStyles = '';
  styles.forEach(style => {
    allStyles += style.textContent;
  });

  // Check conflict class styling
  assertIncludes(allStyles, '.handle.conflict', 'Handle conflict class should have styles');
  assertIncludes(allStyles, '#DB3737', 'Conflict color should be Blueprint red #DB3737');

  // Verify conflict detection function exists
  assert(typeof window.checkSegmentOverlap === 'function', 'checkSegmentOverlap should exist');

  // Test actual conflict detection
  const seg1 = { startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T11:00:00').getTime() };
  const otherSegs = [
    { startTime: new Date('2026-04-21T10:00:00').getTime(), endTime: new Date('2026-04-21T12:00:00').getTime() }
  ];
  assert(window.checkSegmentOverlap(seg1, otherSegs) === true, 'Should detect overlapping segments');
}

async function testBreakOverlayPreserved() {
  // Verify break overlays still work
  assert(typeof window.buildBreakOverlays === 'function', 'buildBreakOverlays should exist');

  const task = window.createTask('休息时段测试');
  task.status = 'completed';
  task.segments = [
    { id: 'seg-break', startTime: new Date('2026-04-21T09:00:00').getTime(), endTime: new Date('2026-04-21T12:00:00').getTime(), rawDuration: 10800000, effectiveDuration: 10800000 }
  ];

  const timelineHTML = window.buildTimelineHTML(task.segments[0], task);
  assertIncludes(timelineHTML, 'break-overlay', 'Timeline should still contain break overlays');
}

async function testDeleteSegmentPreserved() {
  // Verify delete functionality is preserved
  assert(typeof window.deleteSegment === 'function', 'deleteSegment should exist');
}

async function testAddSegmentPreserved() {
  // Verify add segment functionality is preserved
  assert(typeof window.showSegmentAddForm === 'function', 'showSegmentAddForm should exist');
  assert(typeof window.saveNewSegment === 'function', 'saveNewSegment should exist');
}

// ========================================
// Run all tests
// ========================================

async function main() {
  console.log('Running TASK-004 Tests: Timeline Optimization in Panel...\n');

  await runTest('Timeline width is optimized for panel', testTimelineWidthOptimization);
  await runTest('Short segments have min-width for visibility', testShortSegmentVisibility);
  await runTest('Blueprint color system is applied', testBlueprintColors);
  await runTest('Handle styling is 16px with Blueprint look', testHandleStyling);
  await runTest('Tooltip styling uses Blueprint colors', testTooltipStyling);
  await runTest('Conflict detection uses Blueprint red', testConflictDetectionStyling);
  await runTest('Break overlay display is preserved', testBreakOverlayPreserved);
  await runTest('Segment deletion is preserved', testDeleteSegmentPreserved);
  await runTest('Segment addition is preserved', testAddSegmentPreserved);

  console.log('\n========================================');
  console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
  console.log('========================================');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
