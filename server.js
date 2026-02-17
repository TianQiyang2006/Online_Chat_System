const express = require('express');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = config.port;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const defaultData = {
  messages: [],
  userSettings: [],
  onlineUsers: [],
  intimateScore: { user1_id: 1, user2_id: 2, score: 0 },
  relationship: {
    startDate: '2025-02-16',
    anniversaryText: '相恋'
  },
  notificationSettings: {
    user2OnlineEmail: null
  }
};

const adapter = new JSONFile('./data/db.json');
const db = new Low(adapter, defaultData);

async function initDatabase() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
  console.log('数据库初始化成功');
}

initDatabase();

let onlineUsers = {};
let emailSentCache = {};
let lastHeartAnimation = null;
let heartAnimationTimestamp = 0;
let previousUser2Online = false;
let user2OnlineEmailCache = {};

function sendEmailAlert(content, senderName) {
  if (!config.email.auth.user || !config.email.auth.pass) {
    console.log('邮件未配置，跳过发送');
    return;
  }

  const cacheKey = crypto.createHash('md5')
    .update(`${senderName}:${content}`)
    .digest('hex');
  
  if (emailSentCache[cacheKey]) {
    console.log('邮件已发送，跳过重复发送');
    return;
  }
  emailSentCache[cacheKey] = true;
  setTimeout(() => delete emailSentCache[cacheKey], 60000);

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.auth
  });

  const mailOptions = {
    from: config.email.auth.user,
    to: config.email.recipient,
    subject: '收到新消息！',
    text: `${senderName} 发来新消息：\n\n${content}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('邮件发送失败:', error);
    } else {
      console.log('邮件发送成功:', info.response);
    }
  });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === config.admin.username && password === config.admin.password) {
    req.session.user = { id: 0, username: username, isAdmin: true, displayName: '管理员' };
    return res.json({ success: true, user: req.session.user, isAdmin: true });
  }

  const user = config.users.find(u => u.username === username && u.password === password);
  if (user) {
    const wasOnline = !!onlineUsers[user.id];
    req.session.user = { id: user.id, username: user.username, displayName: user.displayName };
    onlineUsers[user.id] = Date.now();
    
    if (user.id === 2 && !wasOnline && !previousUser2Online) {
      (async () => {
        try {
          await db.read();
          const notificationEmail = db.data.notificationSettings?.user2OnlineEmail;
          
          if (notificationEmail) {
            const cacheKey = `user2-online-${Date.now()}`;
            if (!user2OnlineEmailCache[cacheKey]) {
              console.log('user2上线了，准备发送邮件通知到:', notificationEmail);
              sendUser2OnlineEmail(notificationEmail);
              user2OnlineEmailCache[cacheKey] = true;
              setTimeout(() => delete user2OnlineEmailCache[cacheKey], 300000);
            }
          }
        } catch (e) {
          console.error('发送上线通知邮件时出错:', e);
        }
      })();
    }
    
    previousUser2Online = !!onlineUsers[2];
    return res.json({ success: true, user: req.session.user, isAdmin: false });
  }

  res.json({ success: false, message: '用户名或密码错误' });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/logout', (req, res) => {
  if (req.session.user) {
    delete onlineUsers[req.session.user.id];
  }
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/messages', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }
  await db.read();
  res.json(db.data.messages);
});

app.post('/api/messages', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }

  const { content } = req.body;
  const senderId = req.session.user.id;
  const receiverId = senderId === 1 ? 2 : 1;

  const message = {
    id: Date.now(),
    sender_id: senderId,
    receiver_id: receiverId,
    content: content,
    timestamp: new Date().toISOString(),
    is_read: 0,
    likes: 0
  };

  await db.read();
  db.data.messages.push(message);
  await db.write();

  const otherUserId = senderId === 1 ? 2 : 1;
  if (!onlineUsers[otherUserId]) {
    const senderName = config.users.find(u => u.id === senderId)?.displayName || '某人';
    sendEmailAlert(content, senderName);
  }

  updateIntimateScore();
  res.json(message);
});

app.put('/api/messages/:id/read', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }

  await db.read();
  const msg = db.data.messages.find(m => m.id == req.params.id);
  if (msg) {
    msg.is_read = 1;
    await db.write();
  }
  res.json({ success: true });
});

app.post('/api/messages/:id/like', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }

  await db.read();
  const msg = db.data.messages.find(m => m.id == req.params.id);
  if (msg) {
    msg.likes = (msg.likes || 0) + 1;
    await db.write();
  }
  res.json({ success: true });
});

app.get('/api/online-status', (req, res) => {
  const status = {};
  config.users.forEach(user => {
    status[user.id] = !!onlineUsers[user.id];
  });
  res.json(status);
});

app.post('/api/heartbeat', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }
  
  const userId = req.session.user.id;
  const wasOnline = !!onlineUsers[userId];
  onlineUsers[userId] = Date.now();
  
  if (userId === 2 && !wasOnline && !previousUser2Online) {
    await db.read();
    const notificationEmail = db.data.notificationSettings?.user2OnlineEmail;
    
    if (notificationEmail) {
      const cacheKey = `user2-online-${Date.now()}`;
      if (!user2OnlineEmailCache[cacheKey]) {
        sendUser2OnlineEmail(notificationEmail);
        user2OnlineEmailCache[cacheKey] = true;
        setTimeout(() => delete user2OnlineEmailCache[cacheKey], 300000);
      }
    }
  }
  
  previousUser2Online = !!onlineUsers[2];
  res.json({ success: true });
});

function sendUser2OnlineEmail(toEmail) {
  console.log('=== 开始发送上线通知邮件 ===');
  console.log('收件人:', toEmail);
  console.log('发件人配置:', config.email.auth.user ? '已配置' : '未配置');
  
  if (!config.email.auth.user || !config.email.auth.pass) {
    console.log('❌ 邮件未配置，跳过发送上线通知');
    return;
  }

  console.log('SMTP配置:', {
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure
  });

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.auth
  });

  const mailOptions = {
    from: config.email.auth.user,
    to: toEmail,
    subject: '💕 她上线啦！',
    text: `亲爱的，你的女朋友刚刚上线了！快去和她聊天吧～ 💖\n\n-- 来自在线聊天系统`
  };

  console.log('邮件内容准备完成，正在发送...');

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ 上线通知邮件发送失败:', error);
      console.error('错误详情:', error.response || error.message);
    } else {
      console.log('✅ 上线通知邮件发送成功!');
      console.log('服务器响应:', info.response);
    }
  });
}

app.get('/api/settings/:userId', async (req, res) => {
  await db.read();
  const settings = db.data.userSettings.find(s => s.user_id == req.params.userId);
  res.json(settings || {});
});

app.put('/api/settings/:userId', async (req, res) => {
  if (!req.session.user || req.session.user.id != req.params.userId) {
    return res.status(403).json({ error: '无权限' });
  }
  
  const { background_url, display_name, avatar, login_username, login_password } = req.body;
  
  await db.read();
  let settings = db.data.userSettings.find(s => s.user_id == req.params.userId);
  if (!settings) {
    settings = { user_id: parseInt(req.params.userId) };
    db.data.userSettings.push(settings);
  }
  settings.background_url = background_url || null;
  settings.display_name = display_name || null;
  settings.avatar = avatar || null;
  await db.write();
  
  if (login_username || login_password) {
    const userIndex = config.users.findIndex(u => u.id == req.params.userId);
    if (userIndex !== -1) {
      if (login_username) config.users[userIndex].username = login_username;
      if (login_password) config.users[userIndex].password = login_password;
    }
  }
  
  res.json({ success: true });
});

app.get('/api/intimate-score', async (req, res) => {
  await db.read();
  res.json({ score: db.data.intimateScore.score || 0 });
});

app.post('/api/heart-animation', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登录' });
  }
  const senderName = config.users.find(u => u.id === req.session.user.id)?.displayName || '某人';
  lastHeartAnimation = {
    senderId: req.session.user.id,
    senderName: senderName,
    timestamp: Date.now()
  };
  heartAnimationTimestamp = Date.now();
  res.json({ success: true });
});

app.get('/api/heart-animation', (req, res) => {
  const timestamp = parseInt(req.query.timestamp) || 0;
  if (heartAnimationTimestamp > timestamp) {
    res.json({
      hasNew: true,
      animation: lastHeartAnimation,
      latestTimestamp: heartAnimationTimestamp
    });
  } else {
    res.json({
      hasNew: false,
      latestTimestamp: heartAnimationTimestamp
    });
  }
});

async function updateIntimateScore() {
  await db.read();
  db.data.intimateScore.score = (db.data.intimateScore.score || 0) + 1;
  await db.write();
}

app.get('/api/config', async (req, res) => {
  await db.read();
  
  const usersWithSettings = config.users.map(user => {
    const settings = db.data.userSettings.find(s => s.user_id === user.id);
    return {
      ...user,
      displayName: settings?.display_name || user.displayName,
      avatar: settings?.avatar || user.avatar
    };
  });
  
  res.json({
    users: usersWithSettings,
    admin: config.admin,
    loveQuotes: config.loveQuotes,
    stickers: config.stickers,
    relationship: db.data.relationship,
    firstMessageTime: db.data.messages.length > 0 ? db.data.messages[0].timestamp : null
  });
});

app.get('/api/relationship', async (req, res) => {
  await db.read();
  res.json(db.data.relationship);
});

app.get('/api/notification-settings', async (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: '无权限' });
  }
  await db.read();
  res.json({
    user2OnlineEmail: db.data.notificationSettings?.user2OnlineEmail || null
  });
});

app.put('/api/notification-settings', async (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: '无权限' });
  }
  const { user2OnlineEmail } = req.body;
  await db.read();
  if (!db.data.notificationSettings) {
    db.data.notificationSettings = {};
  }
  db.data.notificationSettings.user2OnlineEmail = user2OnlineEmail || null;
  await db.write();
  res.json({ success: true });
});

app.get('/api/test-email', async (req, res) => {
  try {
    console.log('开始测试邮件发送...');
    await db.read();
    const testEmail = db.data.notificationSettings?.user2OnlineEmail || '19048320136@163.com';
    console.log('测试收件邮箱:', testEmail);
    
    sendUser2OnlineEmail(testEmail);
    res.json({ success: true, message: '测试邮件已尝试发送，请查看邮箱和服务器日志' });
  } catch (e) {
    console.error('测试邮件发送错误:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/relationship', async (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: '无权限' });
  }
  const { startDate, anniversaryText } = req.body;
  await db.read();
  if (startDate) db.data.relationship.startDate = startDate;
  if (anniversaryText) db.data.relationship.anniversaryText = anniversaryText;
  await db.write();
  res.json({ success: true });
});

app.put('/api/admin/users', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: '无权限' });
  }

  const { users, admin } = req.body;
  if (users) config.users = users;
  if (admin) config.admin = admin;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
