/* eslint-disable react-hooks/rules-of-hooks */
import type { Signal } from "@preact/signals";
import { signal, useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import { debounce, mapValues } from "radash";
import semverGte from "semver/functions/gte";
import semverValid from "semver/functions/valid";
import { kebabCase } from "string-ts";

import { t } from "@/i18n";
import type { Settings } from "@/settings";
import { settings } from "@/settings";
import type { _Id } from "@/types/tools";
import { runCommand } from "@/utils/cli-tools";
import type { NodeRuntime } from "@/utils/node-bridge";
import {
  getAllAvailableNodeRuntimes,
  getCurrentNodeRuntime,
  setCurrentNodeRuntime,
} from "@/utils/node-bridge";
import { entriesOf, keysOf } from "@/utils/tools";

import DropdownWithInput from "./DropdownWithInput";
import ModalBody from "./ModalBody";
import ModalCloseButton from "./ModalCloseButton";
import ModalContent from "./ModalContent";
import ModalOverlay from "./ModalOverlay";
import ModalTitle from "./ModalTitle";
import ModalHeader from "./ModelHeader";
import Switch from "./Switch";
import { NodejsIcon, SettingsIcon } from "./icons";

interface SettingControl<K extends keyof Settings> {
  position: "right" | "bottom";
  component: (key: K, signal: Signal<Settings[K]>) => preact.JSX.Element;
}
type TypedSettingControl<T> = SettingControl<
  keyof { [K in keyof Settings as Settings[K] extends T ? K : never]: void }
>;

const BooleanSettingControl: TypedSettingControl<boolean> = {
  position: "right",
  component: (key, signal) => (
    <Switch
      value={signal.value}
      onChange={(value) => {
        signal.value = value;
        settings[key] = value;
      }}
    />
  ),
};

/** Slider + number input combo for numeric settings. */
const SliderInput: FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  recommended?: number;
  unit?: string;
  onChange: (v: number) => void;
  style?: preact.CSSProperties;
}> = ({ max, min, onChange, recommended, step, style, unit, value }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={(ev) =>
              onChange(parseFloat((ev.target as HTMLInputElement).value))
            }
            style={{ flex: 1, margin: 0 }}
          />
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={(ev) =>
              onChange(parseFloat((ev.target as HTMLInputElement).value))
            }
            style={{
              width: "3.8rem",
              padding: "0.15rem 0.35rem",
              fontSize: "0.8rem",
              textAlign: "right",
              borderRadius: "4px",
              border: "1px solid var(--border-color, #ccc)",
              background: "var(--bg-color)",
              color: "var(--text-color)",
            }}
          />
          {unit && (
            <span
              style={{ fontSize: "0.7rem", opacity: 0.5, whiteSpace: "nowrap" }}
            >
              {unit}
            </span>
          )}
        </div>
      </div>
      {recommended != null && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>
            {t.test("settings-panel.general.recommended-value")
              ? t.tran("settings-panel.general.recommended-value")
              : "Recommended"}
            : {recommended}
          </span>
          {value !== recommended && (
            <button
              type="button"
              className="unset-button"
              style={{
                fontSize: "0.65rem",
                padding: "0 0.35rem",
                cursor: "pointer",
                color: "var(--primary-color, #4078c0)",
                textDecoration: "underline",
              }}
              onClick={() => onChange(recommended)}
            >
              {t.test("settings-panel.general.reset-to-default")
                ? t.tran("settings-panel.general.reset-to-default")
                : "Reset"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

type Categories = Record<string, { [K in keyof Settings]?: SettingControl<K> }>;
// Module-level signals (referenced in categories & component)
const customProviderModalOpen = signal(false);
const currentProvider = signal(settings.provider);
const customApiBaseSignal = signal(settings.customApiBase);
const customApiKeySignal = signal(settings.customApiKey);
const customChatModelSignal = signal(settings.customChatModel);
const customCompletionModelSignal = signal(settings.customCompletionModel);

const categories = {
  general: {
    language: {
      position: "bottom",
      component: (key, signal) => (
        <select
          style={{
            width: "100%",
            padding: "0.25rem 0.5rem",
            marginTop: "0.5rem",
          }}
          value={signal.value as string}
          onChange={(ev) => {
            const v = (ev.target as HTMLSelectElement).value as
              | "auto"
              | "en"
              | "zh-CN"
              | "ja";
            signal.value = v;
            settings[key] = v;
          }}
        >
          <option value="auto">Auto (系统) / Auto (System)</option>
          <option value="en">English</option>
          <option value="zh-CN">中文</option>
          <option value="ja">日本語</option>
        </select>
      ),
    },
    disableCompletions: BooleanSettingControl,
    useInlineCompletionTextInSource: BooleanSettingControl,
    useInlineCompletionTextInPreviewCodeBlocks: BooleanSettingControl,
    completionMaxTokens: {
      position: "bottom",
      component: (key, signal) => (
        <SliderInput
          value={signal.value as number}
          min={10}
          max={200}
          step={5}
          recommended={40}
          unit="tokens"
          onChange={(v) => {
            signal.value = v;
            settings[key] = v;
          }}
        />
      ),
    },
    completionTemperature: {
      position: "bottom",
      component: (key, signal) => (
        <SliderInput
          value={signal.value as number}
          min={0}
          max={2}
          step={0.1}
          recommended={0.1}
          onChange={(v) => {
            signal.value = v;
            settings[key] = v;
          }}
        />
      ),
    },
  },
  "ai-provider": {
    provider: {
      position: "bottom",
      component: (key, signal) => {
        const prevProvider = useSignal(signal.value as string);

        return (
          <select
            style={{
              width: "100%",
              padding: "0.25rem 0.5rem",
              marginTop: "0.5rem",
            }}
            value={signal.value as string}
            onChange={(ev) => {
              const value = (ev.target as HTMLSelectElement).value as
                | "copilot"
                | "deepseek"
                | "custom";
              if (value === "custom") {
                // Sync saved values into modal form fields, then open
                customApiBaseSignal.value = settings.customApiBase;
                customApiKeySignal.value = settings.customApiKey;
                customChatModelSignal.value = settings.customChatModel;
                customCompletionModelSignal.value =
                  settings.customCompletionModel;
                customProviderModalOpen.value = true;
                // Revert dropdown to previous value; modal will apply change on save
                (ev.target as HTMLSelectElement).value = prevProvider.value;
              } else {
                prevProvider.value = value;
                signal.value = value;
                settings[key] = value;
                currentProvider.value = value;
              }
            }}
          >
            <option value="copilot">GitHub Copilot</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">自定义大模型 →</option>
          </select>
        );
      },
    },
    deepseekApiKey: {
      position: "bottom",
      component: (key, signal) => {
        const showKey = useSignal(false);

        // Only show API key setting when DeepSeek is selected
        if (currentProvider.value !== "deepseek") return <></>;

        return (
          <div style={{ width: "100%", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <input
                type={showKey.value ? "text" : "password"}
                value={signal.value as string}
                onInput={(ev) => {
                  const value = (ev.target as HTMLInputElement).value;
                  signal.value = value;
                  settings[key] = value;
                }}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{
                  width: "100%",
                  padding: "0.25rem 0.5rem",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                className="unset-button"
                style={{
                  padding: "0.25rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
                onClick={() => {
                  showKey.value = !showKey.value;
                }}
              >
                {showKey.value ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        );
      },
    },
    deepseekModel: {
      position: "bottom",
      component: (key, signal) => {
        // Only show model setting when DeepSeek is selected
        if (currentProvider.value !== "deepseek") return <></>;

        const knownModels = ["deepseek-v4-flash", "deepseek-v4-pro"];

        return (
          <div style={{ marginTop: "0.5rem" }}>
            <input
              type="text"
              list="deepseek-model-list"
              value={signal.value as string}
              onInput={(ev) => {
                const value = (ev.target as HTMLInputElement).value;
                signal.value = value;
                settings[key] = value;
              }}
              placeholder="输入模型名，如 deepseek-v4-flash"
              style={{
                width: "100%",
                padding: "0.25rem 0.5rem",
                fontFamily: "monospace",
              }}
            />
            <datalist id="deepseek-model-list">
              {knownModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <div
              style={{
                marginTop: "0.25rem",
                fontSize: "0.7rem",
                opacity: 0.6,
                lineHeight: 1,
              }}
            >
              {t.test("settings-panel.ai-provider.deepseek-model.hint")
                ? t("settings-panel.ai-provider.deepseek-model.hint")
                : "输入任意模型名。已知可用：deepseek-v4-flash, deepseek-v4-pro"}
            </div>
          </div>
        );
      },
    },
    customPrompts: {
      position: "bottom",
      component: (_key, _signal) => {
        const prompts = useSignal(structuredClone(settings.customPrompts));
        const expandedId = useSignal<string | null>(null);
        const syncToSettings = (updated: typeof prompts.value) => {
          prompts.value = updated;
          settings.customPrompts = structuredClone(updated);
        };

        // Only show when DeepSeek or Custom provider is selected (not Copilot)
        if (currentProvider.value === "copilot") return <></>;

        const isBuiltin = (id: string) =>
          id === "builtin-normal" || id === "builtin-academic";

        return (
          <div style={{ marginTop: "0.5rem" }}>
            {prompts.value.length === 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.5,
                  marginBottom: "0.5rem",
                }}
              >
                {t.test("chat.prompt-style.no-custom-prompts")
                  ? t.tran("chat.prompt-style.no-custom-prompts")
                  : "暂无自定义风格，点击下方按钮创建。"}
              </div>
            )}
            {prompts.value.map((prompt) => (
              <div
                key={prompt.id}
                style={{
                  marginBottom: "0.375rem",
                  border: "1px solid var(--border-color, #ccc)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {/* Collapsed row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.3rem 0.5rem",
                    cursor: "pointer",
                    background:
                      expandedId.value === prompt.id
                        ? "var(--item-hover-bg-color, rgba(0,0,0,0.03))"
                        : "transparent",
                    fontSize: "0.8rem",
                  }}
                  onClick={() => {
                    expandedId.value =
                      expandedId.value === prompt.id ? null : prompt.id;
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      fontSize: "0.6rem",
                      opacity: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {expandedId.value === prompt.id ? "▼" : "▶"}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginLeft: "0.25rem",
                    }}
                  >
                    {prompt.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      opacity: 0.4,
                      marginLeft: "0.5rem",
                      flexShrink: 0,
                    }}
                  >
                    {prompt.content.length > 0
                      ? `${prompt.content.length} chars`
                      : "empty"}
                  </span>
                </div>

                {/* Expanded editor */}
                {expandedId.value === prompt.id && (
                  <div
                    style={{
                      padding: "0.5rem",
                      borderTop: "1px solid var(--border-color, #ccc)",
                    }}
                  >
                    <input
                      type="text"
                      value={prompt.name}
                      placeholder={t.tran(
                        "chat.prompt-style.prompt-name-placeholder"
                      )}
                      onInput={(ev) => {
                        prompt.name = (ev.target as HTMLInputElement).value;
                        syncToSettings([...prompts.value]);
                      }}
                      style={{
                        width: "100%",
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        marginBottom: "0.375rem",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color, #ccc)",
                        background: "var(--bg-color)",
                        color: "var(--text-color)",
                      }}
                    />
                    <textarea
                      value={prompt.content}
                      placeholder={t.tran(
                        "chat.prompt-style.prompt-content-placeholder"
                      )}
                      rows={5}
                      onInput={(ev) => {
                        prompt.content = (
                          ev.target as HTMLTextAreaElement
                        ).value;
                        syncToSettings([...prompts.value]);
                      }}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                        resize: "vertical",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color, #ccc)",
                        background: "var(--bg-color)",
                        color: "var(--text-color)",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.375rem",
                        marginTop: "0.375rem",
                      }}
                    >
                      <button
                        type="button"
                        className="unset-button"
                        style={{
                          padding: "0.2rem 0.6rem",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          border: "1px solid var(--border-color, #ccc)",
                          borderRadius: "3px",
                          background: "transparent",
                          color: "var(--text-color)",
                        }}
                        onClick={() => {
                          expandedId.value = null;
                        }}
                      >
                        {t.test("button.done") ? t.tran("button.done") : "Done"}
                      </button>
                      {!isBuiltin(prompt.id) && (
                        <button
                          type="button"
                          className="unset-button"
                          style={{
                            padding: "0.2rem 0.6rem",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            color: "#e53935",
                            border: "1px solid #e53935",
                            borderRadius: "3px",
                            background: "transparent",
                          }}
                          onClick={() => {
                            const doDelete = () => {
                              syncToSettings(
                                prompts.value.filter((p) => p.id !== prompt.id)
                              );
                              expandedId.value = null;
                            };
                            if (
                              typeof Files !== "undefined" &&
                              Files.editor?.EditHelper?.showDialog
                            ) {
                              Files.editor.EditHelper.showDialog({
                                title: prompt.name,
                                type: "warning",
                                html: `<p>${t.tran("chat.prompt-style.delete-prompt-confirm").replace("{{NAME}}", prompt.name)}</p>`,
                                buttons: [
                                  t("button.delete"),
                                  t("button.cancel"),
                                ],
                                callback: (result: number) => {
                                  if (result === 0) doDelete();
                                },
                              });
                            } else {
                              doDelete();
                            }
                          }}
                        >
                          {t.test("button.delete")
                            ? t.tran("button.delete")
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              style={{
                marginTop: "0.25rem",
                padding: "0.25rem 0.75rem",
                cursor: "pointer",
                fontSize: "0.8rem",
                border: "1px dashed var(--border-color, #ccc)",
                borderRadius: "4px",
                background: "transparent",
                color: "var(--text-color)",
              }}
              onClick={() => {
                const newPrompt = {
                  id:
                    crypto.randomUUID?.() ||
                    Math.random().toString(36).slice(2),
                  name: t.tran("chat.prompt-style.default-custom-name"),
                  content: "",
                };
                syncToSettings([...prompts.value, newPrompt]);
                expandedId.value = newPrompt.id;
              }}
            >
              +{" "}
              {t.tran("chat.prompt-style.new-custom-prompt").replace("+ ", "")}
            </button>
          </div>
        );
      },
    },
  },
  nodejs: {
    nodePath: {
      position: "bottom",
      component: (key, signal) => {
        const optionAuto = (() => {
          if (getAllAvailableNodeRuntimes().length === 0) return null;
          const { path, version } =
            getAllAvailableNodeRuntimes().find(
              ({ path }) => path === "bundled"
            ) ?? getAllAvailableNodeRuntimes()[0]!;
          return (
            `${t("settings-panel.nodejs.constant.PATH_AUTO_DETECT")} ` +
            `(${path === "bundled" ? t("settings-panel.nodejs.constant.PATH_BUNDLED") : path}, ` +
            `${version.startsWith("v") ? version : "v" + version})`
          );
        })();
        const options = [
          ...(optionAuto ? [optionAuto] : []),
          ...getAllAvailableNodeRuntimes()
            .filter(({ path }) => path !== "bundled")
            .map(
              ({ path, version }) =>
                `${path} (${version.startsWith("v") ? version : "v" + version})`
            ),
        ];

        const currentVersion = useSignal(getCurrentNodeRuntime().version);

        const inputType = useSignal<"default" | "passed" | "failed">(
          getCurrentNodeRuntime().path === "not found" ? "failed" : "default"
        );
        const forceFocusInput = useSignal(false);
        const info = useSignal(
          getCurrentNodeRuntime().path === "not found"
            ? options.length > 0
              ? t(
                  "settings-panel.nodejs.node-path.message.warn-empty-select-or-input"
                )
              : t("settings-panel.nodejs.node-path.message.warn-empty-input")
            : ""
        );
        const infoColor = useSignal(
          getCurrentNodeRuntime().path === "not found"
            ? /* text-red-500 */ "#f56565"
            : /* text-blue-500 */ "#4299e1"
        );
        const dropdownMarginTop = useSignal(
          getCurrentNodeRuntime().path === "not found" ? "1.75rem" : "default"
        );

        const parseOption = (option: string): NodeRuntime => {
          const parts = option.split(" ");

          if (option === optionAuto) {
            let path = parts
              .slice(0, -1)
              .join(" ")
              .slice(
                t("settings-panel.nodejs.constant.PATH_AUTO_DETECT").length + 2,
                -1
              );
            if (path === t("settings-panel.nodejs.constant.PATH_BUNDLED"))
              path = "bundled";
            const version = parts[parts.length - 1]!.slice(0, -1);
            return { path, version };
          }

          if (parts.length < 2) return { path: option, version: "unknown" };
          const lastPart = parts[parts.length - 1];
          if (!lastPart || !lastPart.startsWith("(") || !lastPart.endsWith(")"))
            return { path: option, version: "unknown" };
          const version = lastPart.slice(1, -1);
          if (!semverValid(version))
            return { path: option, version: "unknown" };
          return {
            path: parts.slice(0, -1).join(" "),
            version: version.startsWith("v") ? version : `v${version}`,
          };
        };

        const retrieveRuntimeVersion = useMemo(
          () =>
            debounce(
              { delay: 500 },
              (() => {
                let latestTimestamp = 0;

                return (path: string) => {
                  const timestamp = Date.now();
                  latestTimestamp = timestamp;

                  runCommand(`"${path}" -v`)
                    .then((output) => {
                      if (latestTimestamp !== timestamp) return;
                      const version = output.trim();
                      if (!version) throw new Error("No version found");
                      if (!semverValid(version))
                        throw new Error(`Invalid version: ${version}`);
                      if (semverGte(version, "20.0.0")) {
                        setCurrentNodeRuntime({ path, version });
                        settings[key] = path;
                        signal.value = path;
                        currentVersion.value = version;
                        inputType.value = "passed";
                        forceFocusInput.value = false;
                        info.value = t(
                          "settings-panel.nodejs.node-path.message.updated"
                        )
                          .replace("{{PATH}}", path)
                          .replace("{{VERSION}}", version);
                        infoColor.value = "#48bb78"; // text-green-500
                      } else {
                        inputType.value = "failed";
                        forceFocusInput.value = false;
                        info.value = t(
                          "settings-panel.nodejs.node-path.message.warn-invalid-version"
                        )
                          .replace("{{PATH}}", path)
                          .replace("{{VERSION}}", version);
                        infoColor.value = "#f56565"; // text-red-500
                      }
                    })
                    .catch(() => {
                      if (latestTimestamp !== timestamp) return;
                      inputType.value = "failed";
                      forceFocusInput.value = false;
                      info.value = t(
                        "settings-panel.nodejs.node-path.message.warn-invalid"
                      ).replace("{{PATH}}", path);
                      infoColor.value = "#f56565"; // text-red-500
                    });
                };
              })()
            ),
          [
            currentVersion,
            key,
            signal,
            inputType,
            forceFocusInput,
            info,
            infoColor,
          ]
        );

        return (
          <div style={{ width: "100%", marginTop: "0.75rem" }}>
            <DropdownWithInput
              type={inputType.value}
              forceFocus={forceFocusInput.value}
              dropdownMarginTop={dropdownMarginTop.value}
              options={options}
              value={
                signal.value === null
                  ? (optionAuto ?? "")
                  : signal.value +
                    (currentVersion.value === "unknown"
                      ? ""
                      : ` (${currentVersion.value})`)
              }
              onChange={(option) => {
                const runtime = parseOption(option);
                signal.value = option === optionAuto ? null : runtime.path;
                currentVersion.value = runtime.version;

                if (!runtime.path) {
                  inputType.value = "failed";
                  info.value =
                    options.length > 0
                      ? t(
                          "settings-panel.nodejs.node-path.message.warn-empty-select-or-input"
                        )
                      : t(
                          "settings-panel.nodejs.node-path.message.warn-empty-input"
                        );
                  infoColor.value = "#f56565"; // text-red-500
                  dropdownMarginTop.value = "1.75rem";
                  return;
                }

                if (options.includes(option)) {
                  setCurrentNodeRuntime(runtime);
                  if (option === optionAuto) settings.clear(key);
                  else settings[key] = runtime.path;
                  inputType.value = "passed";
                  forceFocusInput.value = false;
                  info.value =
                    option === optionAuto
                      ? t(
                          "settings-panel.nodejs.node-path.message.updated-auto"
                        )
                      : t("settings-panel.nodejs.node-path.message.updated")
                          .replace("{{PATH}}", runtime.path)
                          .replace("{{VERSION}}", runtime.version);
                  infoColor.value = "#48bb78"; // text-green-500
                } else {
                  inputType.value = "default";
                  forceFocusInput.value = true;
                  info.value = t(
                    "settings-panel.nodejs.node-path.message.retrieving-version"
                  ).replace("{{PATH}}", runtime.path);
                  infoColor.value = "#4299e1"; // text-blue-500
                  dropdownMarginTop.value = "1.75rem";
                  retrieveRuntimeVersion(runtime.path);
                }
              }}
              onOpenDropdown={() => {
                if (inputType.value === "passed") inputType.value = "default";
              }}
              onCloseDropdown={() => {
                if (inputType.value === "default" && !forceFocusInput.value)
                  info.value = "";
                dropdownMarginTop.value = "default";
              }}
            />

            {info.value && (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  lineHeight: 1,
                  color: infoColor.value,
                }}
              >
                {info.value}
              </div>
            )}
          </div>
        );
      },
    },
  },
} as const satisfies Categories;

const categoryIcons = {
  general: <SettingsIcon size={18} />,
  "ai-provider": (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M8 14h8" />
      <path d="M10 10h4" />
      <path d="M8 18h8" />
      <circle cx="12" cy="21" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  nodejs: <NodejsIcon size={18} />,
} as const satisfies Record<keyof typeof categories, preact.JSX.Element>;

type CategoriesSignals<C extends Categories> = _Id<{
  [K in keyof C]: {
    [P in keyof C[K]]: C[K][P] extends SettingControl<infer K>
      ? Signal<Settings[K]>
      : never;
  };
}>;

export interface SettingsPanelProps {
  open?: boolean;
  onClose?: () => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({ onClose }) => {
  const selectedCategory = useSignal(
    Object.keys(categories)[0] as keyof typeof categories
  );
  const signals = mapValues(categories, (category) =>
    mapValues(category as never, (_, key) => useSignal(settings[key]))
  ) as CategoriesSignals<typeof categories>;

  return (
    <>
      <ModalOverlay onClose={onClose}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("settings-panel.title")}</ModalTitle>
            <ModalCloseButton onClick={onClose} />
          </ModalHeader>
          <ModalBody
            style={{
              paddingTop: "1rem",
              display: "flex",
              flexDirection: "row",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              {keysOf(categories).map((category, i, arr) => (
                <MenuButton
                  key={category}
                  selected={selectedCategory.value === category}
                  onClick={() => {
                    selectedCategory.value = category;
                  }}
                  style={{
                    marginBottom: i === arr.length - 1 ? "0" : "0.5rem",
                  }}
                >
                  {categoryIcons[category]}
                  <span style={{ marginLeft: "0.375rem" }}>
                    {t(`settings-panel.${category}.title`)}
                  </span>
                </MenuButton>
              ))}
            </div>

            <div
              style={{
                paddingLeft: "2rem",
                paddingRight: "1rem",
                paddingTop: "0.25rem",
                paddingBottom: "1rem",
                fontSize: "0.875rem",
                width: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {t.test(`settings-panel.${selectedCategory.value}.note`) && (
                <div
                  style={{ fontSize: "0.75rem", lineHeight: 1, opacity: 0.75 }}
                >
                  <span>
                    * {t.tran(`settings-panel.${selectedCategory.value}.note`)}
                  </span>
                  <hr
                    style={{
                      height: 0,
                      margin: "1rem 0",
                      border: "none",
                      background: "transparent",
                      borderTop: "1px dashed",
                    }}
                  />
                </div>
              )}
              {entriesOf(categories[selectedCategory.value]).map(
                ([key, control], i, arr) => (
                  <>
                    <div key={key} style={{ width: "100%" }}>
                      {(() => {
                        if (control.position === "right")
                          return (
                            <>
                              <div
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span>
                                  {t.tran(
                                    `settings-panel.${selectedCategory.value}.${kebabCase(key)}.label`
                                  )}
                                </span>
                                {control.component(
                                  key as never,
                                  (signals[selectedCategory.value] as never)[
                                    key
                                  ]
                                )}
                              </div>
                              <div
                                style={{
                                  marginTop: "0.5rem",
                                  fontSize: "0.75rem",
                                  lineHeight: 1,
                                  opacity: 0.75,
                                }}
                              >
                                {t.tran(
                                  `settings-panel.${selectedCategory.value}.${kebabCase(key)}.description`
                                )}
                              </div>
                            </>
                          );
                        /* position: bottom */
                        return (
                          <>
                            <div>
                              {t.tran(
                                `settings-panel.${selectedCategory.value}.${kebabCase(key)}.label`
                              )}
                            </div>
                            <div
                              style={{
                                marginTop: "0.5rem",
                                fontSize: "0.75rem",
                                lineHeight: 1,
                                opacity: 0.75,
                              }}
                            >
                              {t.tran(
                                `settings-panel.${selectedCategory.value}.${kebabCase(key)}.description`
                              )}
                            </div>
                            <div style={{ marginTop: "0.5rem" }}>
                              {control.component(
                                key as never,
                                (signals[selectedCategory.value] as never)[key]
                              )}
                            </div>
                          </>
                        );
                      })()}

                      {t.test(
                        `settings-panel.${selectedCategory.value}.${kebabCase(key)}.warning`
                      ) && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            fontSize: "0.75rem",
                            lineHeight: 1,
                            color: "#ef4444",
                          }}
                        >
                          {t.tran(
                            `settings-panel.${selectedCategory.value}.${kebabCase(key)}.warning`
                          )}
                        </div>
                      )}
                    </div>

                    {i !== arr.length - 1 && (
                      <hr
                        style={{ width: "100%", margin: "1.375rem 0 1rem 0" }}
                      />
                    )}
                  </>
                )
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </ModalOverlay>

      {/* Custom Provider Configuration Modal — sibling, not nested */}
      {customProviderModalOpen.value && (
        <ModalOverlay
          onClose={() => {
            customProviderModalOpen.value = false;
          }}
        >
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Configure Custom Provider</ModalTitle>
              <ModalCloseButton
                onClick={() => {
                  customProviderModalOpen.value = false;
                }}
              />
            </ModalHeader>
            <ModalBody
              style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                minWidth: "360px",
              }}
            >
              <div>
                <div
                  style={{
                    marginBottom: "0.25rem",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  API Base URL
                </div>
                <input
                  type="text"
                  value={customApiBaseSignal}
                  placeholder="https://api.openai.com/v1"
                  onInput={(ev) => {
                    customApiBaseSignal.value = (
                      ev.target as HTMLInputElement
                    ).value;
                  }}
                  style={{
                    width: "100%",
                    padding: "0.25rem 0.5rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    marginBottom: "0.25rem",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  API Key
                </div>
                <input
                  type="password"
                  value={customApiKeySignal}
                  placeholder="sk-..."
                  onInput={(ev) => {
                    customApiKeySignal.value = (
                      ev.target as HTMLInputElement
                    ).value;
                  }}
                  style={{
                    width: "100%",
                    padding: "0.25rem 0.5rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    marginBottom: "0.25rem",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Chat Model
                </div>
                <input
                  type="text"
                  list="custom-model-datalist"
                  value={customChatModelSignal}
                  placeholder="gpt-4o"
                  onInput={(ev) => {
                    customChatModelSignal.value = (
                      ev.target as HTMLInputElement
                    ).value;
                  }}
                  style={{
                    width: "100%",
                    padding: "0.25rem 0.5rem",
                    fontFamily: "monospace",
                  }}
                />
                <datalist id="custom-model-datalist">
                  {[
                    "gpt-4o",
                    "gpt-4o-mini",
                    "claude-3-5-sonnet",
                    "llama-3-70b",
                  ].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <div
                  style={{
                    marginBottom: "0.25rem",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  Completion Model{" "}
                  <span style={{ fontWeight: 300, opacity: 0.6 }}>
                    (optional)
                  </span>
                </div>
                <input
                  type="text"
                  value={customCompletionModelSignal}
                  placeholder="(uses chat model if empty)"
                  onInput={(ev) => {
                    customCompletionModelSignal.value = (
                      ev.target as HTMLInputElement
                    ).value;
                  }}
                  style={{
                    width: "100%",
                    padding: "0.25rem 0.5rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="unset-button"
                  style={{
                    padding: "0.4rem 1rem",
                    cursor: "pointer",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                  }}
                  onClick={() => {
                    customProviderModalOpen.value = false;
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: "0.4rem 1.2rem",
                    cursor: "pointer",
                    background: "var(--primary-color, #4078c0)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                  onClick={() => {
                    settings.customApiBase = customApiBaseSignal.value;
                    settings.customApiKey = customApiKeySignal.value;
                    settings.customChatModel = customChatModelSignal.value;
                    settings.customCompletionModel =
                      customCompletionModelSignal.value;
                    settings.provider = "custom";
                    currentProvider.value = "custom";
                    // Update the provider dropdown signal
                    const providerSignal = (
                      signals["ai-provider"] as Record<string, Signal<unknown>>
                    )["provider"];
                    if (providerSignal) providerSignal.value = "custom";
                    customProviderModalOpen.value = false;
                  }}
                >
                  Save & Apply
                </button>
              </div>
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

const MenuButton: FC<{
  selected?: boolean;
  onClick?: () => void;
  style?: preact.CSSProperties;
}> = ({ children, onClick, selected = false, style: additionalStyle }) => {
  const style: preact.CSSProperties = {
    width: "100%",
    fontSize: "0.875rem",
    height: "fit-content",
    paddingTop: "0.25rem",
    paddingBottom: "0.25rem",
    paddingLeft: "0.5rem",
    paddingRight: "0.75rem",
    borderRadius: "0.5rem",
    display: "flex",
    whiteSpace: "nowrap",
    alignItems: "center",
    justifyContent: "flex-start",
    cursor: selected ? "default" : "pointer",
    backgroundColor: selected ? "var(--item-hover-bg-color)" : "transparent",
    ...(selected ? { pointerEvents: "none" } : {}),
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    ...additionalStyle,
  };
  return selected ? (
    <button className="unset-button" style={style} disabled>
      {children}
    </button>
  ) : (
    <button
      type="button"
      className="unset-button"
      style={style}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default SettingsPanel;
