import type { CopilotStatus } from "@/client";

import Spinner from "./Spinner";

export interface AIIconProps {
  status: CopilotStatus | "Disabled";
  textColor: string;
  style?: preact.CSSProperties;
}

/**
 * Generic AI assistant icon — sparkles/magic design.
 * Replaces the old Copilot-branded logo.
 */
const AIIcon: FC<AIIconProps> = ({ status, style, textColor }) => {
  return (
    <div
      style={{
        height: "50%",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...style,
      }}
    >
      {(() => {
        if (status === "InProgress") return <Spinner color={textColor} />;
        if (status === "Normal")
          return (
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{ height: "100%", width: "100%" }}
            >
              <path
                d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z"
                fill={textColor}
              />
              <path
                d="M4 18l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4z"
                fill={textColor}
                opacity="0.5"
              />
            </svg>
          );
        if (status === "Warning")
          return (
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{ height: "100%", width: "100%" }}
            >
              <path
                d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z"
                fill={textColor}
              />
              <path
                d="M4 18l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4z"
                fill={textColor}
                opacity="0.5"
              />
              <circle cx="19" cy="5" r="5" fill="#e74c3c" />
              <line
                x1="19"
                y1="3"
                x2="19"
                y2="7"
                stroke="white"
                stroke-width="1.5"
              />
              <line
                x1="19"
                y1="7.5"
                x2="19"
                y2="8"
                stroke="white"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          );
        /* Disabled */
        return (
          <svg
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ height: "100%", width: "100%" }}
          >
            <path
              d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z"
              fill={textColor}
              opacity="0.4"
            />
            <path
              d="M4 18l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4z"
              fill={textColor}
              opacity="0.2"
            />
            <line
              x1="2"
              y1="2"
              x2="22"
              y2="22"
              stroke={textColor}
              stroke-width="2"
              opacity="0.5"
            />
          </svg>
        );
      })()}
    </div>
  );
};

export default AIIcon;
