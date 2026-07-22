import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { CodeVertical } from '@/types/mobile';

export type FieldProduct = 'venue' | 'campus';

interface FieldProductContextValue {
  product: FieldProduct;
  /** Expo Router group prefix, e.g. `/(venue)` or `/(campus)`. */
  routePrefix: `/(${FieldProduct})`;
  vertical: CodeVertical;
  href: (path: string) => string;
}

const FieldProductContext = createContext<FieldProductContextValue | null>(null);

export function FieldProductProvider({
  product,
  children,
}: {
  product: FieldProduct;
  children: ReactNode;
}) {
  const value: FieldProductContextValue = {
    product,
    routePrefix: `/(${product})`,
    vertical: product,
    href: (path: string) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      return `/(${product})${normalized}`;
    },
  };
  return createElement(FieldProductContext.Provider, { value }, children);
}

export function useFieldProduct(): FieldProductContextValue {
  const ctx = useContext(FieldProductContext);
  if (!ctx) {
    throw new Error('useFieldProduct must be used within FieldProductProvider');
  }
  return ctx;
}
