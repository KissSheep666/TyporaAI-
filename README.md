# Typora Copilot — DeepSeek Edition

English | [简体中文](./README.zh-CN.md)

![Copilot suggestion screenshot](./docs/screenshot.png)

> **Forked from [Snowflyt/typora-copilot](https://github.com/Snowflyt/typora-copilot) v0.3.12 (MIT)** — extended with DeepSeek and custom OpenAI-compatible provider support.

AI-powered inline completions and chat for [Typora](https://typora.io/) on Windows, macOS and Linux. Supports **three AI providers**: GitHub Copilot, DeepSeek, and any OpenAI-compatible API.

## Provider Comparison

| Feature               | GitHub Copilot | DeepSeek         | Custom Provider |
| --------------------- | -------------- | ---------------- | --------------- |
| Inline completions    | ✅ (LSP)       | ✅ (FIM API)     | ✅ (Chat-based) |
| Chat panel            | ✅             | ✅               | ✅              |
| Subscription required | GitHub Copilot | DeepSeek API Key | Custom API Key  |
| Offline support       | ❌             | ❌               | ❌              |
| Model selection       | Via Copilot    | Editable         | Editable        |
| Custom system prompts | ❌             | ✅               | ✅              |

## Compatibility

> [!NOTE]
> Since Typora v1.10, all platforms require [Node.js](https://nodejs.org/en/download) ≥ 20 to use this plugin.

| Typora Version | Windows 11 | Ubuntu 24.04 | macOS 15.x |
| -------------- | ---------- | ------------ | ---------- |
| 1.12.6         | /          | /            | ✓          |
| 1.12.4         | ✓          | /            | /          |
| 1.11.7         | ✓          | /            | ✓          |
| 1.10.8         | ✓          | ✓            | ✓          |
| 1.10.6         | ✓          | ✓            | ✓          |
| 1.9.5          | ✓          | /            | /          |
| 1.8.10         | ✓          | ✓            | ✓          |

## Prerequisites

- Public network connection.
- **GitHub Copilot mode:** Active GitHub Copilot subscription.
- **DeepSeek mode:** A [DeepSeek API Key](https://platform.deepseek.com/api_keys) (free tier available).
- **Custom mode:** Any OpenAI-compatible API endpoint and key.

## Installation

**Before installing, make sure Typora is fully closed (especially on macOS: use <kbd>⌘</kbd>+<kbd>Q</kbd> to quit).**

### Automated Installation (Recommended)

<details>
  <summary><strong>Windows</strong></summary>

Run the following command in PowerShell **as administrator**:

```powershell
iwr -Uri "https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.ps1" | iex
```

</details>

<details>
  <summary><strong>macOS</strong></summary>

Run the following command in your terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.sh | sudo bash
```

</details>

<details>
  <summary><strong>Linux</strong></summary>

Run the following command in your terminal:

```bash
wget -O - https://raw.githubusercontent.com/KissSheep666/TyporaAI-/main/install.sh | sudo bash
```

</details>

### Build from Source

<details>
  <summary>Click to expand</summary>

```bash
# 1. Clone the repository
git clone https://github.com/KissSheep666/TyporaAI-.git
cd TyporaAI-

# 2. Install dependencies
npm install

# 3. Build the plugin
npm run build:dev
# The build output is in the dist/ directory

# 4. Deploy to Typora
# First, locate your Typora installation directory:
#   Windows: C:\Program Files\Typora\
#   macOS:   /Applications/Typora.app/
#   Linux:   /usr/share/typora/

# Copy dist/ to Typora's resources/copilot/ directory
# Windows example (run as Administrator):
# rm -r "C:\Program Files\Typora\resources\copilot"
# cp -r dist "C:\Program Files\Typora\resources\copilot"

# Linux example:
# sudo rm -rf /usr/share/typora/resources/copilot
# sudo cp -r dist /usr/share/typora/resources/copilot

# 5. Inject the plugin script into Typora
# For Windows/Linux: Add this line to <typora>/resources/window.html
#   <script src="./copilot/index.js" defer="defer"></script>
#   (add it right after the frame.js <script> tag)
#
# For macOS: Add this line to <typora>/Contents/Resources/TypeMark/index.html
#   <script src="./copilot/index.js" defer></script>
#   (add it right after the main.js <script> tag)

# 6. Restart Typora
```

</details>

## Setup

### GitHub Copilot Mode

When finished installation, click **the arrow button** next to the Copilot icon in Typora's toolbar (bottom-right corner), then click "Sign in to authenticate Copilot".

![Copilot icon](./docs/toolbar-icon.png)

Follow the prompts to authenticate.

### DeepSeek / Custom Provider Mode

1. Click the Copilot icon in the toolbar → **Settings**.
2. Under the **AI Provider** tab, select **DeepSeek** or **Custom**.
3. Enter your API Key and configure the model name.

| Setting              | Description                                                                          |
| -------------------- | ------------------------------------------------------------------------------------ |
| **DeepSeek API Key** | Obtain from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| **DeepSeek Model**   | Default: `deepseek-v4-flash`. Also available: `deepseek-v4-pro`, `deepseek-chat`     |
| **Custom API Base**  | Your OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1`)                   |
| **Custom API Key**   | Your API key for the custom provider                                                 |
| **Custom Model**     | Model name supported by your provider                                                |

> **Note:** API Keys are stored locally in Typora's localStorage. They are never sent anywhere except directly to the respective API endpoints.

### Custom Prompts (Personas)

You can create named system prompts (personas) for the Chat panel:

1. Open **Settings → AI Provider** tab.
2. Under "Custom Conversation Styles", click **+ New Style**.
3. Give it a name and write your system prompt content.
4. Click **Save**.

In the Chat panel, select your custom prompt from the dropdown to use it in conversations.

## Chat Panel

Click the Copilot icon in the toolbar to toggle the Chat panel. The current document and previous chat history are sent as context.

- Select, create, edit, or delete chat sessions from the dropdown.
- Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line.
- Click **Stop** to cancel the current request.
- Choose a prompt style from the dropdown at the bottom.
- Pick the model you want to use.

## Uninstallation

### Automated Uninstallation (Recommended)

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

## Known Issues

1. Sometimes accepting a suggestion may cause the editor to rerender (code blocks, math blocks, etc.). This is due to Typora API limitations.
2. Inline ghost text display may be unstable in certain editor modes. This is an area under active improvement.

## FAQs

### How to switch between AI providers?

Click the toolbar icon → **Settings** → **AI Provider** tab → select your provider.

### Can I use keys other than `Tab` to accept suggestions?

Currently, no. This is technically possible and may be implemented in the future.

### Which DeepSeek models are supported?

All DeepSeek Chat API models: `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-chat`, and `deepseek-reasoner`. You can type any model name in the settings input.

## Acknowledgments

This project is a fork of [Snowflyt/typora-copilot](https://github.com/Snowflyt/typora-copilot) — all credit for the original Typora Copilot plugin architecture goes to [@Snowflyt](https://github.com/Snowflyt).

## License

MIT — see [LICENSE](./LICENSE) for details.
