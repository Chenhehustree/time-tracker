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
  console.log('=== V2-001 Modern Dashboard UI 骨架测试 ===\n');

  let passed = 0;
  let failed = 0;

  // 测试 1: 侧边栏结构
  try {
    console.log('测试 1: 侧边栏结构...');
    await setup();
    
    const sidebar = document.getElementById('sidebar');
    assert(sidebar, '侧边栏 #sidebar 不存在');
    
    const navDashboard = document.getElementById('nav-dashboard');
    const navToday = document.getElementById('nav-today');
    const navHistory = document.getElementById('nav-history');
    const navSettings = document.getElementById('nav-settings');
    
    assert(navDashboard, '导航项 #nav-dashboard 不存在');
    assert(navToday, '导航项 #nav-today 不存在');
    assert(navHistory, '导航项 #nav-history 不存在');
    assert(navSettings, '导航项 #nav-settings 不存在');
    
    console.log('  ✅ 通过：侧边栏结构正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 2: 主内容区结构
  try {
    console.log('\n测试 2: 主内容区结构...');
    await setup();
    
    const mainContent = document.getElementById('main-content');
    assert(mainContent, '主内容区 #main-content 不存在');
    
    const headerTitle = document.getElementById('header-title');
    const headerDate = document.getElementById('header-date');
    
    assert(headerTitle, '标题栏 #header-title 不存在');
    assert(headerDate, '标题栏 #header-date 不存在');
    
    console.log('  ✅ 通过：主内容区结构正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 3: 活动任务区域
  try {
    console.log('\n测试 3: 活动任务区域...');
    await setup();
    
    const activeTaskBanner = document.getElementById('active-task-banner');
    assert(activeTaskBanner, '活动任务区域 #active-task-banner 不存在');
    
    console.log('  ✅ 通过：活动任务区域存在');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 4: 统计卡片容器
  try {
    console.log('\n测试 4: 统计卡片容器...');
    await setup();
    
    const statsContainer = document.getElementById('stats-container');
    assert(statsContainer, '统计卡片容器 #stats-container 不存在');
    
    // 检查是否包含 4 个统计卡片
    const statCards = statsContainer.querySelectorAll('.stat-card');
    assert(statCards.length >= 4, `统计卡片数量不足 4 个，实际有 ${statCards.length} 个`);
    
    console.log('  ✅ 通过：统计卡片容器包含4个卡片');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 5: 任务卡片容器
  try {
    console.log('\n测试 5: 任务卡片容器...');
    await setup();
    
    const tasksContainer = document.getElementById('tasks-container');
    assert(tasksContainer, '任务卡片容器 #tasks-container 不存在');
    
    // 检查是否显示"暂无任务"提示
    const text = tasksContainer.textContent;
    assert(text.includes('暂无任务'), '任务容器应包含"暂无任务"提示');
    
    console.log('  ✅ 通过：任务卡片容器显示正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 6: 新建任务按钮
  try {
    console.log('\n测试 6: 新建任务按钮...');
    await setup();
    
    const btnNewTask = document.getElementById('btn-new-task');
    assert(btnNewTask, '新建任务按钮 #btn-new-task 不存在');
    
    console.log('  ✅ 通过：新建任务按钮存在');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 7: CSS 自定义属性
  try {
    console.log('\n测试 7: CSS 自定义属性定义...');
    await setup();
    
    const styles = document.querySelectorAll('style');
    assert(styles.length > 0, '缺少样式定义');
    
    let hasRootVariables = false;
    let allStyles = '';
    
    styles.forEach(style => {
      allStyles += style.textContent;
    });
    
    // 检查是否定义了关键的 CSS 变量
    assert(allStyles.includes('--sidebar-bg'), '缺少 --sidebar-bg 变量');
    assert(allStyles.includes('--main-bg'), '缺少 --main-bg 变量');
    assert(allStyles.includes('--card-bg'), '缺少 --card-bg 变量');
    assert(allStyles.includes('--primary'), '缺少 --primary 变量');
    assert(allStyles.includes('--success'), '缺少 --success 变量');
    
    console.log('  ✅ 通过：CSS 自定义属性已定义');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 8: JavaScript 占位符
  try {
    console.log('\n测试 8: JavaScript 占位符...');
    await setup();
    
    const scripts = document.querySelectorAll('script');
    assert(scripts.length > 0, '缺少 script 标签');
    
    let hasV2Comment = false;
    scripts.forEach(script => {
      if (script.textContent.includes('V2') || script.textContent.includes('v2')) {
        hasV2Comment = true;
      }
    });
    
    // V2 注释是可选的，但推荐
    if (hasV2Comment) {
      console.log('  ✅ 通过：找到 V2 版本注释');
    } else {
      console.log('  ⚠️  警告：未找到 V2 版本注释（可选）');
    }
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 9: 布局结构验证
  try {
    console.log('\n测试 9: 布局结构验证...');
    await setup();
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    // 检查侧边栏和主内容是否在同一层级
    const body = document.body;
    const children = Array.from(body.children);
    
    // 侧边栏和主内容应该在 body 的直接子元素中
    // 或者在一个 wrapper 中
    const hasWrapper = children.some(el => el.id === 'app-wrapper' || el.classList.contains('app-wrapper'));
    
    // 简单的结构检查 - 侧边栏和主内容应该都存在
    assert(sidebar && mainContent, '侧边栏和主内容必须同时存在');
    
    console.log('  ✅ 通过：布局结构正确');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // 测试 10: 响应式基础
  try {
    console.log('\n测试 10: 响应式媒体查询...');
    await setup();
    
    const styles = document.querySelectorAll('style');
    let allStyles = '';
    
    styles.forEach(style => {
      allStyles += style.textContent;
    });
    
    // 检查是否有媒体查询
    const hasMediaQuery = allStyles.includes('@media');
    
    if (hasMediaQuery) {
      console.log('  ✅ 通过：包含响应式媒体查询');
    } else {
      console.log('  ⚠️  警告：未找到媒体查询（响应式是可选的基础要求）');
    }
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
