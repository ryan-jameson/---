// pages/login/login.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    isLoading: true, // 控制页面初次打开时的加载状态
  },

  onLoad() {
    this.checkLoginStatus();
  },

  /**
   * 1. 自动登录逻辑：通过云函数静默获取 openid，查库判断是否已注册
   */
  async checkLoginStatus() {
    wx.showLoading({ title: '加载中...', mask: true });
    try {
      // 步骤A: 调用云函数获取用户 openid
      const res = await wx.cloud.callFunction({
        name: 'login'
      });
      const openid = res.result.openid;
      app.globalData.openid = openid;

      // 步骤B: 查询 users 集合中是否已有当前用户
      const userRes = await db.collection('users').where({
        _openid: openid
      }).get();

      wx.hideLoading();

      if (userRes.data.length > 0) {
        // 用户已存在，存入全局变量并直接跳转到首页
        app.globalData.userInfo = userRes.data[0];
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        // 用户未注册，取消 Loading，展示授权按钮
        this.setData({ isLoading: false });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isLoading: false });
      console.error('[登录检查失败]:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'error' });
    }
  },

  /**
   * 2. 用户点击登录：微信已废弃 wx.getUserProfile 接口。
   * 此处修改为：直接创建默认用户记录，或提供给用户基础信息即可跳转。
   */
  async handleAuthLogin() {
    wx.showLoading({ title: '注册中...', mask: true });
    try {
      // 默认用户信息，由于微信限制不再直接弹窗获取真实头像昵称
      const userInfo = {
        nickName: '微信用户',
        avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
      };

      // 步骤C: 将新用户信息保存到云数据库 users 集合
      const addRes = await db.collection('users').add({
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });

      // 更新全局变量并跳转首页
      app.globalData.userInfo = {
        _id: addRes._id,
        _openid: app.globalData.openid,
        ...userInfo
      };

      wx.hideLoading();
      wx.showToast({ title: '登录成功' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);

    } catch (dbErr) {
      wx.hideLoading();
      console.error('[数据保存失败]:', dbErr);
      wx.showToast({ title: '保存失败，请重试', icon: 'error' });
    }
  }
});