import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "@/api/base-api";

// The auth slice (session/user/location state) is added in Phase 5 once
// login exists. For now the store only wires up RTK Query's reducer and
// middleware, which is all any module needs to start injecting endpoints.
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
