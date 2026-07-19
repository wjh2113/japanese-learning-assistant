# 日语学习助手

一个跨平台的日语学习工具，覆盖「听、说、读、写」四项能力，并接入 AI 大模型提供个性化的材料生成、批改与反馈。支持浏览器直接运行，也支持打包为 Android 应用安装使用。

## 功能概览

- 🎧 **听力**：按 JLPT 等级与主题生成日文听力材料，支持语音朗读、语速调节、原文隐藏与听写评分。
- 🎤 **口语**：基于场景生成口语题，使用麦克风朗读后由 AI 评估发音、语法与自然度。
- 📖 **阅读**：生成分级阅读文章，点击单词即可查词，阅读后完成 AI 生成的理解测验。
- ✍️ **写作**：给定题目进行日语写作，AI 批改后给出错误分析、改进建议与修改范文。
- 📚 **学习记录**：自动保存学习历史与收藏单词到本地存储。

## 快速开始（Web）

1. 克隆或下载本项目。
2. 使用浏览器直接打开 `www/index.html`（建议 Chrome / Edge / Safari）。
3. 点击右上角 **⚙️ 设置**，填入以下信息：
   - **API Base URL**：例如 `https://api.openai.com/v1`（兼容 OpenAI 格式）
   - **API Key**：你的 API Key
   - **默认模型**：例如 `gpt-4o-mini`、`deepseek-chat`、`claude-3-5-sonnet` 等
   - **默认等级**：JLPT N5-N1
4. 点击 **测试连接**，确认 API 可用后即可开始学习。

## Android 版本

本项目使用 [Capacitor](https://capacitorjs.com/) 将 Web 应用封装为 Android 应用。

### 环境要求

- Node.js 18+
- Android Studio
- Android SDK（API 26+）
- JDK 17

### 安装依赖

```bash
npm install
```

### 运行到 Android 模拟器或真机

```bash
# 同步 Web 资源到 Android 项目
npm run sync:android

# 用 Android Studio 打开项目
npm run open:android

# 或直接运行到已连接设备
npm run run:android
```

### 构建 APK

```bash
# 调试版 APK
npm run build:android:debug

# 发布版 APK（需要先在 Android Studio 中配置签名）
npm run build:android:release
```

构建完成后，APK 位于：

- 调试版：`android/app/build/outputs/apk/debug/app-debug.apk`
- 发布版：`android/app/build/outputs/apk/release/app-release-unsigned.apk`（未签名）

### Android 权限

应用需要以下权限：

- `INTERNET`：访问 AI API
- `RECORD_AUDIO`：口语练习录音
- `MODIFY_AUDIO_SETTINGS`：语音播放控制

首次使用口语模块时，系统会请求麦克风权限，请允许。

## 推荐模型

- OpenAI：`gpt-4o-mini`、`gpt-4o`
- DeepSeek：`deepseek-chat`
- Claude：需通过兼容 OpenAI 格式的代理使用
- 本地模型：可在 `www/js/api.js` 中扩展 Ollama 格式

## 语音兼容性

### Web 浏览器

- **语音朗读（TTS）**：使用浏览器 `speechSynthesis`，需要系统或浏览器安装日语语音包。
- **语音识别（STT）**：使用浏览器 `SpeechRecognition`，目前 Chrome / Edge / Safari 支持较好。

### Android

- Android 版本优先使用 Capacitor 原生 TTS/STT 插件，比 WebView 内置语音更稳定。
- 确保设备已安装日语 TTS 引擎（如 Google 文字转语音引擎）。

> 如果听不到日语朗读，请检查系统是否已安装日语语音包；若语音识别不可用，请换用 Chrome 浏览器或检查麦克风权限。

## 项目结构

```
.
├── www/                            # Web 应用源码
│   ├── index.html                  # 主页面
│   ├── js/                         # JavaScript 模块
│   │   ├── app.js                  # 应用入口、模块切换、全局状态
│   │   ├── config.js               # 配置与本地存储（Web/Capacitor 自适应）
│   │   ├── api.js                  # LLM API 封装
│   │   ├── speech.js               # 语音合成与识别封装（原生插件优先）
│   │   ├── modules/                # 四个学习模块
│   │   └── components/             # 可复用组件
│   └── README.md                   # 本文件
├── android/                        # Capacitor Android 项目
├── capacitor.config.json           # Capacitor 配置
├── package.json                    # npm 依赖与脚本
└── README.md                       # 项目根目录说明
```

## 本地开发

无需构建工具，直接打开 `www/index.html` 即可。建议使用本地 HTTP 服务器以获得更好的模块加载体验：

```bash
# 进入 www 目录
npx serve www
```

然后访问 `http://localhost:3000`。

## 隐私说明

- API Key 仅保存在本地（浏览器 `localStorage` 或 Capacitor `Preferences`），不会上传到任何服务器。
- 学习历史与收藏单词也仅保存在本地。

## 后续扩展

- [ ] 接入 Ollama / LM Studio 本地模型
- [ ] 导出收藏单词为 Anki / CSV
- [ ] 学习统计与可视化图表
- [ ] 后端版本：多用户、进度同步
- [ ] 推送通知提醒每日学习

## License

MIT
