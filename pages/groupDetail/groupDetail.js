// pages/groupDetail/groupDetail.js
const app = getApp();

Page({
  data: {
    groupId: '',
    groupInfo: null,
    members: [],
    messages: [], // 新增: 留言墙
    loading: true,

    sortType: 'today', // 新增: 排行维度切换 'today' | 'week'
    currentUserNickName: '', 

    showMsgModal: false,
    msgContent: '',
    targetMemberNick: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ 
        groupId: options.id,
        currentUserNickName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '某组员'
      });
      this.loadGroupDetail();
    }
  },

  onPullDownRefresh() {
    this.loadGroupDetail().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadGroupDetail() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'groupService',
        data: {
          action: 'getGroupDetail',
          payload: { groupId: this.data.groupId }
        }
      });
      
      if (res.result.code === 0) {
        let members = res.result.data.members;
        this.setData({
          groupInfo: res.result.data.groupInfo,
          members: this.sortMembers(members, this.data.sortType),
          messages: res.result.data.messages || [],
          loading: false
        });
      }
    } catch (err) {
      this.setData({ loading: false });
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  switchSort(e) {
    const sortType = e.currentTarget.dataset.type;
    this.setData({ sortType });
    this.setData({ members: this.sortMembers(this.data.members, sortType) });
  },

  sortMembers(members, type) {
    return members.sort((a, b) => {
      if (type === 'today') return b.todayFocusTime - a.todayFocusTime;
      return b.weekFocusTime - a.weekFocusTime;
    });
  },

  // === 互动: 点赞 === 
  async onLike(e) {
    const idx = e.currentTarget.dataset.index;
    const memberDocId = this.data.members[idx].memberId;
    wx.vibrateShort();
    
    // 乐观UI更新
    const key = `members[${idx}].likes`;
    this.setData({ [key]: this.data.members[idx].likes + 1 });

    try {
      await wx.cloud.callFunction({
        name: 'groupService',
        data: { action: 'likeMember', payload: { memberDocId } }
      });
    } catch (err) { }
  },

  // === 互动: 留言 ===
  openMessageModal(e) {
    const toName = e.currentTarget.dataset.name;
    this.setData({ showMsgModal: true, targetMemberNick: toName, msgContent: '' });
  },
  closeMsgModal() { this.setData({ showMsgModal: false }); },
  onMsgInput(e) { this.setData({ msgContent: e.detail.value }); },

  async sendEncourageMsg() {
    if (!this.data.msgContent.trim()) return wx.showToast({ title: '想说点什么呢?', icon: 'none' });
    wx.showLoading({ title: '发送中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'groupService',
        data: { 
          action: 'sendMessage', 
          payload: { 
            groupId: this.data.groupId,
            toName: this.data.targetMemberNick,
            fromName: this.data.currentUserNickName,
            content: this.data.msgContent
          } 
        }
      });
      wx.hideLoading();
      if (res.result.code === 0) {
        wx.showToast({ title: '已发送' });
        this.closeMsgModal();
        this.loadGroupDetail(); 
      }
    } catch (err) { }
  },

  copyGroupId() {
    wx.setClipboardData({
      data: this.data.groupId,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    });
  },

  quitGroup() {
    wx.showModal({
      title: '退出小组',
      content: '确定要退出该学习小组吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' });
          try {
            const quitRes = await wx.cloud.callFunction({
              name: 'groupService',
              data: {
                action: 'quitGroup',
                payload: { groupId: this.data.groupId }
              }
            });
            wx.hideLoading();
            if (quitRes.result.code === 0) {
              wx.showToast({ title: '已退出' });
              setTimeout(() => { wx.navigateBack(); }, 1000);
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '网络异常', icon: 'error' });
          }
        }
      }
    });
  }
});