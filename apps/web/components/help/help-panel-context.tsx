"use client";

/**
 * Rapid Cortex — Help Panel Context
 *
 * Provides open/close state and active article to the entire app shell.
 * Wrap each dashboard shell with <HelpPanelProvider role={userRole}>.
 * Any component can call openHelp("topic") to jump to a specific article.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface HelpPanelContextValue {
  isOpen: boolean;
  activeTopic: string;
  role: string;
  openHelp: (topic?: string) => void;
  closeHelp: () => void;
}

const HelpPanelContext = createContext<HelpPanelContextValue>({
  isOpen: false,
  activeTopic: "index",
  role: "dispatcher",
  openHelp: () => {},
  closeHelp: () => {},
});

export function HelpPanelProvider({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState("index");

  const openHelp = useCallback((topic = "index") => {
    setActiveTopic(topic);
    setIsOpen(true);
  }, []);

  const closeHelp = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, activeTopic, role, openHelp, closeHelp }),
    [isOpen, activeTopic, role, openHelp, closeHelp],
  );

  return <HelpPanelContext.Provider value={value}>{children}</HelpPanelContext.Provider>;
}

export function useHelpPanel() {
  return useContext(HelpPanelContext);
}
