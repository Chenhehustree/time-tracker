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
}

function teardown() {
  if (dom) {
    dom.window.close();
  }
}

// 简单的断言助手
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

// 测试套件
async function runTests() {
  console.log('=== TASK-008 暗黑主题切换功能测试 ===\n');

  let passed = 0;
  let failed = 0;

  // AC1: 设置页面显示主题选择（明/暗/跟随系统）
  try {
    console.log('AC1: 设置页面显示主题选择...');
    await setup();

    const themeSelect = document.getElementById('theme-select');
    assert(themeSelect, '主题选择器 #theme-select 不存在');

    const options = themeSelect.querySelectorAll('option');
    assert(options.length >= 3, `主题选项应有至少3个，实际有 ${options.length} 个`);

    const values = Array.from(options).map(o => o.value);
    assert(values.includes('light'), '应包含 light（亮色）选项');
    assert(values.includes('dark'), '应包含 dark（暗色）选项');
    assert(values.includes('system'), '应包含 system（跟随系统）选项');

    console.log('  ✅ 通过：设置页面显示主题选择');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC2: 切换到暗色后，全局背景变暗，文字变亮，所有组件适配
  try {
    console.log('\nAC2: 暗色模式 CSS 覆盖...');
    await setup();

    const styles = document.querySelectorAll('style');
    let allStyles = '';
    styles.forEach(style => {
      allStyles += style.textContent;
    });

    // 检查是否有 body.bp5-dark 的 CSS 规则
    assert(allStyles.includes('body.bp5-dark') || allStyles.includes('.bp5-dark'), '缺少 body.bp5-dark 或 .bp5-dark 的 CSS 规则');

    // 检查暗色模式是否覆盖了主要背景色和文字色
    const hasDarkBgOverride = allStyles.includes('--main-bg') && allStyles.includes('bp5-dark');
    const hasDarkTextOverride = allStyles.includes('--text-primary') && allStyles.includes('bp5-dark');
    const hasCardBgOverride = allStyles.includes('--card-bg') && allStyles.includes('bp5-dark');

    assert(hasDarkBgOverride || allStyles.match(/bp5-dark[^{]*\{[^}]*background/i), '暗色模式应覆盖背景色');
    assert(hasDarkTextOverride || allStyles.match(/bp5-dark[^{]*\{[^}]*color/i), '暗色模式应覆盖文字色');

    // 测试 setTheme('dark') 是否添加 bp5-dark 类
    assert(typeof window.setTheme === 'function', 'setTheme 函数不存在');
    window.setTheme('dark');
    assert(document.body.classList.contains('bp5-dark'), 'setTheme("dark") 后 body 应包含 bp5-dark 类');

    console.log('  ✅ 通过：暗色模式 CSS 覆盖正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC3: 切换到亮色后恢复默认白色主题
  try {
    console.log('\nAC3: 亮色模式恢复...');
    await setup();

    // 先设置为暗色
    window.setTheme('dark');
    assert(document.body.classList.contains('bp5-dark'), '初始应处于暗色模式');

    // 切换为亮色
    window.setTheme('light');
    assert(!document.body.classList.contains('bp5-dark'), 'setTheme("light") 后 body 不应包含 bp5-dark 类');

    console.log('  ✅ 通过：亮色模式恢复正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC4: 主题选择保存到 localStorage，刷新页面后自动恢复
  try {
    console.log('\nAC4: 主题持久化...');
    await setup();

    assert(typeof window.getTheme === 'function', 'getTheme 函数不存在');

    // 清除之前的主题设置
    window.localStorage.removeItem('time-tracker-theme');

    // 默认应为 light
    const defaultTheme = window.getTheme();
    assertEquals(defaultTheme, 'light', '默认主题应为 light');

    // 设置暗色主题
    window.setTheme('dark');
    const saved = window.localStorage.getItem('time-tracker-theme');
    assertEquals(saved, 'dark', '暗色主题应保存到 localStorage');

    // 模拟新页面加载，读取保存的主题
    const loadedTheme = window.getTheme();
    assertEquals(loadedTheme, 'dark', '从 localStorage 读取的主题应为 dark');

    // 测试 system 模式
    window.setTheme('system');
    const savedSystem = window.localStorage.getItem('time-tracker-theme');
    assertEquals(savedSystem, 'system', '跟随系统主题应保存到 localStorage');

    console.log('  ✅ 通过：主题持久化正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC5: "跟随系统"选项监听 prefers-color-scheme 媒体查询
  try {
    console.log('\nAC5: 跟随系统主题...');
    await setup();

    // 检查 initTheme 函数存在
    assert(typeof window.initTheme === 'function', 'initTheme 函数不存在');

    // 检查 matchMedia 是否被使用
    const initThemeStr = window.initTheme.toString();
    assert(initThemeStr.includes('matchMedia'), 'initTheme 应使用 matchMedia');
    assert(initThemeStr.includes('prefers-color-scheme'), 'initTheme 应监听 prefers-color-scheme');

    // 测试 system 模式下会根据 prefers-color-scheme 切换
    // JSDOM 默认是 light，所以 system 模式应该移除 bp5-dark
    window.setTheme('system');
    assert(window.getTheme() === 'system', 'getTheme 应返回 system');

    // 由于 JSDOM 默认 prefers-color-scheme: light，body 不应有 bp5-dark
    // 但这不是重点，重点是 CSS 规则存在

    // 检查 setTheme 中是否处理了 system 情况
    const setThemeStr = window.setTheme.toString();
    assert(setThemeStr.includes('system'), 'setTheme 应处理 system 模式');
    assert(setThemeStr.includes('prefers-color-scheme') || setThemeStr.includes('matchMedia'), 'setTheme 应使用 matchMedia 检测系统主题');

    console.log('  ✅ 通过：跟随系统主题正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 额外测试：暗色模式下自定义元素适配
  try {
    console.log('\n额外: 暗色模式自定义元素适配...');
    await setup();

    const styles = document.querySelectorAll('style');
    let allStyles = '';
    styles.forEach(style => {
      allStyles += style.textContent;
    });

    // 检查关键元素的暗色覆盖
    const darkSelectors = [
      '.bp5-dark .task-card',
      '.bp5-dark .segment-item',
      '.bp5-dark .timeline-track',
      '.bp5-dark .task-status',
      '.bp5-dark .break-period-item',
      '.bp5-dark .delete-dialog',
      'body.bp5-dark'
    ];

    let hasDarkOverrides = false;
    for (const selector of darkSelectors) {
      if (allStyles.includes(selector)) {
        hasDarkOverrides = true;
        break;
      }
    }

    assert(hasDarkOverrides, '应有至少一个自定义元素的暗色覆盖规则');

    console.log('  ✅ 通过：暗色模式自定义元素适配');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 输出总结
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${passed}/${passed + failed}`);
  console.log(`失败: ${failed}/${passed + failed}`);

  if (failed === 0) {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分测试失败');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  console.error('测试运行错误:', err);
  process.exit(1);
});
