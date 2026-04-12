'use client';

import * as React from 'react';

export const ShellHeaderInsetSetterContext = React.createContext<
  ((node: React.ReactNode | null) => void) | null
>(null);

export function useShellHeaderInsetSetter() {
  return React.useContext(ShellHeaderInsetSetterContext);
}
