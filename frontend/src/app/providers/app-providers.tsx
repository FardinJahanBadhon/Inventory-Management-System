import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/app/store";

// Single, predictable place to compose app-wide providers. Redux is the
// only one needed so far; a theme provider or toast provider added in a
// later phase is wired in here too, not scattered across main.tsx.
export function AppProviders({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
