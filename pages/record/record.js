// pages/record/record.js
const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    currentTab: 'daily', // 'daily' 日记录 | 'stats' 统计总结
    loading: false,

    // ===== 日记录数据 =====
    currentDate: '',    
    totalPomoTime: 0,
    pomoCount: 0,
    dailySummary: '',
    pomodoroList: [], // 该日期的番茄钟列表

    // ===== 统计数据 =====
    statRange: 'week',  // 'week' 本周 | 'month' 本月
    statPomoTime: 0,
    completedTargets: 0,
    targetCompleteRate: 0
  },

  onLoad() {
    this.setData({ currentDate: this.formatDate(new Date()) });
    this.loadDailyData(this.data.currentDate);
    this.loadStatsData('week');
  },

  onShow() {
    // 若需要实时刷新，可在此挂载
  },

  /** 
   * 顶部 Tab 切换
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  /** ================== 日记录模块 ================== */
  
  // 日期选择切换
  onDateChange(e) {
    const newDate = e.detail.value;
    this.setData({ currentDate: newDate });
    this.loadDailyData(newDate);
  },

  /**
   * 加载指定日期的日记录
   */
  async loadDailyData(dateStr) {
    if (!app.globalData.openid) return;
    this.setData({ loading: true });

    try {
      // 1. 解析日期范围
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59`);

      // 2. 查当天的专注明细
      const pomoRes = await db.collection('pomodoro').where({
        _openid: app.globalData.openid,
        status: 1,
        startTime: _.gte(startOfDay).and(_.lte(endOfDay))
      }).orderBy('startTime', 'desc').get();

      let totalFocus = 0;
      pomoRes.data.forEach(item => {
        totalFocus += (item.focusTime || 0);
        // 格式化展示时间，如 "14:30"
        item.displayTime = this.formatTimeOnly(item.startTime);
      });

      // 3. 查当日的心得总结
      const recordRes = await db.collection('daily_records').where({
        _openid: app.globalData.openid,
        dateStr: dateStr
      }).get();

      let summary = '';
      if (recordRes.data.length > 0) {
        summary = recordRes.data[0].dailySummary || '';
      }

      this.setData({
        totalPomoTime: totalFocus,
        pomoCount: pomoRes.data.length,
        pomodoroList: pomoRes.data,
        dailySummary: summary,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      console.error('[Load Daily Data Error]', err);
    }
  },

  onSummaryInput(e) {
    this.setData({ dailySummary: e.detail.value });
  },

  /**
   * 保存当日心得
   */
  async saveDailySummary() {
    const { currentDate, dailySummary, totalPomoTime, pomoCount } = this.data;
    wx.showLoading({ title: '保存中' });

    try {
      // 查询是否已有此日记录
      const existRes = await db.collection('daily_records').where({
        _openid: app.globalData.openid,
        dateStr: currentDate
      }).get();

      if (existRes.data.length > 0) {
        // 更新
        await db.collection('daily_records').doc(existRes.data[0]._id).update({
          data: {
            dailySummary: dailySummary,
            totalFocusTime: totalPomoTime,
            pomodoroCount: pomoCount,
            updatedAt: db.serverDate()
          }
        });
      } else {
        // 新增
        await db.collection('daily_records').add({
          data: {
            dateStr: currentDate,
            dailySummary: dailySummary,
            totalFocusTime: totalPomoTime,
            pomodoroCount: pomoCount,
            updatedAt: db.serverDate()
          }
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'error' });
      console.error('[Save Summary Error]', err);
    }
  },

  /** ================== 统计总结模块 ================== */

  switchStatRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ statRange: range });
    this.loadStatsData(range);
  },

  async loadStatsData(range) {
    if (!app.globalData.openid) return;
    this.setData({ loading: true });

    const now = new Date();
    let startDate = new Date();

    if (range === 'week') {
      const day = now.getDay() || 7; // 周一为1，周日为7
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 本月1号
    }
    // 归零时间限制
    startDate.setHours(0, 0, 0, 0);

    try {
      // 查询本周/本月的总专注时长
      const pomoRes = await db.collection('pomodoro').where({
        _openid: app.globalData.openid,
        status: 1,
        startTime: _.gte(startDate)
      }).get();

      let totalFocus = 0;
      pomoRes.data.forEach(item => {
        totalFocus += (item.focusTime || 0);
      });

      // 查询本时期的目标完成情况（只要是这期间完成的均算做本期成就）
      const targetResAll = await db.collection('targets').where({
        _openid: app.globalData.openid
      }).get();

      const allCount = targetResAll.data.length;
      let newlyCompletedThisPeriod = targetResAll.data.filter(t => t.status === 1 && t.updatedAt >= startDate).length;
      let overAllCompleted = targetResAll.data.filter(t => t.status === 1).length;
      
      // 整体完成率
      let completeRate = allCount === 0 ? 0 : Math.round((overAllCompleted / allCount) * 100);

      this.setData({
        statPomoTime: totalFocus,
        completedTargets: newlyCompletedThisPeriod,
        targetCompleteRate: completeRate,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      console.error('[Load Stats Error]', err);
    }
  },

  /** 工具函数：格式化 YYYY-MM-DD */
  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  
  /** 工具函数：格式化 HH:MM */
  formatTimeOnly(date) {
    if(!date) return '';
    const d = new Date(date);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
});