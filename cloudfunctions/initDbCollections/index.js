// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 所有需要创建的集合名称
const collections = [
  'users',
  'targets',
  'pomodoro',
  'groups',
  'group_members',
  'daily_records'
]

// 云函数入口函数
exports.main = async (event, context) => {
  const result = { success: [], failed: [] }
  
  for (let col of collections) {
    try {
      // 检查集合是否已存在
      await db.collection(col).limit(1).get()
      result.failed.push({ collection: col, error: 'Collection already exists' })
    } catch (e) {
      if (e.message.includes('not exist')) {
        // 创建集合
        try {
          await db.createCollection(col)
          result.success.push(col)
        } catch (createErr) {
          result.failed.push({ collection: col, error: createErr.message })
        }
      } else {
        result.failed.push({ collection: col, error: e.message })
      }
    }
  }

  return {
    code: 0,
    message: '数据库初始化完毕',
    data: result
  }
}