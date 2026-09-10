"use client";

import { useSearchParams } from "next/navigation";
import type { TranslateSessionCreateRequest, TranslateVertical } from "rapid-cortex-shared";
import { TranslateSessionClient } from "./TranslateSessionClient";

export function TranslateSessionPageClient(props: {
  sessionId: string;
  vertical: TranslateVertical;
  heading?: string;
  createRequest?: TranslateSessionCreateRequest;
  /** Force listen-only (campus faculty / dispatch monitor). */
  monitor?: boolean;
}) {
  const params = useSearchParams();
  const monitor = props.monitor === true || params.get("monitor") === "1";
  return (
    <TranslateSessionClient
      sessionId={props.sessionId}
      vertical={props.vertical}
      monitor={monitor}
      heading={props.heading}
      createRequest={props.createRequest}
    />
  );
}
