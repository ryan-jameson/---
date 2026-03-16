// app.js
App({
  onLaunch: function () {
    // 1. 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // TODO: 填入你的云开发环境 ID
        // env: 'your-env-id',
        traceUser: true, // 记录用户访问
      });
    }

    // 2. 监听系统主题变化 (深色/浅色模式)
    wx.onThemeChange((res) => {
      this.globalData.theme = res.theme;
    });
  },

  // 全局共享数据
  globalData: {
    userInfo: null,     // 存储用户基本信息 (头像、昵称)
    openid: null,       // 用户唯一标识
    theme: 'light',     // 当前主题
    currentTimer: null  // 可以用来在全局存储当前番茄钟的状态（如有需要后台跨页面保持）
  }
});