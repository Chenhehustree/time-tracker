const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'time-tracker.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

(async function() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  const window = dom.window;
  const document = window.document;

  console.log('readyState after JSDOM:', document.readyState);

  // Wait a bit for DOMContentLoaded
  await new Promise(resolve => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('Already ready');
      resolve();
    } else {
      console.log('Waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded fired!');
        resolve();
      });
      setTimeout(() => {
        console.log('Timeout fallback, readyState:', document.readyState);
        resolve();
      }, 200);
    }
  });

  const startBtn = document.getElementById('start-stop-btn');
  console.log('startBtn:', startBtn ? startBtn.outerHTML : 'null');

  // Check if click event is bound
  const taskInput = document.getElementById('task-name-input');
  taskInput.value = '测试任务';

  // Try clicking
  startBtn.click();
  console.log('After click, text:', startBtn.textContent);
  console.log('After click, timerDisplay:', document.getElementById('timer-display').textContent);

  // Wait a bit
  await new Promise(r => setTimeout(r, 1200));
  console.log('After 1.2s, timerDisplay:', document.getElementById('timer-display').textContent);

  // Try calling tick manually
  window.tick();
  console.log('After manual tick, timerDisplay:', document.getElementById('timer-display').textContent);

  // Check variables
  console.log('isRunning:', window.isRunning);
  console.log('startTime:', window.startTime);
  console.log('timerDisplay:', window.timerDisplay ? 'set' : 'null');

  // Check localStorage
  const state = window.localStorage.getItem('timerState');
  console.log('localStorage state:', state);

  dom.window.close();
})();
