import { baseApi } from "./base-api";

// Matches the { success, message, data } envelope every backend endpoint
// uses as of Phase 4 (src/shared/types/api.ts on the backend) — see
// ApiSuccessResponse<T> there.
interface HealthData {
  service: string;
  environment: string;
  timestamp: string;
  database: "connected" | "unreachable";
}

interface HealthResponse {
  success: boolean;
  message: string;
  data: HealthData;
}

// The backend's /health route intentionally lives outside the /api prefix
// (a load-balancer/infra convention), so VITE_API_BASE_URL (".../api")
// doesn't reach it. fetchBaseQuery treats an absolute URL in `query()` as
// an escape hatch and calls it directly instead of joining it to baseUrl.
const apiOrigin = import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "");

// Not a business feature — this endpoint exists only to verify, end to end,
// that the frontend, RTK Query, and the backend's /health route are wired
// together correctly during Phase 2 (Project Initialization).
const healthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHealth: builder.query<HealthData, void>({
      query: () => `${apiOrigin}/health`,
      transformResponse: (response: HealthResponse) => response.data,
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
