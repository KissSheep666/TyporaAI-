import { getCaretCoordinate } from "@/utils/dom";

import "./SuggestionPanel.scss";

export const attachSuggestionPanel = (
  text: string,
  _mode: unknown = null,
  _options?: unknown
) => {
  if (!text) return () => {};

  const pos = getCaretCoordinate();
  if (!pos) return () => {};

  const ghost = document.createElement("div");
  ghost.className = "suggestion-ghost";
  ghost.textContent = text;
  ghost.style.left = `${pos.x}px`;
  ghost.style.top = `${pos.y}px`;

  document.body.appendChild(ghost);

  // Reposition on scroll
  const onScroll = () => {
    const p = getCaretCoordinate();
    if (!p) return;
    ghost.style.left = `${p.x}px`;
    ghost.style.top = `${p.y}px`;
  };
  $("content").on("scroll", onScroll);

  return () => {
    $("content").off("scroll", onScroll);
    ghost.remove();
  };
};

export default null;
