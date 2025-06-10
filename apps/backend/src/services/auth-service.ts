import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Role, User, ApiKey, AuthSession } from "@/types/index.js";

export class AuthService {
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private revokedTokens: Set<string> = new Set(); // Track revoked tokens
  private hashSalt: string;
  private maxLoginAttempts: number;
  private lockoutDuration: number;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private jwtIssuer: string;

  constructor(
    hashSalt: string,
    jwtSecret: string,
    jwtExpiresIn: string = '24h',
    jwtIssuer: string = 'proxy-stone',
    maxLoginAttempts: number = 5,
    lockoutDuration: number = 900 // 15 minutes
  ) {
    this.hashSalt = hashSalt;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
    this.jwtIssuer = jwtIssuer;
    this.maxLoginAttempts = maxLoginAttempts;
    this.lockoutDuration = lockoutDuration;
  }

  // Hash password or API key securely
  hashSecret(secret: string): string {
    return crypto.pbkdf2Sync(secret, this.hashSalt, 10000, 64, 'sha512').toString('hex');
  }

  // Generate secure random API key
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate session ID
  generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Verify password/API key against hash
  verifySecret(secret: string, hash: string): boolean {
    const secretHash = this.hashSecret(secret);
    return crypto.timingSafeEqual(Buffer.from(secretHash), Buffer.from(hash));
  }

  // Check if IP is locked out
  isLockedOut(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier);
    if (!attempts) return false;

    const now = Date.now();
    if (attempts.count >= this.maxLoginAttempts) {
      if (now - attempts.lastAttempt < this.lockoutDuration * 1000) {
        return true;
      } else {
        // Reset attempts after lockout period
        this.loginAttempts.delete(identifier);
        return false;
      }
    }
    return false;
  }

  // Record failed login attempt
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: now };

    attempts.count++;
    attempts.lastAttempt = now;
    this.loginAttempts.set(identifier, attempts);
  }

  // Clear failed attempts on successful login
  clearFailedAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier);
  }

  // Generate JWT token
  generateToken(payload: {
    userId?: string;
    apiKeyId?: string;
    role: Role;
    type: 'user' | 'apikey';
  }): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: this.jwtIssuer,
      subject: payload.userId || payload.apiKeyId,
    } as jwt.SignOptions);
  }

  // Verify and decode JWT token
  verifyToken(
    token: string
  ): { userId?: string; apiKeyId?: string; role: Role; type: 'user' | 'apikey' } | null {
    try {
      // Check if token is revoked
      if (this.revokedTokens.has(token)) {
        return null;
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
      }) as any;

      return {
        userId: decoded.userId,
        apiKeyId: decoded.apiKeyId,
        role: decoded.role,
        type: decoded.type,
      };
    } catch (error) {
      return null;
    }
  }

  // Revoke token (add to blacklist)
  revokeToken(token: string): boolean {
    this.revokedTokens.add(token);
    return true;
  }

  // Authenticate user with username/password
  authenticateUser(
    username: string,
    password: string,
    users: User[],
    ipAddress?: string
  ): { token: string; user: User } | null {
    const identifier = ipAddress || username;

    if (this.isLockedOut(identifier)) {
      throw new Error('Account temporarily locked due to too many failed attempts');
    }

    const user = users.find((u) => u.username === username && u.enabled);
    if (!user || !this.verifySecret(password, user.passwordHash)) {
      this.recordFailedAttempt(identifier);
      return null;
    }

    this.clearFailedAttempts(identifier);

    const token = this.generateToken({
      userId: user.id,
      role: user.role,
      type: 'user',
    });

    return { token, user };
  }

  // Authenticate with API key
  authenticateApiKey(
    apiKey: string,
    apiKeys: ApiKey[],
    ipAddress?: string
  ): { token: string; apiKey: ApiKey } | null {
    const identifier = ipAddress || 'api-key';

    if (this.isLockedOut(identifier)) {
      throw new Error('API key temporarily locked due to too many failed attempts');
    }

    const keyConfig = apiKeys.find((k) => {
      if (!k.enabled) return false;
      if (k.expiresAt && new Date(k.expiresAt) < new Date()) return false;
      return this.verifySecret(apiKey, k.keyHash);
    });

    if (!keyConfig) {
      this.recordFailedAttempt(identifier);
      return null;
    }

    this.clearFailedAttempts(identifier);

    const token = this.generateToken({
      apiKeyId: keyConfig.id,
      role: keyConfig.role,
      type: 'apikey',
    });

    return { token, apiKey: keyConfig };
  }

  // Clean expired revoked tokens (optional cleanup)
  cleanRevokedTokens(): number {
    // In a real implementation, you'd check token expiration dates
    // For now, we'll just return the count
    return this.revokedTokens.size;
  }

  // Create new user (admin function)
  createUser(username: string, password: string, role: Role): User {
    const userId = crypto.randomUUID();
    const passwordHash = this.hashSecret(password);

    return {
      id: userId,
      username,
      password: '', // Empty string for security (plain password not stored)
      passwordHash,
      permissions: [], // Default empty permissions
      isActive: true,
      role,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  }

  // Create new API key (admin function)
  createApiKey(
    name: string,
    role: Role,
    expiresInDays?: number
  ): { apiKey: ApiKey; plainKey: string } {
    const keyId = crypto.randomUUID();
    const plainKey = this.generateApiKey();
    const keyHash = this.hashSecret(plainKey);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const apiKey: ApiKey = {
      id: keyId,
      key: '', // Empty string for security (plain key not stored)
      keyHash,
      role,
      name,
      permissions: [], // Default empty permissions
      enabled: true,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    return { apiKey, plainKey };
  }

  // Get auth statistics
  getAuthStats() {
    return {
      revokedTokens: this.revokedTokens.size,
      lockedAccounts: this.loginAttempts.size,
    };
  }
}
