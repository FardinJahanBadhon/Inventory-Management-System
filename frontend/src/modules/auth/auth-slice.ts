import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthenticatedUserProfile } from "./auth-types";

interface AuthState {
  user: AuthenticatedUserProfile | null;
  isAuthenticated: boolean;
  // True until the startup session-restoration check (see
  // auth-initializer.tsx) resolves one way or the other. Route guards read
  // this to avoid rendering or redirecting before auth status is known.
  isInitializing: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitializing: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthenticatedUser(state, action: PayloadAction<AuthenticatedUserProfile>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitializing = false;
    },
    clearAuthenticatedUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    },
  },
});

export const { setAuthenticatedUser, clearAuthenticatedUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
