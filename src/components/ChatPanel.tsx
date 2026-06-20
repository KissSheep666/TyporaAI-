import type { Signal } from "@preact/signals";
import { useSignal, useSignalEffect } from "@preact/signals";
import { getLuminance } from "color2k";
import hljs from "highlight.js";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import { render } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type { ChatModel } from "@/client/chat";
import {
  COPILOT_ACADEMIC_INSTRUCTIONS,
  COPILOT_MARKDOWN_INSTRUCTIONS,
  ChatSession,
  listCopilotChatModels,
} from "@/client/chat";
import { t } from "@/i18n";
import { settings } from "@/settings";

// DeepSeek system prompts (string constants — safe to import directly)
import {
  DEEPSEEK_ACADEMIC_INSTRUCTIONS,
  DEEPSEEK_MARKDOWN_INSTRUCTIONS,
} from "../providers/deepseek/deepseek-chat";

import CopilotIcon from "./CopilotIcon";

import "./ChatPanel.scss";

interface ChatPanelProps {
  onClose: () => void;
}

const ChatPanel: FC<ChatPanelProps> = ({ onClose }) => {
  const input = useSignal("");
  const promptType = useSignal("builtin-normal");
  const isThinking = useSignal(false);
  const isSending = useSignal(false);
  const messages = useSignal<Message[]>([]);
  const sessionJustSwitchedFlag = useSignal(false);

  const modelId = useSignal("gpt-4o");
  const models = useSignal<ChatModel[]>([]);

  const currentSessionId = useSignal("");
  const sessions = useSignal<ChatSession[]>([]);

  // ================================================================
  // Prompt styles — single signal as runtime source of truth
  // ================================================================
  const prompts = useSignal<{ id: string; name: string; content: string }[]>(
    []
  );

  // Seed built-in prompts if empty
  const seedDefaults = () => {
    if (prompts.value.length > 0) return;
    const isDS = settings.provider === "deepseek";
    const builtins = [
      {
        id: "builtin-normal",
        name: t.tran("chat.prompt-style.Normal"),
        content: isDS
          ? DEEPSEEK_MARKDOWN_INSTRUCTIONS
          : COPILOT_MARKDOWN_INSTRUCTIONS,
      },
      {
        id: "builtin-academic",
        name: t.tran("chat.prompt-style.Academic"),
        content: isDS
          ? DEEPSEEK_ACADEMIC_INSTRUCTIONS
          : COPILOT_ACADEMIC_INSTRUCTIONS,
      },
    ];
    prompts.value = builtins;
    settings.customPrompts = builtins;
  };

  // Get current prompt content
  const getPrompt = useCallback(() => {
    const p = prompts.value.find((x) => x.id === promptType.value);
    return p?.content || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find prompt ID by content (for session restore)
  const getPromptType = useCallback((content: string) => {
    const p = prompts.value.find((x) => x.content === content);
    return p?.id || "builtin-normal";
  }, []);

  // Watch modelId changes and update session meta
  useEffect(() => {
    const currentSession = sessions.value.find(
      (session) => session.id === currentSessionId.value
    );
    if (!currentSession) return;

    if (currentSession.modelId === modelId.value) return;

    currentSession.modelId = modelId.value;
    void ChatSession.save(currentSession.id);
    sessions.value = ChatSession.getAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId.value, currentSessionId.value]);

  // Watch prompt type changes and update the system prompt
  useEffect(() => {
    const currentSession = sessions.value.find(
      (session) => session.id === currentSessionId.value
    );
    if (!currentSession) return;

    const newContent = getPrompt();
    // Don't overwrite the system message with empty content (e.g. when a brand-new
    // custom prompt hasn't been filled in yet — typing content + Save will sync it).
    if (!newContent) return;
    if (currentSession.messages[0]!.content === newContent) return;

    currentSession.messages[0]!.content = newContent;
    void ChatSession.save(currentSession.id);
    sessions.value = ChatSession.getAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptType.value, currentSessionId.value, getPrompt]);

  // Initialize prompts from settings on mount
  useEffect(() => {
    const saved = settings.customPrompts;
    if (saved.length > 0) {
      prompts.value = [...saved];
    } else {
      seedDefaults();
    }
  }, []);

  // Keep prompts signal in sync when user edits in Settings panel
  useEffect(() => {
    return settings.onChange("customPrompts", () => {
      prompts.value = [...settings.customPrompts];
    });
  }, []);

  // Load models and sessions on mount
  useEffect(() => {
    // Load models
    void listCopilotChatModels().then((modelList) => {
      models.value = modelList;
    });

    // Load sessions
    const loadSessions = async () => {
      await ChatSession.loadAll();

      const allSessions = ChatSession.getAll();
      sessions.value = allSessions;

      // Select the first session if available, otherwise create a new one
      if (allSessions.length > 0) {
        currentSessionId.value = allSessions[0]!.id;

        modelId.value = allSessions[0]!.modelId;
        promptType.value = getPromptType(allSessions[0]!.messages[0]!.content);

        messages.value = allSessions[0]!.messages
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
        sessionJustSwitchedFlag.value = !sessionJustSwitchedFlag.value;
      } else {
        createNewSession();
      }
    };

    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewSession = useCallback(() => {
    const session = ChatSession.create(modelId.value, getPrompt());
    currentSessionId.value = session.id;

    sessions.value = ChatSession.getAll();

    messages.value = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchSession = useCallback((id: string) => {
    const session = ChatSession.get(id);
    if (!session) return;

    currentSessionId.value = session.id;

    modelId.value = session.modelId;
    promptType.value = getPromptType(session.messages[0]!.content);

    messages.value = session.messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
    sessionJustSwitchedFlag.value = !sessionJustSwitchedFlag.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditChatTitle = useCallback((id: string, title: string) => {
    const session = ChatSession.get(id);
    if (!session) return;

    session.title = title;
    void ChatSession.save(session.id);

    sessions.value = ChatSession.getAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      void ChatSession.delete(id);

      sessions.value = ChatSession.getAll();

      // If current session is deleted, switch to the first available session
      if (id === currentSessionId.value) {
        if (sessions.value.length > 0) {
          switchSession(sessions.value[0]!.id);
        } else {
          createNewSession();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createNewSession, switchSession]
  );

  // Send message handler
  const handleSendMessage = () => {
    const userMessage = input.value.trim();
    if (!userMessage || isSending.value) return;

    // Add user message
    messages.value = [
      ...messages.value,
      {
        role: "user",
        content: input.value.trim(),
      },
    ];

    // Clear input
    input.value = "";

    // Show typing indicator
    isThinking.value = true;
    isSending.value = true;

    abortControllerRef.current = new AbortController();
    sessions.value
      .find((session) => session.id === currentSessionId.value)
      ?.send(
        userMessage,
        (content) => {
          if (isThinking.value) {
            isThinking.value = false;
            messages.value = [
              ...messages.value,
              {
                role: "assistant",
                content: "",
              },
            ];
          }
          messages.value = [
            ...messages.value.slice(0, messages.value.length - 1),
            {
              role: "assistant",
              content:
                messages.value[messages.value.length - 1]!.content + content,
            },
          ];
        },
        {
          model: models.value.find((model) => model.id === modelId.value),
          signal: abortControllerRef.current.signal,
        }
      )
      .then((fullContent) => {
        messages.value = [
          ...messages.value.slice(0, messages.value.length - 1),
          {
            role: "assistant",
            content: fullContent,
          },
        ];
        isSending.value = false;
        void ChatSession.save(currentSessionId.value);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
        isSending.value = false;
      });
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const handleStopSending = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <div id="ai-chat-panel" className="ai-chat-panel">
      <ChatHeader
        onClose={onClose}
        currentSessionId={currentSessionId}
        sessions={sessions}
        onSwitchSession={switchSession}
        onNewSession={createNewSession}
        onEditChatTitle={handleEditChatTitle}
        onDeleteSession={handleDeleteSession}
      />
      <MessageList
        promptType={promptType.value}
        messages={messages.value}
        isThinking={isThinking.value}
        sessionJustSwitchedFlag={sessionJustSwitchedFlag.value}
      />
      <InputArea
        input={input}
        promptType={promptType}
        prompts={prompts}
        modelId={modelId}
        models={models.value}
        onSend={handleSendMessage}
        onStop={handleStopSending}
        isSending={isSending.value}
      />
    </div>
  );
};

/**********
 * Header *
 **********/
interface ChatHeaderProps {
  onClose: () => void;
  currentSessionId: Signal<string>;
  sessions: Signal<ChatSession[]>;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onEditChatTitle?: (id: string, title: string) => void;
  onDeleteSession?: (id: string) => void;
}

const ChatHeader: FC<ChatHeaderProps> = ({
  currentSessionId,
  onClose,
  onDeleteSession,
  onEditChatTitle,
  onNewSession,
  onSwitchSession,
  sessions,
}) => {
  const isDropdownOpen = useSignal(false);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        isDropdownOpen.value &&
        !target.closest(".chat-title-dropdown-toggle") &&
        !target.closest(".session-menu")
      ) {
        isDropdownOpen.value = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditChatTitle = (id: string, title: string) => {
    let newTitle = title;
    Files.editor?.EditHelper.showDialog({
      title: t("chat.dialog.edit-chat-title.title"),
      html: t("chat.dialog.edit-chat-title.html").replace(
        "{{SESSION_TITLE}}",
        title
      ),
      buttons: [t("button.ok"), t("button.cancel")],
      callback: (result) => {
        if (result === 0 && onEditChatTitle) onEditChatTitle(id, newTitle);
      },
    });
    $("#new-chat-title").on("input", (e) => {
      newTitle = (e.target as HTMLInputElement).value;
    });
  };

  const handleDeleteSession = (id: string, title: string) => {
    // Show confirmation dialog
    Files.editor?.EditHelper.showDialog({
      title: t("chat.dialog.delete-session.title"),
      html: t("chat.dialog.delete-session.html").replace(
        "{{SESSION_TITLE}}",
        title
      ),
      buttons: [t("button.delete"), t("button.cancel")],
      callback: (result) => {
        if (result === 0 && onDeleteSession) {
          onDeleteSession(id);
          // Close the dropdown if the current session is deleted
          if (id === currentSessionId.value) isDropdownOpen.value = false;
        }
      },
    });
  };

  return (
    <div className="chat-panel-header">
      <div className="chat-title-dropdown">
        <button
          className="chat-title-dropdown-toggle"
          onClick={() => (isDropdownOpen.value = !isDropdownOpen.value)}
        >
          <h3>
            {sessions.value.find(
              (session) => session.id === currentSessionId.value
            )?.title || t("chat.button.new-session")}
          </h3>
          <svg
            className="dropdown-chevron"
            width="8"
            height="5"
            viewBox="0 0 8 5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 5L0 0.5L8 0.5L4 5Z" fill="currentColor" />
          </svg>
        </button>

        {isDropdownOpen.value && (
          <div className="chat-panel-dropdown-menu session-menu">
            <button
              className="chat-panel-dropdown-item new-session"
              onClick={() => {
                onNewSession();
                isDropdownOpen.value = false;
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z" />
              </svg>
              {t("chat.button.new-session")}
            </button>

            {sessions.value.map((session) => (
              <button
                key={session.id}
                className={`chat-panel-dropdown-item ${session.id === currentSessionId.value ? "active" : ""}`}
                onClick={() => {
                  onSwitchSession(session.id);
                  isDropdownOpen.value = false;
                }}
              >
                <span className="session-title">
                  {session.title || t("chat.button.new-session")}
                </span>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditChatTitle(session.id, session.title);
                    }}
                    ty-hint={t("chat.button.edit-chat-title")}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                    </svg>
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id, session.title);
                    }}
                    ty-hint={t("chat.button.delete-session")}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                      <path
                        fillRule="evenodd"
                        d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                      />
                    </svg>
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="chat-panel-close-btn" onClick={onClose}>
        ×
      </button>
    </div>
  );
};

/************
 * Messages *
 ************/
interface Message {
  role: "assistant" | "user";
  content: string;
}

interface MessageContentProps {
  content: string;
}

const md = marked
  .use({
    // Avoid identifying `~` as strikethrough
    // https://github.com/markedjs/marked/issues/1561#issuecomment-846571425
    tokenizer: {
      del: (src) => {
        if (/^~~+(?=\S)([\s\S]*?\S)~~+/.exec(src)) return false;
      },
    },
  })
  .use(
    markedHighlight({
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    })
  );

const MessageContent: FC<MessageContentProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = md.parse(content) as string;

    // Handle links
    const links = containerRef.current.querySelectorAll("a");
    links.forEach((link) => {
      if (link.getAttribute("href")?.startsWith("http")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    // Add copy button to code blocks
    const codeBlocks = containerRef.current.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      const copyButton = document.createElement("button");
      copyButton.className = "copy-code-button";
      copyButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4v9h9V4H4zm8 8H5V5h7v7z"/>
          <path d="M3 3v9h1V3h8V2H3v1z"/>
        </svg>
      `;

      copyButton.addEventListener("click", () => {
        const code = pre.textContent || "";
        void navigator.clipboard.writeText(code.trim()).then(() => {
          copyButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
            </svg>
          `;
          setTimeout(() => {
            copyButton.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4v9h9V4H4zm8 8H5V5h7v7z"/>
                <path d="M3 3v9h1V3h8V2H3v1z"/>
              </svg>
            `;
          }, 800);
        });
      });

      pre.appendChild(copyButton);
    });
  }, [content]);

  return (
    <div ref={containerRef} className="message-content markdown-content" />
  );
};

const EmptyStateWelcome: FC = () => {
  return (
    <div className="empty-state-welcome">
      <div className="welcome-icon">
        <CopilotIcon
          status="Normal"
          textColor="var(--text-color)"
          style={{ width: "48px", height: "48px" }}
        />
      </div>
      <h2 className="welcome-title">{t("chat.welcome.title")}</h2>
      <p className="welcome-subtitle">{t("chat.welcome.subtitle")}</p>
    </div>
  );
};

interface MessageListProps {
  promptType: string;
  messages: Message[];
  isThinking: boolean;
  sessionJustSwitchedFlag: boolean;
}

const MessageList: FC<MessageListProps> = ({
  isThinking,
  messages,
  promptType,
  sessionJustSwitchedFlag,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current)
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, []);

  useEffect(scrollToBottom, [sessionJustSwitchedFlag, scrollToBottom]);

  // Watch for new messages and scroll to bottom if the role is "user"
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1]!.role === "user")
      scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="chat-panel-messages" ref={containerRef}>
      {messages.length === 0 && !isThinking ? (
        <EmptyStateWelcome />
      ) : (
        messages.map((message, index) => (
          <div key={index} className={`chat-message-row ${message.role}`}>
            {message.role === "user" ? (
              <>
                <div className="message-header">
                  <div className="message-icon user-icon">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="2"
                        y="6"
                        width="8"
                        height="8"
                        rx="2"
                        fill="#7c80ff"
                      />
                      <circle cx="11" cy="5" r="3" fill="#ffb173" />
                      <rect
                        x="6"
                        y="2"
                        width="4"
                        height="4"
                        rx="1"
                        fill="#67d8ae"
                      />
                    </svg>
                  </div>
                  <div className="message-author">{t("chat.you")}</div>
                </div>
                <pre className="message-content">{message.content}</pre>
              </>
            ) : (
              <>
                <div className="message-header">
                  <div className="message-icon ai-icon">
                    <CopilotIcon
                      status="Normal"
                      textColor="var(--text-color)"
                      style={{ width: "90%", height: "90%" }}
                    />
                  </div>
                  <div className="message-author">
                    {settings.provider === "deepseek"
                      ? "DeepSeek"
                      : settings.provider === "custom"
                        ? "AI"
                        : "Copilot"}
                  </div>
                </div>
                <MessageContent content={message.content} />
              </>
            )}
          </div>
        ))
      )}

      {isThinking && (
        <div className="chat-message-row assistant">
          <div className="message-header">
            <div className="message-icon ai-icon">
              <CopilotIcon status="InProgress" textColor="var(--text-color)" />
            </div>
            <div className="message-author">
              {settings.provider === "deepseek"
                ? "DeepSeek"
                : settings.provider === "custom"
                  ? "AI"
                  : "Copilot"}
            </div>
          </div>
          <div className="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

/**************
 * Input Area *
 **************/
interface DropdownProps {
  label: string;
  tooltip?: string;
  isOpen: Signal<boolean>;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  closeOtherDropdown: () => void;
}

const Dropdown: FC<DropdownProps> = ({
  closeOtherDropdown,
  isOpen,
  label,
  onSelect,
  options,
  tooltip,
}) => {
  return (
    <div className="chat-panel-dropdown">
      <button
        className="chat-panel-dropdown-toggle"
        type="button"
        ty-hint={tooltip}
        onClick={() => {
          closeOtherDropdown();
          isOpen.value = !isOpen.value;
        }}
      >
        {label}
        <svg
          className="dropdown-chevron"
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 5L0 0.5L8 0.5L4 5Z" fill="currentColor" />
        </svg>
      </button>

      {isOpen.value && (
        <div className="chat-panel-dropdown-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="chat-panel-dropdown-item"
              onClick={() => {
                onSelect(option.value);
                isOpen.value = false;
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface InputAreaProps {
  input: Signal<string>;
  promptType: Signal<string>;
  prompts: Signal<{ id: string; name: string; content: string }[]>;
  modelId: Signal<string>;
  models: ChatModel[];
  onSend: () => void;
  isSending: boolean;
  onStop?: () => void;
}

const InputArea: FC<InputAreaProps> = ({
  input,
  isSending,
  modelId,
  models,
  onSend,
  onStop,
  promptType,
  prompts,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLTextAreaElement>(null);
  const rows = useSignal(1);
  const isPromptDropdownOpen = useSignal(false);
  const isModelDropdownOpen = useSignal(false);

  // Handle Enter key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.ctrlKey) {
        input.value += "\n";
        return;
      }
      onSend();
    }
  };

  // Auto-resize textarea
  const updateRows = useCallback(
    (text: string) => {
      if (!measureRef.current) return;

      // Replace each empty line with a space so that empty lines are measured properly.
      measureRef.current.textContent = text
        ? text
            .split("\n")
            .map((line) => (line === "" ? " " : line))
            .join("\n")
        : " ";

      const totalHeight = measureRef.current.scrollHeight;
      const lineHeight = parseInt(
        window.getComputedStyle(measureRef.current).lineHeight
      );

      // Clear the content to prevent vertical scrollbar from appearing
      measureRef.current.textContent = "";

      const actualRows = Math.ceil(totalHeight / lineHeight);
      rows.value = Math.max(1, Math.min(6, actualRows)); // Cap at 6 rows
    },
    [rows]
  );

  useSignalEffect(() => {
    updateRows(input.value);
  });

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".chat-panel-dropdown-toggle") &&
        !target.closest(".chat-panel-dropdown-menu") &&
        (isPromptDropdownOpen.value || isModelDropdownOpen.value)
      ) {
        isPromptDropdownOpen.value = false;
        isModelDropdownOpen.value = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelDropdownOpen, isPromptDropdownOpen]);

  return (
    <div className="chat-panel-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={measureRef}
          style={{
            visibility: "hidden",
            paddingTop: "0",
            paddingBottom: "0",
            border: "none",
            position: "absolute",
            top: "-9999px",
          }}
        />

        <textarea
          ref={textareaRef}
          placeholder={t("chat.input-placeholder")}
          value={input.value}
          rows={rows.value}
          onChange={(e) =>
            (input.value = (e.target as HTMLTextAreaElement).value)
          }
          onKeyDown={(e) => handleKeyDown(e as unknown as KeyboardEvent)}
          disabled={isSending}
        />

        {/* Controls in the bottom toolbar */}
        <div className="chat-input-controls">
          {/* Prompt type dropdown */}
          <Dropdown
            label={(() => {
              const p = prompts.value.find((x) => x.id === promptType.value);
              return p?.name || t("chat.prompt-style.Normal");
            })()}
            isOpen={isPromptDropdownOpen}
            tooltip={t("chat.prompt-style.tooltip")}
            closeOtherDropdown={() => (isModelDropdownOpen.value = false)}
            options={prompts.value.map((p) => ({ value: p.id, label: p.name }))}
            onSelect={(value) => {
              promptType.value = value;
            }}
          />

          {/* Model type dropdown */}
          <Dropdown
            label={(() => {
              const model = models.find((m) => m.id === modelId.value);
              if (!model) return "";
              const key = `chat.models.${model.id}`;
              return (t.test(key) ? t.tran(key) : model.name) as string;
            })()}
            isOpen={isModelDropdownOpen}
            tooltip={t("chat.pick-model.tooltip")}
            closeOtherDropdown={() => (isPromptDropdownOpen.value = false)}
            options={models.map((model) => {
              const key = `chat.models.${model.id}`;
              return {
                value: model.id,
                label: (t.test(key) ? t.tran(key) : model.name) as string,
              };
            })}
            onSelect={(value) => (modelId.value = value)}
          />

          {/* Send / Stop button */}
          <button
            className={"chat-panel-send-btn" + (isSending ? " sending" : "")}
            disabled={
              onStop
                ? !isSending && !input.value.trim()
                : !input.value.trim() || isSending
            }
            onClick={() => {
              if (isSending) {
                onStop?.();
                return;
              }
              onSend();
            }}
            title={isSending ? t("chat.button.stop") : t("chat.button.send")}
          >
            {isSending ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <rect x="1" y="1" width="10" height="10" rx="1" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Watch theme change and switch highlight.js theme
setInterval(() => {
  const isDark =
    getLuminance(window.getComputedStyle(document.body).backgroundColor) < 0.5;
  (window as any).setHighlightjsTheme(isDark ? "dark" : "light");
}, 1000);

export let detachChatPanel: (() => void) | null = null;

export function attachChatPanel(): void {
  // Check if panel already exists (only one instance allowed)
  if (document.querySelector("#ai-chat-container")) return;

  // Get reference to content element
  const contentDiv = document.querySelector("content");
  if (!contentDiv?.parentNode) return; // Can’t attach if content doesn’t exist

  // Create container and position it after content
  const container = document.createElement("div");
  container.id = "ai-chat-container";
  container.style.position = "absolute";
  container.style.right = "0";
  container.style.bottom =
    (document
      .querySelector<HTMLDivElement>("#footer-ai")
      ?.getBoundingClientRect().height || 0) + "px";

  if (contentDiv.nextSibling)
    contentDiv.parentNode.insertBefore(container, contentDiv.nextSibling);
  else contentDiv.parentNode.appendChild(container);

  // Get saved width from localStorage or use default
  const savedWidth = localStorage.getItem("ai-chat-panel-width");
  const defaultWidth = Math.min(
    400,
    Math.max(
      280,
      (window.innerWidth - contentDiv.getBoundingClientRect().left) * 0.25
    )
  );
  let panelWidth = savedWidth ? parseInt(savedWidth) : defaultWidth;

  // Ensure width is within reasonable range
  panelWidth = Math.min(Math.max(panelWidth, 280), window.innerWidth * 0.5);

  // Update position and width
  const updatePosition = () => {
    const contentRect = contentDiv.getBoundingClientRect();
    (contentDiv as HTMLElement).style.right = `${panelWidth}px`;
    container.style.top = `${contentRect.top}px`;
    container.style.width = `${panelWidth}px`;
  };

  updatePosition();

  // Create resize handle element
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "chat-panel-resize-handle";

  // Handle drag events
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const startResize = (e: MouseEvent) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = panelWidth;
    resizeHandle.classList.add("resizing");
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
    document.body.style.userSelect = "none"; // Prevent text selection during drag
  };

  const resize = (e: MouseEvent) => {
    if (!isResizing) return;

    // Calculate new width (note direction: moving mouse left increases width)
    const dx = startX - e.clientX;
    panelWidth = Math.min(
      Math.max(startWidth + dx, 280),
      window.innerWidth * 0.5
    );

    // Update position
    updatePosition();
  };

  const stopResize = () => {
    isResizing = false;
    resizeHandle.classList.remove("resizing");
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
    document.body.style.userSelect = "";

    // Save width to localStorage
    localStorage.setItem("ai-chat-panel-width", String(panelWidth));
  };

  resizeHandle.addEventListener("mousedown", startResize);

  contentDiv.addEventListener("resize", updatePosition);
  window.addEventListener("resize", updatePosition);

  localStorage.setItem("ai-chat-panel-open", "true");

  const detach = () => {
    (contentDiv as HTMLElement).style.right = "0";
    contentDiv.removeEventListener("resize", updatePosition);
    window.removeEventListener("resize", updatePosition);
    localStorage.removeItem("ai-chat-panel-open");
    render(null, container);
    container.remove();
  };

  // Render the panel to the positioned container
  render(<ChatPanel onClose={detach} />, container);
  container.appendChild(resizeHandle); // Add resize handle after rendering

  detachChatPanel = detach;
}
