"use client";

/**
 * Rapid Cortex — Help Entry Points
 *
 * <HelpButton /> — header control
 * <ContextualHelp topic="silent-text" /> — inline feature ?
 */

import { HelpCircle } from "lucide-react";
import { useHelpPanel } from "./help-panel-context";

export function HelpButton() {
  const { openHelp } = useHelpPanel();

  return (
    <button
      type="button"
      onClick={() => openHelp("index")}
      aria-label="Open help and documentation"
      title="Help & Documentation"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: "1px solid #2a2440",
        borderRadius: 6,
        padding: "4px 10px",
        cursor: "pointer",
        color: "#7c6fa0",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        transition: "color 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.color = "#e4dff5";
        btn.style.borderColor = "#8b5cf6";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.color = "#7c6fa0";
        btn.style.borderColor = "#2a2440";
      }}
    >
      <HelpCircle size={13} />
      Help
    </button>
  );
}

export function ContextualHelp({
  topic,
  label,
}: {
  topic: string;
  label?: string;
}) {
  const { openHelp } = useHelpPanel();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openHelp(topic);
      }}
      aria-label={label ?? `Help with ${topic}`}
      title={label ?? "How to use this feature"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "none",
        border: "1px solid #3d3460",
        cursor: "pointer",
        color: "#5a4d7a",
        padding: 0,
        verticalAlign: "middle",
        marginLeft: 4,
        flexShrink: 0,
        transition: "color 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.color = "#8b5cf6";
        btn.style.borderColor = "#8b5cf6";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.color = "#5a4d7a";
        btn.style.borderColor = "#3d3460";
      }}
    >
      <HelpCircle size={10} />
    </button>
  );
}
