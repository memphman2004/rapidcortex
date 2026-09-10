"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  interpolateTranslatePhrase,
  TRANSLATE_SPEAKER_LABELS,
  type TranslateSessionCreateRequest,
  type TranslateSpeaker,
  type TranslateVertical,
} from "rapid-cortex-shared";
import { getTranslateTheme } from "@/lib/translate/translate-theme";
import { useTranslateSession } from "@/lib/translate/use-translate-session";
import { LanguageSelector } from "./LanguageSelector";
import { PhrasePicker } from "./PhrasePicker";
import { TranscriptFeed } from "./TranscriptFeed";
import { WaveformIndicator } from "./WaveformIndicator";

export function TranslateSessionClient(props: {
  sessionId?: string;
  vertical: TranslateVertical;
  monitor?: boolean;
  createRequest?: TranslateSessionCreateRequest;
  heading?: string;
}) {
  const theme = getTranslateTheme(props.vertical);
  const labels = TRANSLATE_SPEAKER_LABELS[props.vertical];
  const phraseFirst = props.vertical !== "law_enforcement";
  const [pickerOpen, setPickerOpen] = useState(false);
  const autoOpened = useRef(false);
  const [subjectLanguage, setSubjectLanguage] = useState(
    props.createRequest?.subjectLanguage ?? "es",
  );
  const [speaker, setSpeaker] = useState<TranslateSpeaker>("officer");
  const createRequest = useMemo(
    () => ({ ...props.createRequest, vertical: props.vertical, subjectLanguage }),
    [props.createRequest, props.vertical, subjectLanguage],
  );
  const tx = useTranslateSession({
    sessionId: props.sessionId,
    vertical: props.vertical,
    monitor: props.monitor,
    createRequest,
  });

  useEffect(() => {
    if (phraseFirst && tx.session && !props.monitor && !autoOpened.current) {
      autoOpened.current = true;
      setPickerOpen(true);
    }
  }, [phraseFirst, props.monitor, tx.session]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "70vh",
        background: theme.bg,
        color: theme.textPrimary,
        fontFamily: theme.fontFamily,
        display: "flex",
        flexDirection: "column",
      }}
      onPointerDown={tx.unlockAudio}
    >
      {pickerOpen && !props.monitor ? (
        <PhrasePicker
          vertical={props.vertical}
          theme={theme}
          onSelectPhrase={(phrase) => {
            if (!tx.session) return;
            const text = interpolateTranslatePhrase(phrase.text, {
              section: tx.session.venueContext?.sectionLabel || tx.session.venueContext?.sectionCode,
              name: tx.session.officerName,
            });
            tx.sendPhrase({ ...phrase, text }, "officer");
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: `1px solid ${theme.border}`,
          background: theme.surface,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{props.heading ?? "RC Translate"}</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>
            {tx.session?.status ?? "Ready"} · {labels.primary} / {labels.secondary}
            {tx.connected ? " · live" : ""}
          </div>
        </div>
        <LanguageSelector
          value={tx.session?.subjectLanguage ?? subjectLanguage}
          onChange={setSubjectLanguage}
          theme={theme}
          disabled={Boolean(tx.session)}
        />
      </header>

      {tx.error ? (
        <div style={{ padding: "8px 16px", color: "#f87171", fontSize: 13 }}>{tx.error}</div>
      ) : null}

      <TranscriptFeed items={tx.feed} vertical={props.vertical} theme={theme} />

      <footer
        style={{
          padding: 16,
          borderTop: `1px solid ${theme.border}`,
          background: theme.surface,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <WaveformIndicator
          active={tx.listening}
          theme={theme}
          label={tx.listening ? `Listening as ${speaker === "officer" ? labels.primary : labels.secondary}` : "Mic idle"}
        />
        {!tx.session ? (
          <button
            type="button"
            onClick={() => void tx.start()}
            disabled={tx.starting}
            style={{
              background: theme.primaryColor,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tx.starting ? "Starting…" : "Start session"}
          </button>
        ) : props.monitor ? (
          <p style={{ margin: 0, fontSize: 12, color: theme.textMuted }}>Listen-only monitor</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {phraseFirst ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={btn(theme, false)}
              >
                Phrases
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSpeaker("officer")}
              style={btn(theme, speaker === "officer")}
            >
              {labels.primary}
            </button>
            <button
              type="button"
              onClick={() => setSpeaker("subject")}
              style={btn(theme, speaker === "subject")}
            >
              {labels.secondary}
            </button>
            {tx.listening ? (
              <button type="button" onClick={tx.stopMic} style={btn(theme, true)}>
                Stop
              </button>
            ) : (
              <button type="button" onClick={() => void tx.startMic(speaker)} style={btn(theme, false)}>
                Hold to speak
              </button>
            )}
            <button
              type="button"
              onClick={() => void tx.close(true)}
              style={{ ...btn(theme, false), marginLeft: "auto" }}
            >
              End + note
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function btn(theme: ReturnType<typeof getTranslateTheme>, active: boolean): CSSProperties {
  return {
    background: active ? theme.primaryColor : "transparent",
    color: active ? "#fff" : theme.textPrimary,
    border: `1px solid ${active ? theme.primaryColor : theme.border}`,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
  };
}
