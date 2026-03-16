// pages/group/group.js
const app = getApp();

Page({
  data: {
    groups: [],
    loading: true,

    showModal: false,
    modalType: 'join', // 'join' 或是 'create'
    joinCode: '',
    createName: '',
    createDesc: ''
  },

  onShow() {
    this.fetchMyGroups();
  },

  async fetchMyGroups() {
    if (!app.globalData.openid) return;
    this.setData({ loading: true });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'groupService',
        data: { action: 'getUserGroups' }
      });
      
      if (res.result.code === 0) {
        this.setData({ groups: res.result.data });
      }
      this.setData({ loading: false });
    } catch (err) {
      this.setData({ loading: false });
      console.error(err);
    }
  },

  navToDetail(e) {
    const groupId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/groupDetail/groupDetail?id=${groupId}`
    });
  },

  // 弹窗逻辑
  openJoinModal() {
    this.setData({ showModal: true, modalType: 'join', joinCode: '' });
  },
  openCreateModal() {
    this.setData({ showModal: true, modalType: 'create', createName: '', createDesc: '' });
  },
  closeModal() {
    this.setData({ showModal: false });
  },

  onCodeInput(e) { this.setData({ joinCode: e.detail.value.trim().toUpperCase() }); },
  onNameInput(e) { this.setData({ createName: e.detail.value }); },
  onDescInput(e) { this.setData({ createDesc: e.detail.value }); },

  async submitModal() {
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      if (this.data.modalType === 'join') {
        if (!this.data.joinCode) return wx.showToast({ title: '请输入小组码', icon: 'none' });
        const res = await wx.cloud.callFunction({
          name: 'groupService',
          data: { action: 'joinGroup', payload: { groupId: this.data.joinCode } }
        });
        wx.hideLoading();
        if (res.result.code === 0) {
          wx.showToast({ title: '加入成功' });
          this.closeModal();
          this.fetchMyGroups();
        } else {
          wx.showToast({ title: res.result.msg, icon: 'none' });
        }
      } else {
        if (!this.data.createName) return wx.showToast({ title: '请输入名称', icon: 'none' });
        const res = await wx.cloud.callFunction({
          name: 'groupService',
          data: { action: 'createGroup', payload: { name: this.data.createName, description: this.data.createDesc } }
        });
        wx.hideLoading();
        if (res.result.code === 0) {
          wx.showToast({ title: '创建成功' });
          this.closeModal();
          this.fetchMyGroups();
        }
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'error' });
    }
  }
});