import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "@/app/store";

// Typed wrappers around useDispatch/useSelector — use these instead of the
// plain react-redux hooks everywhere in the app so state/dispatch types are
// inferred correctly without repeating <RootState> at every call site.
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
