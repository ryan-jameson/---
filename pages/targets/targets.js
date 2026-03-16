// pages/targets/targets.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    targets: [],
    showModal: false,
    modalType: 'add', // 'add' 新增 | 'edit' 编辑
    loading: false,

    // 表单数据
    formData: {
      _id: '',
      title: '',
      type: 'stage', // 默认阶段性目标 'stage', 终极目标 'ultimate'
      deadline: ''
    },
    
    // 供选择的目标类型
    typeOptions: [
      { name: '阶段性目标', value: 'stage', checked: true },
      { name: '终极目标', value: 'ultimate', checked: false }
    ]
  },

  onShow() {
    // 每次进入页面时拉取最新数据
    this.loadTargets();
  },

  /**
   * 拉取登录用户的目标列表
   */
  async loadTargets() {
    if (!app.globalData.openid) return;
    this.setData({ loading: true });
    
    try {
      // 查询属于当前用户的所有目标，按创建时间自新到旧排序
      const res = await db.collection('targets').where({
        _openid: app.globalData.openid
      }).orderBy('createdAt', 'desc').get();
      
      this.setData({ 
        targets: res.data,
        loading: false 
      });
    } catch (err) {
      this.setData({ loading: false });
      console.error('[Load Targets Error]', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 变更目标状态 (完成1 / 未完成0)
   */
  async toggleStatus(e) {
    const index = e.currentTarget.dataset.index;
    const target = this.data.targets[index];
    const newStatus = target.status === 1 ? 0 : 1;

    try {
      wx.showLoading({ title: '更新中', mask: true });
      await db.collection('targets').doc(target._id).update({
        data: {
          status: newStatus,
          updatedAt: db.serverDate()
        }
      });
      wx.hideLoading();
      
      // 局部刷新页面数据
      this.setData({
        [`targets[${index}].status`]: newStatus
      });
    } catch (err) {
      wx.hideLoading();
      console.error('[Toggle Status Error]', err);
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  /**
   * 删除目标
   */
  deleteTarget(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认',
      content: '确定要删除这个目标吗？相关番茄钟记录仍会保留。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' });
          try {
            await db.collection('targets').doc(id).remove();
            wx.hideLoading();
            wx.showToast({ title: '删除成功' });
            this.loadTargets(); // 重新加载列表
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  /**
   * 弹窗/表单交互
   */
  openAddModal() {
    this.setData({
      showModal: true,
      modalType: 'add',
      formData: {
        _id: '',
        title: '',
        type: 'stage',
        deadline: this.getTodayDate()
      }
    });
    this.refreshTypeOptions('stage');
  },

  openEditModal(e) {
    const target = e.currentTarget.dataset.target;
    this.setData({
      showModal: true,
      modalType: 'edit',
      formData: {
        _id: target._id,
        title: target.title,
        type: target.type,
        deadline: target.deadline || ''
      }
    });
    this.refreshTypeOptions(target.type);
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  // 表单双向绑定处理
  onTitleInput(e) {
    this.setData({ 'formData.title': e.detail.value });
  },
  onTypeChange(e) {
    this.setData({ 'formData.type': e.detail.value });
  },
  onDateChange(e) {
    this.setData({ 'formData.deadline': e.detail.value });
  },

  refreshTypeOptions(currentType) {
    const options = this.data.typeOptions.map(item => ({
      ...item,
      checked: item.value === currentType
    }));
    this.setData({ typeOptions: options });
  },

  getTodayDate() {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  },

  /**
   * 保存/更新目标
   */
  async saveTarget() {
    const { _id, title, type, deadline } = this.data.formData;
    
    if (!title.trim()) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中', mask: true });
    try {
      const dbData = {
        title: title.trim(),
        type: type,
        deadline: deadline,
        status: 0, // 新增和修改如果不改状态，就保留，或者此处只在新增给0
        updatedAt: db.serverDate()
      };

      if (this.data.modalType === 'add') {
        // 新增操作
        dbData.createdAt = db.serverDate();
        await db.collection('targets').add({ data: dbData });
      } else {
        // 更新操作
        delete dbData.status; // 更新时不修改原有完成状态
        await db.collection('targets').doc(_id).update({ data: dbData });
      }

      wx.hideLoading();
      this.closeModal();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.loadTargets();
    } catch (err) {
      wx.hideLoading();
      console.error('[Save Target Error]', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  }
});