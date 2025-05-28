// Proxy Module - Core proxy engine functionality
export { apiRoutes } from './routes/api.js';
// export { requestRoutes } from './routes/requests.js'; // TODO: Fix interface issues

// Re-export types that might be needed by other modules
export type { ApiRequest, ApiResponse } from "@/types/index.js"; 