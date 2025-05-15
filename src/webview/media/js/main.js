import { UI } from './ui.js';

/**
 * 應用入口模塊
 * 初始化 Git Log Visualizer
 */
document.addEventListener('DOMContentLoaded', () => {
  // 初始化 UI
  const ui = new UI();

  // 設置頁面標題動畫
  setupTitleAnimation();

  // 檢查瀏覽器兼容性
  checkBrowserCompatibility();
});

/**
 * 設置頁面標題動畫
 */
function setupTitleAnimation() {
  const title = document.querySelector('header h1');
  if (!title) {
    return;
  }

  // 添加簡單的淡入效果
  title.style.opacity = '0';
  title.style.transition = 'opacity 0.8s ease-in-out';

  setTimeout(() => {
    title.style.opacity = '1';
  }, 300);
}

/**
 * 檢查瀏覽器兼容性
 */
function checkBrowserCompatibility() {
  // 檢查基本 D3 兼容性
  if (!window.d3) {
    showCompatibilityError(
      '未能載入 D3.js 庫。請確認您的網絡連接，或嘗試使用更現代的瀏覽器。'
    );
    return;
  }

  // 檢查 SVG 支持
  if (
    !document.implementation.hasFeature(
      'http://www.w3.org/TR/SVG11/feature#BasicStructure',
      '1.1'
    )
  ) {
    showCompatibilityError(
      '您的瀏覽器不支持 SVG，這是視覺化必需的功能。請使用更現代的瀏覽器。'
    );
    return;
  }

  // 檢查其他現代功能
  if (!window.requestAnimationFrame) {
    console.warn('缺少 requestAnimationFrame 支持，動畫可能不流暢。');
  }
}

/**
 * 顯示兼容性錯誤消息
 * @param {string} message - 錯誤消息
 */
function showCompatibilityError(message) {
  const errorContainer = document.createElement('div');
  errorContainer.className =
    'p-4 bg-red-100 border border-red-400 text-red-700 rounded my-4 mx-auto max-w-lg';
  errorContainer.innerHTML = `
      <h3 class="font-bold mb-2">兼容性問題</h3>
      <p>${message}</p>
    `;

  // 插入到頁面中
  const main = document.querySelector('main');
  if (main && main.firstChild) {
    main.insertBefore(errorContainer, main.firstChild);
  } else {
    document.body.insertBefore(errorContainer, document.body.firstChild);
  }
}
