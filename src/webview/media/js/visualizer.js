/**
 * Git Log Visualizer Module
 * 使用 D3.js 視覺化 git 提交歷史
 */
export class GitVisualizer {
  /**
   * 初始化視覺化模塊
   * @param {string} containerId - 容器元素的 ID
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.container = d3.select(`#${containerId}`);
    this.width = this.container.node().getBoundingClientRect().width;
    this.height = this.container.node().getBoundingClientRect().height;
    this.padding = { top: 40, right: 120, bottom: 20, left: 50 };

    // 初始化 SVG
    this.svg = this.container
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, this.width, this.height]);

    // 創建縮放與平移功能
    this.zoomGroup = this.svg.append('g');
    this.zoom = d3
      .zoom()
      .scaleExtent([0.2, 8])
      .on('zoom', (event) => {
        this.zoomGroup.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // 創建工具提示
    this.tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // 顏色比例尺
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // 存儲用於圖形呈現的數據
    this.graphData = null;
    this.prevGraphData = null; // 上一輪狀態（動畫起點）
  }

  /**
   * 視覺化 git 提交歷史
   * @param {Object} graph - 帶有節點和連接的圖形數據
   */
  visualize(graph) {
    // ① 先把目前狀態存成「上一輪」
    this.prevGraphData = this.graphData
      ? structuredClone(this.graphData)
      : null;

    if (!graph.nodes || graph.nodes.length === 0) {
      console.warn('沒有節點可視覺化');
      // 清除上一次的可視化結果，不保留舊狀態
      this.graphData = { nodes: [], links: [] };
      this.clearVisualization();
      return;
    }

    // ② 深拷貝新資料，避免計算座標時改動傳進來的原始物件
    this.graphData = structuredClone(graph);

    // 獲取唯一作者列表並設置顏色比例尺
    const authors = [
      ...new Set(this.graphData.nodes.map((node) => node.author)),
    ];
    this.colorScale.domain(authors);

    // ③ 計算新佈局
    this.calculateLayout();

    // ④ 繪圖（帶動畫）
    this.renderGraph();
  }

  /**
   * 清除所有可視化元素
   */
  clearVisualization() {
    // 移除所有節點
    this.zoomGroup.selectAll('.node')
      .transition()
      .duration(800)
      .style('opacity', 0)
      .remove();

    // 移除所有連接
    this.zoomGroup.selectAll('.link')
      .transition()
      .duration(800)
      .style('opacity', 0)
      .remove();

    // 移除所有分支標籤
    this.zoomGroup.selectAll('.branch-label')
      .transition()
      .duration(800)
      .style('opacity', 0)
      .remove();
  }

  /**
   * 計算節點的位置
   * 使用拓撲排序和分層算法
   */
  calculateLayout() {
    const { nodes, links } = this.graphData;
    const dy = 50; // y 軸節點間距
    const dx = 75; // x 軸固定間距

    // 構建鄰接圖
    const parentMap = new Map(); // 每個節點的父節點
    const childrenMap = new Map(); // 每個節點的子節點

    // 初始化所有節點的父子節點集合
    nodes.forEach((node) => {
      parentMap.set(node.id, []);
      childrenMap.set(node.id, []);
    });

    // 構建鄰接關係
    nodes.forEach((node) => {
      node.parents.forEach((parentId) => {
        const parentNode = nodes.find((n) => n.id === parentId);
        if (parentNode) {
          // 添加雙向連接
          parentMap.get(node.id).push(parentId);
          childrenMap.get(parentId).push(node.id);
        }
      });
    });

    // 執行拓撲排序，計算每個節點的層級
    const levels = new Map(); // 節點層級
    const inDegree = new Map(); // 入度（父節點數量）

    // 初始化入度
    nodes.forEach((node) => {
      inDegree.set(node.id, parentMap.get(node.id).length);
    });

    // 找出根節點（入度為 0 的節點）
    const rootNodes = nodes.filter((node) => inDegree.get(node.id) === 0);
    if (rootNodes.length === 0) {
      console.warn('找不到根節點，使用第一個節點作為根節點');
      rootNodes.push(nodes[0]);
      inDegree.set(nodes[0].id, 0);
    }

    // 從根節點開始拓撲排序
    const queue = [...rootNodes];
    let level = 0;

    while (queue.length > 0) {
      const levelSize = queue.length;

      // 處理當前層的所有節點
      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift();
        levels.set(node.id, level);

        // 將所有子節點入度減 1，如果入度為 0，則加入隊列
        childrenMap.get(node.id).forEach((childId) => {
          const childNode = nodes.find((n) => n.id === childId);
          if (childNode) {
            inDegree.set(childId, inDegree.get(childId) - 1);
            if (inDegree.get(childId) === 0) {
              queue.push(childNode);
            }
          }
        });
      }

      level++;
    }

    // 處理可能的環形依賴（如果有節點沒有被訪問）
    nodes.forEach((node) => {
      if (!levels.has(node.id)) {
        levels.set(node.id, level++);
        console.warn(`檢測到環形依賴，節點 ${node.id} 被分配到層級 ${level}`);
      }
    });

    // 計算每個層級的節點數量
    const levelNodes = {};
    const maxLevel = Math.max(...Array.from(levels.values()));

    // 初始化每層的節點數組
    for (let i = 0; i <= maxLevel; i++) {
      levelNodes[i] = [];
    }

    // 將節點按層級分組
    nodes.forEach((node) => {
      const nodeLevel = levels.get(node.id);
      levelNodes[nodeLevel].push(node);
    });

    // 計算 X 座標
    // 1. 根節點水平分佈，使用固定間距
    if (rootNodes.length === 1) {
      // 單個根節點居中
      rootNodes[0].x = this.width / 2;
    } else {
      // 多個根節點以 dx 間距分布於中心
      rootNodes.forEach((node, i) => {
        node.x = this.width / 2 + (i - (rootNodes.length - 1) / 2) * dx;
      });
    }

    // 2. 自頂向下計算所有其他節點的 x 座標
    for (let l = 1; l <= maxLevel; l++) {
      const nodesAtLevel = levelNodes[l];

      // 按父節點分組
      const parentGroups = new Map();

      nodesAtLevel.forEach((node) => {
        const parentIds = parentMap.get(node.id);
        if (parentIds.length === 0) {
          // 如果節點沒有父節點，使用中心位置
          node.x = this.width / 2;
          return;
        }

        // 使用父節點的主鍵作為組標識
        const mainParentId = parentIds[0]; // 主要父節點（第一個）

        if (!parentGroups.has(mainParentId)) {
          parentGroups.set(mainParentId, []);
        }
        parentGroups.get(mainParentId).push(node);
      });

      // 為每組分配 x 座標
      for (const [parentId, groupNodes] of parentGroups.entries()) {
        const parent = nodes.find((n) => n.id === parentId);
        if (!parent) {
          continue;
        }
        const k = groupNodes.length;
        if (k === 1) {
          // 單一子節點對齊父節點
          groupNodes[0].x = parent.x;
        } else {
          // 多個子節點以固定間距 dx 排列
          groupNodes.forEach((node, i) => {
            node.x = parent.x + (i - (k - 1) / 2) * dx;
          });
        }
      }

      // 處理合併節點（有多個父節點的節點）
      nodesAtLevel.forEach((node) => {
        const parentIds = parentMap.get(node.id);
        if (parentIds.length > 1) {
          // 多重父節點，對齊主要父節點
          const mainParent = nodes.find((n) => n.id === parentIds[0]);
          if (mainParent) {
            node.x = mainParent.x;
          }
        }
      });
    }

    // 設置最終的 y 座標
    nodes.forEach((node) => {
      const nodeLevel = levels.get(node.id);
      // 根節點在底部（y 較大），頂層節點在頂部（y 較小）
      node.y = this.height - this.padding.bottom - nodeLevel * dy;
    });

    // 處理連接
    links.forEach((link) => {
      link.source = nodes.find((n) => n.id === link.sourceHash);
      link.target = nodes.find((n) => n.id === link.targetHash);
    });
  }

  /**
   * 繪製提交圖
   */
  renderGraph() {
    const { nodes, links } = this.graphData;

    // 準備「舊座標」快取
    const oldPos = new Map();
    if (this.prevGraphData) {
      this.prevGraphData.nodes.forEach((n) =>
        oldPos.set(n.id, { x: n.x, y: n.y })
      );
    }

    // 節點
    const nodeSel = this.zoomGroup.selectAll('.node').data(nodes, (d) => d.id);

    // --- enter ---
    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => {
        // 新增節點從父節點舊位置或自身位置進入
        let start = oldPos.get(d.id);
        if (!start && d.parents && d.parents.length) {
          start = oldPos.get(d.parents[0]);
        }
        if (!start) {
          start = { x: d.x, y: d.y };
        }
        return `translate(${start.x},${start.y})`;
      })
      .style('opacity', 0)
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .on('click', (event, d) => this.showCommitDetails(d));

    // 繪製提交圓圈
    nodeEnter
      .append('circle')
      .attr('r', 10)
      .attr('fill', (d) => this.colorScale(d.author))
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5);

    // 添加提交哈希標籤
    nodeEnter
      .append('text')
      .attr('dy', 1.5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .text((d) => d.id.substring(0, 7));

    // --- update + enter 合併：滑到新位置 ---
    const nodeMerge = nodeEnter.merge(nodeSel);
    nodeMerge
      .transition()
      .duration(800)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('opacity', 1);

    // --- exit：收進主要父節點後移除 ---
    nodeSel
      .exit()
      .transition()
      .duration(800)
      .attr('transform', (d) => {
        const mainParent = d.parents?.[0];
        const target = oldPos.get(mainParent) ?? { x: d.x, y: d.y };
        return `translate(${target.x},${target.y})`;
      })
      .remove();

    // 繪製連接
    this.renderLinks(oldPos);

    // 調整繪製順序: 連線在底層, 節點與標籤在上層
    this.zoomGroup.selectAll('.link').lower();
    this.zoomGroup.selectAll('.node').raise();

    // 繪製分支和標籤（帶動畫）
    this.renderBranchLabels(oldPos);

    // 調整繪製順序: 連線在底層, 節點與標籤在上層
    this.zoomGroup.selectAll('.link').lower();
    this.zoomGroup.selectAll('.node').raise();
    this.zoomGroup.selectAll('.branch-label').raise();

    // 等 800 ms transition 結束再居中
    this.svg
      .transition()
      .delay(800)
      .on('end', () => this.centerView());
  }

  /**
   * 繪製提交間的連接
   * @param {Map} oldPos - 舊節點位置的 Map
   */
  renderLinks(oldPos) {
    const { links } = this.graphData;

    // 路徑計算函式
    const path = (s, t) => {
      if (Math.abs(s.x - t.x) < 1) {
        // x 座標相同，繪製直線
        return `M${s.x},${s.y} L${t.x},${t.y}`;
      } else {
        // x 座標不同，繪製貝塞爾曲線
        const controlY = (s.y + t.y) / 2;
        return `M${s.x},${s.y} C${s.x},${controlY} ${t.x},${controlY} ${t.x},${t.y}`;
      }
    };

    // key 用「sourceId-targetId」
    const linkSel = this.zoomGroup
      .selectAll('.link')
      .data(links, (l) => `${l.sourceHash}-${l.targetHash}`);

    // --- enter：從舊 source / target 畫到舊点 ---
    const linkEnter = linkSel
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('d', (l) => {
        const sOld = oldPos?.get(l.sourceHash)
          ? { x: oldPos.get(l.sourceHash).x, y: oldPos.get(l.sourceHash).y }
          : l.source;
        const tOld = oldPos?.get(l.targetHash)
          ? { x: oldPos.get(l.targetHash).x, y: oldPos.get(l.targetHash).y }
          : l.target;
        return path(sOld, tOld);
      })
      .style('opacity', 0) // 新增 link 從透明開始
      .on('mouseover', function () {
        d3.select(this).attr('stroke', '#333').attr('stroke-width', 3);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', '#999').attr('stroke-width', 2);
      });

    // --- 所有 (enter+update) 轉到新形狀 ---
    linkEnter
      .merge(linkSel)
      .transition()
      .duration(800)
      .attr('d', (l) => path(l.source, l.target))
      .style('opacity', 1); // 淡入

    // --- exit：縮成終點然後移除 ---
    linkSel
      .exit()
      .transition()
      .duration(800)
      .attr('d', (l) => {
        const end = oldPos?.get(l.targetHash)
          ? { x: oldPos.get(l.targetHash).x, y: oldPos.get(l.targetHash).y }
          : l.target;
        return `M${end.x},${end.y} L${end.x},${end.y}`;
      })
      .remove();
  }

  /**
   * 繪製分支和標籤（動畫版）
   * @param {Map} oldPos - 舊節點位置 map
   */
  renderBranchLabels(oldPos) {
    // 構建標籤數據
    const labelData = [];
    this.graphData.nodes.forEach((node) => {
      if (node.refs && node.refs.length > 0) {
        node.refs.forEach((ref, i) => labelData.push({ node, ref, index: i }));
      }
    });
    // data join
    const labelSel = this.zoomGroup
      .selectAll('.branch-label')
      .data(labelData, (d) => `${d.node.id}-${d.ref}`);
    // exit
    labelSel.exit().transition().duration(800).style('opacity', 0).remove();
    // enter
    const labelEnter = labelSel
      .enter()
      .append('g')
      .attr('class', 'branch-label')
      .attr('transform', (d) => {
        const old = oldPos.get(d.node.id) ?? { x: d.node.x, y: d.node.y };
        return `translate(${old.x + 20},${old.y + d.index * 18})`;
      })
      .style('opacity', 0);
    // 新增元素：背景和文字
    labelEnter.each(function (d) {
      const g = d3.select(this);
      // 顏色設定
      let bgColor = '#10b981',
        textColor = '#fff';
      if (d.ref.includes('tag')) {
        bgColor = '#f59e0b';
      } else if (d.ref === 'HEAD') {
        bgColor = '#3b82f6';
      }
      const text = g
        .append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('fill', textColor)
        .attr('dy', '0.35em')
        .attr('font-size', '5px')
        .text(d.ref);
      const w = text.node().getComputedTextLength();
      g.insert('rect', 'text')
        .attr('x', -5)
        .attr('y', -5)
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('width', w + 10)
        .attr('height', 10)
        .attr('fill', bgColor);
    });
    // enter + update
    const labels = labelEnter.merge(labelSel);
    labels.raise(); // layering: bring labels above nodes
    labels
      .transition()
      .duration(800)
      .attr(
        'transform',
        (d) => `translate(${d.node.x + 20},${d.node.y + d.index * 18})`
      )
      .style('opacity', 1);
  }

  /**
   * 顯示提交的工具提示
   * @param {Event} event - 鼠標事件
   * @param {Object} commit - 提交數據
   */
  showTooltip(event, commit) {
    const [x, y] = d3.pointer(event, document.body);

    this.tooltip.transition().duration(200).style('opacity', 0.9);

    this.tooltip
      .html(
        `
      <div style="font-weight:bold;">${commit.id.substring(0, 7)}</div>
      <div><strong>作者:</strong> ${commit.author}</div>
      <div><strong>日期:</strong> ${commit.date}</div>
      <div><strong>提交訊息:</strong> ${commit.message}</div>
    `
      )
      .style('left', `${x + 15}px`)
      .style('top', `${y - 15}px`);
  }

  /**
   * 隱藏工具提示
   */
  hideTooltip() {
    this.tooltip.transition().duration(500).style('opacity', 0);
  }

  /**
   * 顯示提交詳細信息
   * @param {Object} commit - 提交數據
   */
  showCommitDetails(commit) {
    // 在視覺化中突出顯示選中的提交
    this.highlightCommit(commit.id);
  }

  /**
   * 突出顯示選中的提交
   * @param {string} commitId - 要突出顯示的提交 ID
   */
  highlightCommit(commitId) {
    // 重置之前的高亮狀態
    this.zoomGroup
      .selectAll('.node circle')
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5);

    // 高亮當前提交
    this.zoomGroup
      .selectAll('.node')
      .filter((d) => d.id === commitId)
      .select('circle')
      .attr('stroke', '#e11d48')
      .attr('stroke-width', 3);

    // 可選：突出顯示與此提交相關的連接
    this.zoomGroup
      .selectAll('.link')
      .attr('stroke', (d) =>
        d.source.id === commitId || d.target.id === commitId
          ? '#e11d48'
          : '#999'
      )
      .attr('stroke-width', (d) =>
        d.source.id === commitId || d.target.id === commitId ? 3 : 2
      );
  }

  /**
   * 將視圖居中
   */
  centerView() {
    // 獲取圖的邊界框
    const boundingBox = this.zoomGroup.node().getBBox();

    // 計算縮放比例並保留邊距 (10%)
    const baseScale = Math.min(
      (this.width - 40) / boundingBox.width,
      (this.height - 40) / boundingBox.height
    );
    const finalScale = baseScale * 0.9;

    // 計算圖的中心點
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;

    // 計算平移量，使圖中心對齊視窗中心
    const translateX = this.width / 2 - centerX * finalScale;
    const translateY = this.height / 2 - centerY * finalScale;

    // 應用變換
    this.svg.transition().duration(750).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(finalScale) // 使用計算後的縮放比例，並居中對齊
    );
  }

  /**
   * 縮小視圖
   */
  zoomIn() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
  }

  /**
   * 放大視圖
   */
  zoomOut() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
  }

  /**
   * 重置視圖
   */
  resetZoom() {
    this.centerView();
  }

  /**
   * 調整視圖大小
   */
  resize() {
    // 更新尺寸
    this.width = this.container.node().getBoundingClientRect().width;
    this.height = this.container.node().getBoundingClientRect().height;

    // 更新 SVG 視圖框
    this.svg.attr('viewBox', [0, 0, this.width, this.height]);

    // 如果有數據，重新居中
    if (this.graphData) {
      this.centerView();
    }
  }
}
