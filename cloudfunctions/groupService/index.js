// cloudfunctions/groupService/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, payload } = event;

  // 1. 获取用户加入的所有小组
  if (action === 'getUserGroups') {
    const listRes = await db.collection('group_members').where({ _openid: openid }).get();
    const groupIds = listRes.data.map(item => item.groupId);
    if (groupIds.length === 0) return { code: 0, data: [] };

    const groupsRes = await db.collection('groups').where({
      _id: _.in(groupIds)
    }).get();
    return { code: 0, data: groupsRes.data };
  }

  // 2. 创建小组
  if (action === 'createGroup') {
    const { name, description } = payload;
    // 随机生成 6 位大写字母+数字的小组邀请码，这里简化直接用插入后的 _id 或者自定义短码
    const shortCode = Math.random().toString(36).substr(2, 6).toUpperCase(); 
    
    const addRes = await db.collection('groups').add({
      data: {
        _id: shortCode, // 使用短码作为_id方便搜索
        name,
        description: description || '',
        creatorId: openid,
        memberCount: 1,
        createdAt: db.serverDate()
      }
    });

    await db.collection('group_members').add({
      data: {
        groupId: shortCode,
        _openid: openid,
        role: 'owner',
        joinTime: db.serverDate()
      }
    });

    return { code: 0, data: { groupId: shortCode } };
  }

  // 3. 加入小组
  if (action === 'joinGroup') {
    const { groupId } = payload;
    const groupRes = await db.collection('groups').doc(groupId).get().catch(() => null);
    if (!groupRes || !groupRes.data) {
      return { code: -1, msg: '找不到该小组码对应的小组' };
    }

    const checkExist = await db.collection('group_members').where({
      groupId,
      _openid: openid
    }).count();

    if (checkExist.total > 0) {
      return { code: -1, msg: '您已经加入了该小组' };
    }

    await db.collection('group_members').add({
      data: {
        groupId,
        _openid: openid,
        role: 'member',
        joinTime: db.serverDate()
      }
    });

    await db.collection('groups').doc(groupId).update({
      data: { memberCount: _.inc(1) }
    });

    return { code: 0, msg: '加入成功', data: { groupId } };
  }

  // 4. 获取小组详情、成员状态及互动消息
  if (action === 'getGroupDetail') {
    const { groupId } = payload;
    const groupRes = await db.collection('groups').doc(groupId).get();
    const groupInfo = groupRes.data;

    const membersRes = await db.collection('group_members').where({ groupId }).get();
    const membersList = membersRes.data;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = now.getDay() || 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);

    const memberStats = await Promise.all(membersList.map(async (m) => {
      const userRes = await db.collection('users').where({ _openid: m._openid }).get();
      const userInfo = userRes.data[0] || {};

      const pomoRes = await db.collection('pomodoro').where({
        _openid: m._openid,
        status: 1,
        startTime: _.gte(weekStart)
      }).get();

      let todayFocusTime = 0;
      let weekFocusTime = 0;
      
      pomoRes.data.forEach(item => {
        weekFocusTime += item.focusTime;
        if (item.startTime >= todayStart) {
          todayFocusTime += item.focusTime;
        }
      });

      const targetRes = await db.collection('targets').where({
        _openid: m._openid,
        status: 1
      }).get();

      return {
        _openid: m._openid,
        memberId: m._id,
        role: m.role,
        nickName: userInfo.nickName || '微信匿名用户',
        avatarUrl: userInfo.avatarUrl || '',
        todayFocusTime,
        weekFocusTime,
        completedTargetsCount: targetRes.data.length,
        likes: m.likes || 0
      };
    }));

    const msgRes = await db.collection('group_messages').where({ groupId })
      .orderBy('createdAt', 'desc').limit(15).get().catch(() => ({data:[]}));

    return {
      code: 0,
      data: {
        groupInfo,
        members: memberStats,
        messages: msgRes.data
      }
    };
  }

  // 5. 退出小组
  if (action === 'quitGroup') {
    const { groupId } = payload;
    await db.collection('group_members').where({ groupId, _openid: openid }).remove();
    await db.collection('groups').doc(groupId).update({ data: { memberCount: _.inc(-1) } });
    return { code: 0, msg: '已退出' };
  }

  // 6. 点赞成员
  if (action === 'likeMember') {
    const { memberDocId } = payload;
    await db.collection('group_members').doc(memberDocId).update({ data: { likes: _.inc(1) } });
    return { code: 0 };
  }

  // 7. 发送鼓励留言
  if (action === 'sendMessage') {
    const { groupId, toName, content, fromName } = payload;
    await db.collection('group_messages').add({
      data: { groupId, fromName, toName, content, createdAt: db.serverDate() }
    });
    return { code: 0 };
  }

  return { code: -99, msg: 'Unknown action' };
};