# Typora Copilot — DeepSeek 版

[English](./README.md) | 简体中文

![Copilot 补全截图](./docs/screenshot.zh-CN.png)

> **基于 [Snowflyt/typora-copilot](https://github.com/Snowflyt/typora-copilot) v0.3.12（MIT 协议）修改** — 新增 DeepSeek 与自定义 OpenAI 兼容提供商支持。

为 [Typora](https://typora.io/) 提供 AI 驱动的内联补全与对话功能，支持 Windows、macOS 和 Linux。**三大 AI 提供商**可选：GitHub Copilot、DeepSeek，以及任意 OpenAI 兼容 API。

## 提供商对比

| 功能             | GitHub Copilot | DeepSeek         | 自定义提供商   |
| ---------------- | -------------- | ---------------- | -------------- |
| 内联补全         | ✅（LSP）      | ✅（FIM API）    | ✅（对话补全） |
| 对话面板         | ✅             | ✅               | ✅             |
| 订阅要求         | GitHub Copilot | DeepSeek API Key | 自定义 API Key |
| 模型选择         | 通过 Copilot   | 可编辑           | 可编辑         |
| 自定义系统提示词 | ❌             | ✅               | ✅             |

## 兼容性

> [!NOTE]
> 自 Typora v1.10 起，所有平台均需安装 [Node.js](https://nodejs.org/en/download) ≥ 20。

| Typora 版本 | Windows 11 | Ubuntu 24.04 | macOS 15.x |
| ----------- | ---------- | ------------ | ---------- |
| 1.12.6      | /          | /            | ✓          |
| 1.12.4      | ✓          | /            | /          |
| 1.11.7      | ✓          | /            | ✓          |
| 1.10.8      | ✓          | ✓            | ✓          |
| 1.10.6      | ✓          | ✓            | ✓          |
| 1.9.5       | ✓          | /            | /          |
| 1.8.10      | ✓          | ✓            | ✓          |

## 前置条件

- 需要公网连接。
- **GitHub Copilot 模式：** 有效的 GitHub Copilot 订阅。
- **DeepSeek 模式：** [DeepSeek API Key](https://platform.deepseek.com/api_keys)（有免费额度）。
- **自定义模式：** 任意 OpenAI 兼容 API 的地址与密钥。

## 安装

**安装前请确保 Typora 已完全关闭（macOS 用户请使用 <kbd>⌘</kbd>+<kbd>Q</kbd> 退出）。**

### 自动安装（推荐）

<details>
  <summary><strong>Windows</strong></summary>

在 PowerShell 中**以管理员身份**运行：

```powershell
iwr -Uri "https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.ps1" | iex
```

</details>

<details>
  <summary><strong>macOS</strong></summary>

在终端中运行：

```bash
curl -fsSL https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.sh | sudo bash
```

</details>

<details>
  <summary><strong>Linux</strong></summary>

在终端中运行：

```bash
wget -O - https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.sh | sudo bash
```

</details>

### 从源码构建

<details>
  <summary>点击展开</summary>

```bash
# 1. 克隆仓库
git clone https://github.com/KissSheep666/TyporaAI-.git
cd TyporaAI-

# 2. 安装依赖
npm install

# 3. 构建插件
npm run build:dev
# 构建产物在 dist/ 目录

# 4. 部署到 Typora
# 首先找到你的 Typora 安装目录：
#   Windows: C:\Program Files\Typora\
#   macOS:   /Applications/Typora.app/
#   Linux:   /usr/share/typora/

# 将 dist/ 复制到 Typora 的 resources/copilot/ 目录
# Windows 示例（以管理员身份运行）：
# rm -r "C:\Program Files\Typora\resources\copilot"
# cp -r dist "C:\Program Files\Typora\resources\copilot"

# Linux 示例：
# sudo rm -rf /usr/share/typora/resources/copilot
# sudo cp -r dist /usr/share/typora/resources/copilot

# 5. 在 Typora 中注入插件脚本
# Windows/Linux：在 <typora>/resources/window.html 中添加：
#   <script src="./copilot/index.js" defer="defer"></script>
#   （添加在 frame.js 的 <script> 标签之后）
#
# macOS：在 <typora>/Contents/Resources/TypeMark/index.html 中添加：
#   <script src="./copilot/index.js" defer></script>
#   （添加在 main.js 的 <script> 标签之后）

# 6. 重启 Typora
```

</details>

## 配置

### GitHub Copilot 模式

安装完成后，点击 Typora 工具栏右下角的 Copilot 图标旁的**箭头按钮**，然后点击「登录以验证 Copilot」。

![Copilot 图标](./docs/toolbar-icon.zh-CN.png)

按提示完成认证。

### DeepSeek / 自定义模式

1. 点击工具栏 Copilot 图标 → **设置**。
2. 在 **AI 提供商** 标签页中选择 **DeepSeek** 或 **自定义大模型**。
3. 填入 API Key 并配置模型名称。

| 设置项               | 说明                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| **DeepSeek API Key** | 从 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 获取 |
| **DeepSeek 模型**    | 默认：`deepseek-v4-flash`。也可用：`deepseek-v4-pro`、`deepseek-chat`            |
| **自定义 API Base**  | OpenAI 兼容接口地址（如 `https://api.openai.com/v1`）                            |
| **自定义 API Key**   | 对应提供商的 API 密钥                                                            |
| **自定义模型**       | 提供商支持的模型名称                                                             |

> **注意：** API Key 仅存储在 Typora 的 localStorage 中，不会发送到除对应 API 端点之外的任何地方。

### 自定义对话风格（人设）

你可以为对话面板创建命名的系统提示词：

1. 打开 **设置 → AI 提供商** 标签页。
2. 在「自定义对话风格」下方，点击 **+ 新建风格**。
3. 输入名称与系统提示词内容。
4. 点击 **保存**。

在对话面板中从下拉框选择你创建的风格即可使用。

## 对话面板

点击工具栏中的 Copilot 图标可切换对话面板。当前文档和对话历史将作为上下文发送。

- 从顶部的下拉框中选择、创建、编辑或删除对话会话。
- 按 <kbd>Enter</kbd> 发送，<kbd>Shift</kbd>+<kbd>Enter</kbd> 换行。
- 点击 **停止** 可取消当前请求。
- 从底部的下拉框中选择对话风格。
- 选择你想使用的模型。

## 卸载

### 自动卸载（推荐）

<details>
  <summary><strong>Windows</strong></summary>

```powershell
iwr -Uri "https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/bin/uninstall_windows.ps1" | iex
```

</details>

<details>
  <summary><strong>macOS</strong></summary>

```bash
curl -fsSL https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/bin/uninstall_macos.sh | sudo bash
```

</details>

<details>
  <summary><strong>Linux</strong></summary>

```bash
wget -O - https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/bin/uninstall_linux.sh | sudo bash
```

</details>

## 已知问题

1. 有时接受补全会导致编辑器重新渲染（代码块、数学公式等），这是 Typora API 的限制。
2. 内联幽灵文字在某些编辑器模式下显示可能不稳定，正在持续改进中。

## 常见问题

### 如何切换 AI 提供商？

点击工具栏图标 → **设置** → **AI 提供商** 标签页 → 选择提供商。

### 可以使用 Tab 以外的按键接受建议吗？

目前不支持，技术上可行，未来可能实现。

### 支持哪些 DeepSeek 模型？

支持所有 DeepSeek Chat API 模型：`deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-chat`、`deepseek-reasoner`。你可以在设置输入框中输入任意模型名。

## 致谢

本项目基于 [Snowflyt/typora-copilot](https://github.com/Snowflyt/typora-copilot) 修改 — 原始 Typora Copilot 插件架构的所有功劳归于 [@Snowflyt](https://github.com/Snowflyt)。

## 许可证

MIT — 详见 [LICENSE](./LICENSE) 文件。
