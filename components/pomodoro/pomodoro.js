// components/pomodoro/pomodoro.js
const db = wx.cloud.database();
const app = getApp();

Component({
  properties: {
    focusLength: { type: Number, value: 25 }, // 默认专注时长(分钟)
    restLength: { type: Number, value: 5 }    // 默认休息时长(分钟)
  },

  data: {
    status: 'idle', // 'idle'未开始, 'focusing'专注中, 'paused'已暂停, 'resting'休息中
    remainSeconds: 25 * 60,
    timeDisplay: '25:00',
    timerId: null,

    // 表单数据
    focusContent: '',
    selectedTargetIndex: -1,
    targets: [],
    
    // 记录运行时的数据
    startTime: null
  },

  lifetimes: {
    attached() {
      this.initTimer();
      this.fetchTargets();
    },
    detached() {
      this.clearTimer();
    }
  },

  methods: {
    initTimer() {
      this.setData({
        remainSeconds: this.data.focusLength * 60,
        timeDisplay: this.formatTime(this.data.focusLength * 60),
        status: 'idle'
      });
    },

    formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    },

    // 获取阶段目标/终极目标供用户选择
    async fetchTargets() {
      try {
        const res = await db.collection('targets').where({
          _openid: app.globalData.openid,
          status: 0 // 寻找进行中的目标
        }).get();
        this.setData({ targets: res.data });
      } catch (err) {
        console.error('[Load Targets Error]', err);
      }
    },

    onTargetChange(e) {
      this.setData({ selectedTargetIndex: e.detail.value });
    },

    onContentInput(e) {
      this.setData({ focusContent: e.detail.value });
    },

    startFocus() {
      // 若尚未登录（无_openid），可以这里拦截
      if (!app.globalData.openid) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      this.setData({ 
        status: 'focusing', 
        startTime: new Date()
      });
      // 防止重复多次开定时器
      this.clearTimer();
      const timerId = setInterval(this.tick.bind(this), 1000);
      this.setData({ timerId });
    },

    pauseTimer() {
      this.clearTimer();
      this.setData({ status: 'paused' });
    },

    resumeTimer() {
      this.setData({ status: 'focusing' });
      // 防止重复多次开定时器
      this.clearTimer();
      const timerId = setInterval(this.tick.bind(this), 1000);
      this.setData({ timerId });
    },

    // 取消专注/提前结速（作为放弃处理）
    resetFocus() {
      wx.showModal({
        title: '终止番茄',
        content: '提前结束将不会记录本次专注时长，确认放弃吗？',
        success: (res) => {
          if (res.confirm) {
            this.clearTimer();
            // 在此可选择性增加【放弃记录】的功能，目前只将其清空
            this.initTimer();
          }
        }
      });
    },

    tick() {
      let remain = this.data.remainSeconds;
      if (remain <= 0) {
        this.clearTimer();
        if (this.data.status === 'focusing') {
          this.handleFocusComplete();
        } else if (this.data.status === 'resting') {
          this.handleRestComplete();
        }
        return;
      }
      remain -= 1;
      this.setData({
        remainSeconds: remain,
        timeDisplay: this.formatTime(remain)
      });
    },

    clearTimer() {
      if (this.data.timerId) {
        clearInterval(this.data.timerId);
        this.setData({ timerId: null });
      }
    },

    // 专注倒计时结束
    async handleFocusComplete() {
      // 震动提醒
      wx.vibrateLong();

      // 构建要保存的记录
      const target = this.data.selectedTargetIndex >= 0 
                     ? this.data.targets[this.data.selectedTargetIndex] 
                     : null;

      const record = {
        targetId: target ? target._id : null,
        focusTime: this.data.focusLength,  // 保存默认设定的时长度 (比如25min)
        content: this.data.focusContent,
        status: 1, // 成功完成
        startTime: this.data.startTime,
        endTime: new Date(),
        createdAt: db.serverDate()
      };

      try {
        wx.showLoading({ title: '保存记录中' });
        // 保存专注记录
        await db.collection('pomodoro').add({ data: record });
        wx.hideLoading();
        
        // 提示休息并进入休息倒计时
        wx.showModal({
          title: '恭喜完成一个番茄！',
          content: '您的专注记录已保存。现在开始 5 分钟的休息吧',
          showCancel: false,
          success: () => {
             // 切换到休息模式
             this.startRest();
          }
        });

      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '记录保存失败', icon: 'error' });
        console.error('[Save Pomodoro Error]', err);
      }
    },

    startRest() {
      this.setData({
        status: 'resting',
        remainSeconds: this.data.restLength * 60,
        timeDisplay: this.formatTime(this.data.restLength * 60)
      });
      const timerId = setInterval(this.tick.bind(this), 1000);
      this.setData({ timerId });
    },

    skipRest() {
      this.clearTimer();
      this.initTimer(); // 回到初始状态，供下个番茄使用
      wx.showToast({ title: '已跳过休息', icon: 'none' });
    },

    handleRestComplete() {
      wx.vibrateLong();
      wx.showModal({
        title: '休息结束',
        content: '休息完毕！准备好开始下一个番茄钟了吗？',
        showCancel: false,
        success: () => {
          this.initTimer();
        }
      });
    }
  }
});