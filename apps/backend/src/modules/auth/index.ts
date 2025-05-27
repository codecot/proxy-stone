// Auth Module - Authentication and authorization
export { AuthService } from './services/auth-service.js';
export { authRoutes } from './routes/auth.js';

// Re-export auth-related types
export type { AuthConfig, ApiKey, User, AuthSession, Role } from '../../types/index.js'; 