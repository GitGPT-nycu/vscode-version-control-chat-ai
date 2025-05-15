/**
 * UI 交互模組
 * 處理用戶界面事件和交互
 */

import { GitLogParser } from './parser.js';
import { GitVisualizer } from './visualizer.js';

export class UI {
  /**
   * 初始化 UI 模組
   */
  constructor() {
    // 存儲 DOM 元素
    this.zoomInBtn = document.getElementById('zoomInBtn');
    this.zoomOutBtn = document.getElementById('zoomOutBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.visualizationSelect = document.getElementById('visualizationSelect');

    // Git log
    this.gitLogInput = '';
    this.gitLogEndState = '';

    // 設置事件監聽器
    this.setupEventListeners();

    // 初始化視覺化器
    this.visualizer = null;

    // 動畫狀態
    this.isAnimating = false;

    // Vscode API
    this.vscode = acquireVsCodeApi();
    this.onExtensionMessage();
    this.sendReady();
  }

  /**
   * 設置事件監聽器
   */
  setupEventListeners() {
    // 縮放控制事件
    this.zoomInBtn.addEventListener('click', () => {
      if (this.visualizer) {
        this.visualizer.zoomIn();
      }
    });

    this.zoomOutBtn.addEventListener('click', () => {
      if (this.visualizer) {
        this.visualizer.zoomOut();
      }
    });

    this.resetBtn.addEventListener('click', () => {
      if (this.visualizer) {
        this.visualizer.resetZoom();
      }
    });

    this.visualizationSelect.addEventListener('change', () => {
      this.switchVisualizationView();
    });

    // 調整大小處理器
    window.addEventListener('resize', () => {
      if (this.visualizer) {
        this.visualizer.resize();
      }
    });
  }

  /**
   * 解析 git log 輸入並視覺化
   */
  parseGitLog() {
    const gitLogText = this.gitLogInput.trim();

    try {
      // 解析 git log
      const commits = GitLogParser.parse(gitLogText);

      // 從提交構建圖形
      const graph = GitLogParser.buildGraph(commits);

      // 如果尚未創建，則初始化視覺化器
      if (!this.visualizer) {
        this.visualizer = new GitVisualizer('visualization');
      }

      // 視覺化圖形
      this.visualizer.visualize(graph);

      // 如果動畫模式開啟且有結束狀態輸入，則嘗試動畫
      if (this.gitLogEndState.trim()) {
        this.animateGitLog();
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  sendReady() {
    console.log('sendReady');
    this.vscode.postMessage({
      type: 'ready',
    });
  }

  /**
   * 顯示錯誤消息
   * @param {string} message - 錯誤消息
   */
  showError(message) {
    console.error(message);
  }

  /**
   * 執行 Git Log 動畫
   */
  animateGitLog() {
    if (this.isAnimating) {
      return; // 避免重複動畫
    }

    const startLogText = this.gitLogInput.trim();
    const endLogText = this.gitLogEndState.trim();

    if (!startLogText || !endLogText) {
      this.showError('請確保初始和結束狀態的 Git Log 都已輸入');
      return;
    }

    try {
      // 解析初始和結束狀態
      const startCommits = GitLogParser.parse(startLogText);
      const endCommits = GitLogParser.parse(endLogText);

      // 從提交構建圖形
      const startGraph = GitLogParser.buildGraph(startCommits);
      const endGraph = GitLogParser.buildGraph(endCommits);

      // 如果尚未創建，則初始化視覺化器
      if (!this.visualizer) {
        this.visualizer = new GitVisualizer('visualization');
      }

      // 設置動畫狀態
      this.isAnimating = true;
      
      // 執行動畫循環
      const animateLoop = () => {
        // 先視覺化初始狀態
        this.visualizer.visualize(startGraph);
        
        setTimeout(() => {
          this.visualizer.visualize(endGraph);
          
          setTimeout(() => {
            if (this.isAnimating) {
              animateLoop();
            }
          }, 3000);
        }, 2000);
      };
      
      // 開始第一輪動畫
      animateLoop();
      
    } catch (error) {
      this.isAnimating = false;
      this.showError(error.message);
    }
  }
  
  /**
   * 停止動畫輪播
   */
  stopAnimation() {
    this.isAnimating = false;
  }

  setupVisualizationSelect(payload) {
    const repos = payload.repos;
    // 清除現有選項以避免重複添加
    this.visualizationSelect.innerHTML = '';

    repos.forEach((repo) => {
      const repoPath = repo.path || repo.label;
      // 檢查是否已存在相同 path 的選項
      const optionElement = document.createElement('option');
      optionElement.value = repoPath;
      optionElement.textContent = repo.label;
      this.visualizationSelect.appendChild(optionElement);
    });
  }

  switchVisualizationView() {
    const selectedView = this.visualizationSelect.value;
    this.vscode.postMessage({
      type: 'switchRepo',
      payload: {
        path: selectedView,
      },
    });
  }

  onExtensionMessage() {
    window.addEventListener('message', (event) => {
      const { data } = event;
      if (data.type === 'getAvailableRepo') {
        this.setupVisualizationSelect(data.payload);
      } else if (data.type === 'getGitLog') {
        this.gitLogInput = data.payload.beforeOperationLog;
        this.gitLogEndState = data.payload.afterOperationLog;
        this.parseGitLog();
      }
    });
  }
}
