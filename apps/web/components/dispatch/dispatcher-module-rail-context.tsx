"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DockModuleKey, DockState } from "@/lib/dispatcher/module-dock";

export type DispatcherModuleRail = {
  dock: DockState;
  onOpen: (key: DockModuleKey) => void;
  modules?: ReadonlyArray<{ key: DockModuleKey; label: string }>;
  onPopOut?: (key: DockModuleKey) => void;
};

type DispatcherModuleRailContextValue = {
  rail: DispatcherModuleRail | null;
  setRail: (rail: DispatcherModuleRail | null) => void;
};

const DispatcherModuleRailContext = createContext<DispatcherModuleRailContextValue | null>(null);

export function DispatcherModuleRailProvider({ children }: { children: ReactNode }) {
  const [rail, setRail] = useState<DispatcherModuleRail | null>(null);
  const value = useMemo(() => ({ rail, setRail }), [rail]);
  return (
    <DispatcherModuleRailContext.Provider value={value}>{children}</DispatcherModuleRailContext.Provider>
  );
}

export function useDispatcherModuleRail() {
  return useContext(DispatcherModuleRailContext);
}

/** CAD workstation publishes dock state so the far-left Operations rail can list modules. */
export function useRegisterDispatcherModuleRail(
  dock: DockState,
  onOpen: (key: DockModuleKey) => void,
  extras?: {
    modules?: ReadonlyArray<{ key: DockModuleKey; label: string }>;
    onPopOut?: (key: DockModuleKey) => void;
  },
) {
  const ctx = useDispatcherModuleRail();
  const setRail = ctx?.setRail;
  const modules = extras?.modules;
  const onPopOut = extras?.onPopOut;

  useEffect(() => {
    if (!setRail) return;
    setRail({ dock, onOpen, modules, onPopOut });
  }, [setRail, dock, onOpen, modules, onPopOut]);

  useEffect(() => {
    if (!setRail) return;
    return () => setRail(null);
  }, [setRail]);
}
