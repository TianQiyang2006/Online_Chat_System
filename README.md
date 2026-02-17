# 在线聊天系统（Online Chat System）

一个专为情侣或亲密关系用户设计的在线聊天系统，提供私密、互动性强的聊天体验，包含情感互动功能和实时状态监控。

## ✨ 功能特性

### 核心功能
- **用户认证**：支持普通用户和管理员登录
- **消息管理**：发送/接收文本消息、已读状态标记、消息点赞
- **在线状态**：实时显示用户在线/离线状态，心跳机制保持会话活跃
- **情感互动**：亲密值系统、心跳动画效果、恋爱纪念日管理、随机爱情语录
- **个性化设置**：修改个人资料（昵称、头像、背景图）、修改登录凭证
- **邮件通知**：对方不在线时发送新消息邮件提醒，特定用户上线邮件通知

### 管理功能
- **用户管理**：管理员可管理所有用户账号
- **系统配置**：修改恋爱纪念日、通知设置等

## 🛠️ 技术栈

- **后端**：Node.js + Express 框架
- **数据库**：lowdb（轻量级本地 JSON 数据库）
- **邮件服务**：nodemailer（支持 SMTP 发送邮件）
- **会话管理**：express-session
- **前端**：静态 HTML/CSS/JavaScript

## 🚀 快速开始

### 环境要求
- Node.js 18.x 或更高版本
- npm 包管理器

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/online-chat.git
   cd online-chat
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置项目**
   编辑 `config.js` 文件，根据需要修改以下配置：
   - 端口号（默认 3000）
   - 会话密钥
   - 管理员账号密码
   - 普通用户账号密码
   - 邮件服务器配置（用于邮件通知）

4. **启动项目**
   ```bash
   npm start
   # 或开发模式启动
   npm run dev
   ```

5. **访问系统**
   打开浏览器，访问 `http://localhost:3000` 或配置的域名。

## 🔧 配置说明

### 主要配置文件：`config.js`

```javascript
module.exports = {
  port: 3000, // 服务端口
  sessionSecret: 'your-secret-key-change-this-in-production', // 会话密钥
  
  admin: {
    username: 'admin',
    password: 'admin123'
  },
  
  users: [
    { id: 1, username: 'user1', password: '123456', displayName: '我', avatar: '👨' },
    { id: 2, username: 'user2', password: '123456', displayName: '女朋友', avatar: '👩' }
  ],
  
  email: {
    host: 'smtp.163.com', // SMTP 服务器
    port: 465, // 端口
    secure: true, // 是否使用 SSL
    auth: {
      user: 'your-email@example.com', // 发件人邮箱
      pass: 'your-email-password' // 邮箱密码或授权码
    },
    recipient: 'recipient-email@example.com' // 收件人邮箱
  }
  // 其他配置...
};
```

### 域名绑定

如需通过域名访问，可在服务器上配置反向代理：

1. **DNS 解析**：在域名注册商（如 Cloudflare）添加 A 记录，将子域名指向服务器 IP。
2. **反向代理**：使用 Nginx 或 1Panel 等工具配置反向代理，将域名请求转发到 3000 端口。

## 👤 默认账号

- **管理员**：
  - 用户名：`admin`
  - 密码：`admin123`

- **普通用户**：
  - 用户 1：用户名 `user1`，密码 `123456`
  - 用户 2：用户名 `user2`，密码 `123456`

## 📁 项目结构

```
online-chat/
├── data/             # 数据库文件（lowdb 存储）
├── public/           # 前端静态文件
│   ├── login.html    # 登录页面
│   └── chat.html     # 聊天页面
├── config.js         # 系统配置文件
├── package.json      # 项目依赖
├── package-lock.json # 依赖版本锁定
├── server.js         # 后端服务主文件
└── README.md         # 项目说明文档
```

## 📧 邮件通知设置

系统支持两种邮件通知：
1. **新消息提醒**：当对方不在线时，发送新消息邮件。
2. **用户上线通知**：当特定用户（如用户 2）上线时，发送邮件通知。

### 配置步骤
1. 在 `config.js` 中填写正确的 SMTP 服务器信息。
2. 登录管理员账号，在系统设置中配置通知邮箱。
3. 可通过 `http://localhost:3000/api/test-email` 测试邮件发送功能。

## 💡 使用提示

- **修改个人资料**：登录后在设置页面修改昵称、头像和背景图。
- **查看亲密值**：系统会根据消息互动自动计算亲密值。
- **设置纪念日**：管理员可在系统设置中配置恋爱开始日期和纪念文本。
- **发送心跳**：点击聊天界面的心形按钮，向对方发送心跳动画。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🎉 鸣谢

- [Express](https://expressjs.com/) - Web 框架
- [lowdb](https://github.com/typicode/lowdb) - 轻量级数据库
- [nodemailer](https://nodemailer.com/) - 邮件发送库

---

**享受你的私密聊天时光！💖**