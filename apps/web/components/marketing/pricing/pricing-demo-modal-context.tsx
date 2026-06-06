"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RequestDemoModal } from "./request-demo-modal";

type PricingDemoModalContextValue = {
  openDemo: () => void;
  closeDemo: () => void;
};

const PricingDemoModalContext = createContext<PricingDemoModalContextValue | null>(null);

export function PricingDemoModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDemo = useCallback(() => setOpen(true), []);
  const closeDemo = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      openDemo,
      closeDemo,
    }),
    [openDemo, closeDemo],
  );

  return (
    <PricingDemoModalContext.Provider value={value}>
      {children}
      <RequestDemoModal open={open} onClose={closeDemo} />
    </PricingDemoModalContext.Provider>
  );
}

export function usePricingDemoModal(): PricingDemoModalContextValue {
  const ctx = useContext(PricingDemoModalContext);
  if (!ctx) {
    throw new Error("usePricingDemoModal must be used within PricingDemoModalProvider");
  }
  return ctx;
}
