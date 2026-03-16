// pages/index/index.js
const app = getApp()

Page({
  data: {
    
  },
  
  onLoad() {
    // 页面加载时的逻辑
  },
  
  onShow() {
    // 每次显示页面(如切换tabbar回来时)可刷新目标列表等
    const pomodoroComp = this.selectComponent('pomodoro-clock');
    if (pomodoroComp) {
      // 触发组件内方法重新获取目标
      pomodoroComp.fetchTargets();
    }
  }
})