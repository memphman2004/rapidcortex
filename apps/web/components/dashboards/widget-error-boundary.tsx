"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  widgetId: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/** Isolates a single dashboard widget failure from the rest of the page. */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[widget-error:${this.props.widgetId}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[72px] items-center justify-center rounded-xl border border-rose-900/30 bg-slate-900/80 p-4">
          <p className="text-xs text-rose-400">Widget failed to load</p>
        </div>
      );
    }
    return this.props.children;
  }
}
