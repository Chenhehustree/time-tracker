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
  console.log('=== TASK-007 Dashboard 统计区 Blueprint 化测试 ===\n');

  let passed = 0;
  let failed = 0;

  // AC1: 4 个统计卡片使用 Blueprint Card 样式
  try {
    console.log('AC1: 4 个统计卡片使用 Blueprint Card 样式...');
    await setup();
    
    const statsContainer = document.getElementById('stats-container');
    assert(statsContainer, '统计卡片容器 #stats-container 不存在');
    
    const statCards = statsContainer.querySelectorAll('.stat-card');
    assert(statCards.length === 4, `统计卡片数量应为 4 个，实际有 ${statCards.length} 个`);
    
    statCards.forEach((card, index) => {
      assert(card.classList.contains('bp5-card'), `第 ${index + 1} 个卡片缺少 bp5-card 类`);
      assert(
        card.classList.contains('bp5-elevation-1') || 
        card.classList.contains('bp5-elevation-2') ||
        card.classList.contains('bp5-elevation-3') ||
        card.classList.contains('bp5-elevation-4'),
        `第 ${index + 1} 个卡片缺少 bp5-elevation-* 类`
      );
    });
    
    console.log('  ✅ 通过：4 个统计卡片使用 Blueprint Card 样式');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC2: 每个卡片包含图标、大数值、标签
  try {
    console.log('\nAC2: 每个卡片包含图标、大数值、标签...');
    await setup();
    
    const statsContainer = document.getElementById('stats-container');
    const statCards = statsContainer.querySelectorAll('.stat-card');
    
    statCards.forEach((card, index) => {
      // 检查图标
      const icon = card.querySelector('.stat-icon, [class*="bp5-icon"]');
      assert(icon, `第 ${index + 1} 个卡片缺少图标元素`);
      
      // 检查大数值
      const value = card.querySelector('.stat-value');
      assert(value, `第 ${index + 1} 个卡片缺少 stat-value 元素`);
      
      // 检查标签
      const label = card.querySelector('.stat-label');
      assert(label, `第 ${index + 1} 个卡片缺少 stat-label 元素`);
    });
    
    console.log('  ✅ 通过：每个卡片包含图标、大数值、标签');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC3: 使用 Blueprint 色彩系统
  try {
    console.log('\nAC3: 使用 Blueprint 色彩系统...');
    await setup();
    
    const statsContainer = document.getElementById('stats-container');
    const statCards = statsContainer.querySelectorAll('.stat-card');
    
    assert(statCards.length >= 4, `统计卡片数量不足 4 个`);
    
    // 任务数 = 蓝色 (bp5-intent-primary)
    const taskCountCard = statCards[0];
    assert(
      taskCountCard.classList.contains('bp5-intent-primary') || 
      taskCountCard.querySelector('.bp5-intent-primary'),
      '任务数卡片应使用蓝色 (bp5-intent-primary)'
    );
    
    // 总工时 = 绿色 (bp5-intent-success)
    const totalHoursCard = statCards[1];
    assert(
      totalHoursCard.classList.contains('bp5-intent-success') || 
      totalHoursCard.querySelector('.bp5-intent-success'),
      '总工时卡片应使用绿色 (bp5-intent-success)'
    );
    
    // 人天 = 紫色
    const personDaysCard = statCards[2];
    const hasPurple = 
      personDaysCard.classList.contains('stat-card-purple') ||
      personDaysCard.querySelector('.stat-card-purple') ||
      personDaysCard.style.color === '#8F398F' ||
      personDaysCard.style.color === '#634DBF' ||
      getComputedStyle(personDaysCard).borderTopColor.includes('142') ||
      personDaysCard.querySelector('[style*="8F398F"]') ||
      personDaysCard.querySelector('[style*="634DBF"]');
    assert(hasPurple, '人天卡片应使用紫色');
    
    // 休息 = 橙色 (bp5-intent-warning)
    const breakCard = statCards[3];
    assert(
      breakCard.classList.contains('bp5-intent-warning') || 
      breakCard.querySelector('.bp5-intent-warning'),
      '休息卡片应使用橙色 (bp5-intent-warning)'
    );
    
    console.log('  ✅ 通过：使用 Blueprint 色彩系统');
    passed++;
  } catch (e) {
    console.log('  ❌ 失败:', e.message);
    failed++;
  } finally {
    teardown();
  }

  // AC4: 统计数据实时更新
  try {
    console.log('\nAC4: 统计数据实时更新...');
    await setup();
    
    // 检查 updateDashboardStats 函数存在
    assert(typeof window.updateDashboardStats === 'function', 'updateDashboardStats 函数不存在');
    
    // 创建测试数据
    window.todayTasks = [
      {
        id: 'test-1',
        taskName: '测试任务1',
        status: 'idle',
        totalRawDuration: 3600000, // 1小时
        totalEffectiveDuration: 3600000,
        segments: []
      },
      {
        id: 'test-2', 
        taskName: '测试任务2',
        status: 'running',
        totalRawDuration: 0,
        totalEffectiveDuration: 0,
        segments: [
          { startTime: Date.now() - 1800000, endTime: null, rawDuration: 0, effectiveDuration: 0 }
        ]
      }
    ];
    
    // 调用更新函数
    window.updateDashboardStats();
    
    const statsContainer = document.getElementById('stats-container');
    const statCards = statsContainer.querySelectorAll('.stat-card');
    
    // 检查任务数是否正确更新（2个任务）
    const taskCountValue = statCards[0].querySelector('.stat-value');
    assert(taskCountValue, '任务数值元素不存在');
    assert(taskCountValue.textContent.includes('2'), `任务数应显示 2，实际显示 "${taskCountValue.textContent}"`);
    
    // 检查总工时是否正确更新（至少 0.5 小时）
    const totalHoursValue = statCards[1].querySelector('.stat-value');
    assert(totalHoursValue, '总工时数值元素不存在');
    const totalHoursText = totalHoursValue.textContent;
    const totalHoursMatch = totalHoursText.match(/[\d.]+/);
    assert(totalHoursMatch, `总工时应包含数字，实际显示 "${totalHoursText}"`);
    const totalHours = parseFloat(totalHoursMatch[0]);
    assert(totalHours >= 0.5, `总工时应至少为 0.5 小时，实际为 ${totalHours}`);
    
    console.log('  ✅ 通过：统计数据实时更新');
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
