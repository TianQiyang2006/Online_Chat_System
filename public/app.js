let currentUser = null;
let usersConfig = [];
let config = { admin: {}, relationship: {} };
let loveQuotes = [];
let stickers = [];
let messages = [];
let previousOnlineStatus = {};
let lastMessageCount = 0;
let selectedAvatar = null;
let firstMessageTime = null;
let lastHeartAnimationTimestamp = 0;
let isFirstLoad = true;
let hasNewMessage = false;

const avatarOptions = [
  '👨', '👩', '🧑', '👦', '👧', '🧒', '👶', '🧔', '👱', '👴',
  '👵', '🧓', '👲', '🧕', '👳', '👷', '👮', '🕵️', '💂', '🥷',
  '👨‍⚕️', '👩‍⚕️', '👨‍🎓', '👩‍🎓', '👨‍🏫', '👩‍🏫', '👨‍⚖️', '👩‍⚖️', '👨‍🌾', '👩‍🌾',
  '👨‍🍳', '👩‍🍳', '👨‍🔧', '👩‍🔧', '👨‍🏭', '👩‍🏭', '👨‍💼', '👩‍💼', '👨‍🔬', '👩‍🔬',
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋',
  '🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
  '🦊', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🦄',
  '🌸', '🌺', '🌹', '🌷', '🌻', '🌼', '💐', '🍀', '🌿', '🍃',
  '✨', '🌟', '⭐', '💫', '🌙', '☀️', '🌈', '🔥', '💎', '🎀'
];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  
  const path = window.location.pathname;
  
  if (path === '/' || path === '/login.html') {
    initLoginPage();
  } else if (path === '/chat.html') {
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }
    initChatPage();
  } else if (path === '/settings.html') {
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }
    initSettingsPage();
  } else if (path === '/admin.html') {
    if (!currentUser || !currentUser.isAdmin) {
      window.location.href = '/login.html';
      return;
    }
    initAdminPage();
  }
});

async function checkAuth() {
  try {
    const res = await fetch('/api/check-auth');
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data.user;
    }
  } catch (e) {
    console.error(e);
  }
}

function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        currentUser = data.user;
        if (data.isAdmin) {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/chat.html';
        }
      } else {
        document.getElementById('errorMsg').textContent = data.message;
      }
    } catch (e) {
      document.getElementById('errorMsg').textContent = '登录失败，请稍后重试';
    }
  });
}

async function initChatPage() {
  await loadConfig();
  loadUserSettings();
  renderUserList();
  loadMessages();
  loadLoveQuote();
  renderStickers();
  updateIntimateScore();

  setInterval(() => fetch('/api/heartbeat', { method: 'POST' }), 60000);
  setInterval(loadMessages, 3000);
  setInterval(checkOnlineStatus, 5000);
  setInterval(checkHeartAnimation, 1000);

  const messageForm = document.getElementById('messageForm');
  messageForm.addEventListener('submit', sendMessage);

  const messageInput = document.getElementById('messageInput');
  messageInput.addEventListener('input', autoResizeTextarea);
  messageInput.addEventListener('keydown', handleMessageKeydown);
  autoResizeTextarea();

  document.getElementById('settingsBtn').addEventListener('click', () => {
    window.location.href = '/settings.html';
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.getElementById('stickerBtn').addEventListener('click', () => {
    document.getElementById('stickerPanel').classList.toggle('hidden');
  });

  document.getElementById('heartBtn').addEventListener('click', sendHeartAnimation);

  document.getElementById('sendQuoteBtn').addEventListener('click', () => {
    const quote = document.getElementById('loveQuote').textContent;
    if (quote) {
      sendMessageText(quote);
    }
  });
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    usersConfig = data.users;
    config.admin = data.admin || {};
    config.relationship = data.relationship || {};
    loveQuotes = data.loveQuotes;
    stickers = data.stickers;
    firstMessageTime = data.firstMessageTime;
    renderUserList();
    updateRelationshipInfo();
  } catch (e) {
    console.error(e);
  }
}

async function loadUserSettings() {
  try {
    const res = await fetch(`/api/settings/${currentUser.id}`);
    const settings = await res.json();
    
    if (settings.background_url) {
      const container = document.getElementById('messagesContainer');
      container.classList.add('custom-bg');
      container.style.backgroundImage = `url(${settings.background_url})`;
    }
  } catch (e) {
    console.error(e);
  }
}

function renderUserList() {
  const userList = document.getElementById('userList');
  userList.innerHTML = usersConfig.map(user => `
    <div class="user-item">
      <div class="user-dot" id="user-dot-${user.id}"></div>
      <span class="user-name">${user.displayName}</span>
    </div>
  `).join('');
}

async function loadMessages() {
  try {
    const res = await fetch('/api/messages');
    const newMessages = await res.json();
    
    if (newMessages.length > lastMessageCount && !isFirstLoad) {
      const newCount = newMessages.length - lastMessageCount;
      hasNewMessage = false;
      
      for (let i = newMessages.length - newCount; i < newMessages.length; i++) {
        const msg = newMessages[i];
        if (msg.sender_id !== currentUser.id) {
          hasNewMessage = true;
          try {
            const sender = usersConfig.find(u => u.id === msg.sender_id);
            if (sender && document.getElementById('notification')) {
              showNewMessageNotification(sender?.displayName || '用户', msg.content);
            }
          } catch (e) {
            console.log('Notification error:', e);
          }
          markAsRead(msg.id);
        }
      }
    }
    
    messages = newMessages;
    lastMessageCount = messages.length;
    renderMessages();
  } catch (e) {
    console.error(e);
  }
}

function showNewMessageNotification(senderName, content) {
  try {
    const notif = document.getElementById('notification');
    if (!notif) return;
    
    const preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
    notif.textContent = `${senderName} 发来新消息：${preview}`;
    notif.classList.remove('hidden');
    
    setTimeout(() => {
      notif.classList.add('hidden');
    }, 3000);
  } catch (e) {
    console.log('Notification error:', e);
  }
}

function renderMessages() {
  const messagesList = document.getElementById('messagesList');
  if (!messagesList) return;
  
  messagesList.innerHTML = messages.map(msg => {
    const sender = usersConfig.find(u => u.id === msg.sender_id);
    const isOwn = msg.sender_id === currentUser.id;
    const avatar = sender?.avatar || (msg.sender_id === 1 ? '👨' : '👩');
    let contentHtml = '';
    try {
      contentHtml = renderMarkdown(msg.content);
    } catch (e) {
      contentHtml = escapeHtml(msg.content);
    }
    
    return `
      <div class="message ${isOwn ? 'own' : ''}" id="msg-${msg.id}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-header">
            ${!isOwn ? `<span class="message-sender">${sender?.displayName || '用户'}</span>` : ''}
            <span class="message-time">${formatTime(msg.timestamp)}</span>
          </div>
          <div class="message-bubble">
            <div class="message-text">${contentHtml}</div>
          </div>
          <div class="message-meta">
            ${!isOwn ? `<span class="message-status ${msg.is_read ? '' : 'unread'}">${msg.is_read ? '✓ 已读' : '○ 未读'}</span>` : ''}
            <button class="like-btn" data-msg-id="${msg.id}">❤️ ${msg.likes}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const msgId = e.target.dataset.msgId;
      likeMessage(msgId);
    });
  });
  
  document.querySelectorAll('.message-text img').forEach(img => {
    img.addEventListener('click', (e) => {
      openImagePreview(e.target.src);
    });
  });
  
  if (isFirstLoad || hasNewMessage) {
    scrollToBottom();
    isFirstLoad = false;
    hasNewMessage = false;
  }
}

function scrollToBottom() {
  const messagesList = document.getElementById('messagesList');
  if (messagesList) {
    messagesList.scrollTop = messagesList.scrollHeight;
  }
}

function handleMessageKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const form = document.getElementById('messageForm');
    if (form) {
      form.dispatchEvent(new Event('submit'));
    }
  }
}

function autoResizeTextarea() {
  const textarea = document.getElementById('messageInput');
  if (!textarea) return;
  
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 200);
  textarea.style.height = newHeight + 'px';
  
  if (textarea.scrollHeight > 200) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }
}

async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (content) {
    await sendMessageText(content);
    input.value = '';
    input.style.height = 'auto';
  }
}

async function sendMessageText(content) {
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    hasNewMessage = true;
    loadMessages();
    updateIntimateScore();
  } catch (e) {
    console.error(e);
  }
}

async function markAsRead(msgId) {
  try {
    await fetch(`/api/messages/${msgId}/read`, { method: 'PUT' });
  } catch (e) {
    console.error(e);
  }
}

async function likeMessage(msgId) {
  try {
    await fetch(`/api/messages/${msgId}/like`, { method: 'POST' });
    loadMessages();
  } catch (e) {
    console.error(e);
  }
}

async function checkOnlineStatus() {
  try {
    const res = await fetch('/api/online-status');
    const status = await res.json();
    
    const otherUserId = currentUser.id === 1 ? 2 : 1;
    const isOnline = status[otherUserId];
    
    const indicator = document.getElementById('onlineIndicator');
    const userDot = document.getElementById(`user-dot-${otherUserId}`);
    
    if (isOnline) {
      indicator.textContent = '在线';
      indicator.classList.remove('offline');
      userDot?.classList.add('online');
    } else {
      indicator.textContent = '离线';
      indicator.classList.add('offline');
      userDot?.classList.remove('online');
    }
    
    if (previousOnlineStatus[otherUserId] === false && isOnline === true) {
      showNotification('对方上线了！💕');
    }
    previousOnlineStatus[otherUserId] = isOnline;
    
    usersConfig.forEach(user => {
      const dot = document.getElementById(`user-dot-${user.id}`);
      if (dot) {
        if (status[user.id]) {
          dot.classList.add('online');
        } else {
          dot.classList.remove('online');
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
}

function loadLoveQuote() {
  const quote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
  document.getElementById('loveQuote').textContent = quote;
}

function renderStickers() {
  const panel = document.getElementById('stickerPanel');
  panel.innerHTML = stickers.map(sticker => `
    <span class="sticker" data-sticker="${sticker}">${sticker}</span>
  `).join('');
  
  document.querySelectorAll('.sticker').forEach(sticker => {
    sticker.addEventListener('click', (e) => {
      const s = e.target.dataset.sticker;
      sendSticker(s);
    });
  });
}

async function sendSticker(sticker) {
  await sendMessageText(sticker);
  document.getElementById('stickerPanel').classList.add('hidden');
}

async function sendHeartAnimation() {
  try {
    await fetch('/api/heart-animation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    showHeartAnimation();
  } catch (e) {
    console.error(e);
  }
}

function showHeartAnimation() {
  const container = document.getElementById('heartContainer');
  const hearts = ['❤️', '💕', '💖', '💗', '💓', '💝', '😍', '🥰'];
  
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const heart = document.createElement('span');
      heart.className = 'floating-heart';
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      heart.style.left = Math.random() * 100 + '%';
      heart.style.bottom = '0';
      container.appendChild(heart);
      
      setTimeout(() => heart.remove(), 3000);
    }, i * 100);
  }
}

async function checkHeartAnimation() {
  try {
    const res = await fetch(`/api/heart-animation?timestamp=${lastHeartAnimationTimestamp}`);
    const data = await res.json();
    
    if (data.hasNew && data.animation) {
      lastHeartAnimationTimestamp = data.latestTimestamp;
      if (data.animation.senderId !== currentUser.id) {
        showHeartAnimation();
        showRomanticNotification(data.animation.senderName);
      }
    } else if (data.latestTimestamp > lastHeartAnimationTimestamp) {
      lastHeartAnimationTimestamp = data.latestTimestamp;
    }
  } catch (e) {
    console.error(e);
  }
}

function showRomanticNotification(senderName) {
  const romanticMessages = [
    `${senderName} 给你发送了满满的爱意 💕`,
    `${senderName} 想你了 💖`,
    `${senderName} 的心意收到了吗 ❤️`,
    `来自 ${senderName} 的浪漫暴击 😍`,
    `${senderName} 正在向你发射爱心 💗`,
    `${senderName} 的爱意已送达 💕`,
    `${senderName} 偷偷想你了 💝`,
    `${senderName} 给你比心啦 💓`
  ];
  
  const randomMessage = romanticMessages[Math.floor(Math.random() * romanticMessages.length)];
  
  const notif = document.getElementById('notification');
  notif.textContent = randomMessage;
  notif.classList.remove('hidden');
  notif.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 50%, #ff6b9d 100%)';
  notif.style.fontSize = '18px';
  notif.style.padding = '20px 30px';
  notif.style.boxShadow = '0 8px 32px rgba(255, 107, 107, 0.4)';
  
  setTimeout(() => {
    notif.classList.add('hidden');
    notif.style.background = '#5865f2';
    notif.style.fontSize = '';
    notif.style.padding = '';
    notif.style.boxShadow = '';
  }, 4000);
}

async function updateIntimateScore() {
  try {
    const res = await fetch('/api/intimate-score');
    const data = await res.json();
    document.getElementById('scoreValue').textContent = data.score;
  } catch (e) {
    console.error(e);
  }
}

function showNotification(text) {
  const notif = document.getElementById('notification');
  notif.textContent = text;
  notif.classList.remove('hidden');
  
  setTimeout(() => {
    notif.classList.add('hidden');
  }, 3000);
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (e) {
    console.error(e);
  }
}

async function initSettingsPage() {
  await loadConfig();
  loadCurrentSettings();
  renderAvatarPicker();

  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '/chat.html';
  });

  document.getElementById('toggleAvatarBtn').addEventListener('click', () => {
    const picker = document.getElementById('avatarPicker');
    picker.classList.toggle('hidden');
  });
}

function renderAvatarPicker() {
  const picker = document.getElementById('avatarPicker');
  if (!picker) return;
  
  picker.innerHTML = avatarOptions.map(avatar => `
    <span class="avatar-option" data-avatar="${avatar}">${avatar}</span>
  `).join('');
  
  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedAvatar = opt.dataset.avatar;
      updateAvatarPreview();
    });
  });
}

function updateAvatarPreview() {
  const preview = document.getElementById('currentAvatar');
  if (selectedAvatar) {
    preview.textContent = selectedAvatar;
  }
}

async function loadCurrentSettings() {
  try {
    const res = await fetch(`/api/settings/${currentUser.id}`);
    const settings = await res.json();
    
    if (settings.background_url) {
      document.getElementById('bgUrl').value = settings.background_url;
    }
    if (settings.display_name) {
      document.getElementById('displayName').value = settings.display_name;
    }
    if (settings.avatar) {
      selectedAvatar = settings.avatar;
      updateAvatarPreview();
      const avatarOpt = document.querySelector(`.avatar-option[data-avatar="${settings.avatar}"]`);
      if (avatarOpt) {
        avatarOpt.classList.add('selected');
      }
    }
    
    const user = usersConfig.find(u => u.id === currentUser.id);
    if (user) {
      document.getElementById('loginUsername').value = user.username;
    }
  } catch (e) {
    console.error(e);
  }
}

async function saveSettings() {
  const backgroundUrl = document.getElementById('bgUrl').value.trim();
  const displayName = document.getElementById('displayName').value.trim();
  const loginUsername = document.getElementById('loginUsername').value.trim();
  const loginPassword = document.getElementById('loginPassword').value.trim();

  try {
    await fetch(`/api/settings/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        background_url: backgroundUrl || null,
        display_name: displayName || null,
        avatar: selectedAvatar || null,
        login_username: loginUsername || null,
        login_password: loginPassword || null
      })
    });
    alert('设置保存成功！');
  } catch (e) {
    alert('保存失败');
  }
}

async function initAdminPage() {
  await loadConfig();
  renderUsers();
  loadRelationshipSettings();
  loadNotificationSettings();

  document.getElementById('saveUsersBtn').addEventListener('click', saveUsers);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '/chat.html';
  });
}

function loadRelationshipSettings() {
  if (config.relationship.startDate) {
    document.getElementById('relationship-startDate').value = config.relationship.startDate;
  }
  if (config.relationship.anniversaryText) {
    document.getElementById('relationship-anniversaryText').value = config.relationship.anniversaryText;
  }
}

async function loadNotificationSettings() {
  try {
    const res = await fetch('/api/notification-settings');
    const data = await res.json();
    if (data.user2OnlineEmail) {
      document.getElementById('user2OnlineEmail').value = data.user2OnlineEmail;
    }
  } catch (e) {
    console.error(e);
  }
}

function renderUsers() {
  const container = document.getElementById('usersContainer');
  
  let html = `
    <div class="user-card">
      <div class="user-card-header">
        <div class="user-avatar">🔐</div>
        <div>
          <div class="user-title">管理员</div>
          <div class="user-role">超级管理员</div>
        </div>
      </div>
      <div class="user-card-body">
        <div class="form-group">
          <label>管理员用户名</label>
          <input type="text" id="admin-username" value="${config.admin?.username || 'admin'}">
        </div>
        <div class="form-group">
          <label>管理员密码</label>
          <input type="password" id="admin-password" value="${config.admin?.password || 'admin123'}">
        </div>
      </div>
    </div>
  `;
  
  usersConfig.forEach((user, index) => {
    html += `
      <div class="user-card">
        <div class="user-card-header">
          <div class="user-avatar">${user.avatar || '👤'}</div>
          <div>
            <div class="user-title">用户 ${index + 1}</div>
            <div class="user-role">普通用户</div>
          </div>
        </div>
        <div class="user-card-body">
          <div class="form-group">
            <label>登录用户名</label>
            <input type="text" class="user-username" data-index="${index}" value="${user.username}">
          </div>
          <div class="form-group">
            <label>登录密码</label>
            <input type="password" class="user-password" data-index="${index}" value="${user.password}">
          </div>
          <div class="form-group">
            <label>显示名称</label>
            <input type="text" class="user-displayname" data-index="${index}" value="${user.displayName}">
          </div>
          <div class="form-group">
            <label>默认头像</label>
            <input type="text" class="user-avatar" data-index="${index}" value="${user.avatar}">
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function saveUsers() {
  const notice = document.getElementById('notice');
  
  const adminUsername = document.getElementById('admin-username').value;
  const adminPassword = document.getElementById('admin-password').value;
  
  const usernames = document.querySelectorAll('.user-username');
  const passwords = document.querySelectorAll('.user-password');
  const displaynames = document.querySelectorAll('.user-displayname');
  const avatars = document.querySelectorAll('.user-avatar');

  const newUsers = [];
  usernames.forEach((input, index) => {
    newUsers.push({
      id: index + 1,
      username: input.value,
      password: passwords[index].value,
      displayName: displaynames[index].value,
      avatar: avatars[index].value
    });
  });

  try {
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        users: newUsers,
        admin: { username: adminUsername, password: adminPassword }
      })
    });
    
    const startDate = document.getElementById('relationship-startDate').value;
    const anniversaryText = document.getElementById('relationship-anniversaryText').value;
    
    await fetch('/api/relationship', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, anniversaryText })
    });
    
    const user2OnlineEmail = document.getElementById('user2OnlineEmail').value.trim();
    await fetch('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user2OnlineEmail: user2OnlineEmail || null })
    });
    
    notice.textContent = '✅ 保存成功！';
    notice.className = 'notice success';
    notice.style.display = 'block';
    
    setTimeout(() => {
      notice.style.display = 'none';
    }, 3000);
  } catch (e) {
    notice.textContent = '❌ 保存失败！';
    notice.className = 'notice error';
    notice.style.display = 'block';
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
        mangle: false,
        headerIds: false
      });
      
      let html = marked.parse(text);
      
      html = html.replace(/<img([^>]*)>/g, function(match, attrs) {
        return '<img' + attrs + ' loading="lazy" onerror="this.style.display=\'none\'" />';
      });
      
      return html;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return escapeHtml(text);
    }
  }
  return escapeHtml(text);
}

function updateRelationshipInfo() {
  if (!config.relationship.startDate) return;
  
  const startDate = new Date(config.relationship.startDate);
  const today = new Date();
  const anniversaryText = config.relationship.anniversaryText || '相恋';
  
  const loveDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  document.getElementById('loveDays').textContent = loveDays;
  
  let chatDays = 0;
  if (firstMessageTime) {
    const firstMsgDate = new Date(firstMessageTime);
    chatDays = Math.floor((today - firstMsgDate) / (1000 * 60 * 60 * 24));
  }
  document.getElementById('chatDays').textContent = chatDays;
  
  document.getElementById('anniversaryDate').textContent = `${anniversaryText}纪念日`;
  document.getElementById('startDateDisplay').textContent = formatAnniversaryDate(startDate);
}

function formatAnniversaryDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

function openImagePreview(src) {
  const preview = document.getElementById('imagePreview');
  const previewImage = document.getElementById('previewImage');
  const closeBtn = document.getElementById('closePreview');
  
  if (preview && previewImage) {
    previewImage.src = src;
    preview.classList.remove('hidden');
    
    if (closeBtn) {
      closeBtn.onclick = closeImagePreview;
    }
    
    preview.onclick = (e) => {
      if (e.target === preview) {
        closeImagePreview();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
  }
}

function closeImagePreview() {
  const preview = document.getElementById('imagePreview');
  if (preview) {
    preview.classList.add('hidden');
    document.removeEventListener('keydown', handleEscKey);
  }
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    closeImagePreview();
  }
}
