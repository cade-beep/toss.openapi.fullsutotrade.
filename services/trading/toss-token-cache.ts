// Native fetch is available in modern Node.js environments


export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class TossTokenCache {
  private cache = new Map<string, { token: string; expiresAt: number }>();
  private refreshPromises = new Map<string, Promise<string>>();
  private tossApiUrl: string;

  constructor(tossApiUrl?: string) {
    this.tossApiUrl = tossApiUrl || process.env.TOSS_API_URL || 'https://openapi.tossinvest.com';
  }

  /**
   * Retrieves a cached token or fetches a new one if expired or not present.
   * Prevents concurrent refreshes for the same client ID by reusing the active refresh promise.
   */
  async getToken(clientId: string, clientSecret: string): Promise<string> {
    if (!clientId) {
      throw new Error('TossOAuthError: client_id is required.');
    }
    if (!clientSecret) {
      throw new Error('TossOAuthError: client_secret is required.');
    }

    const cacheKey = clientId;

    // Check memory cache first
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    
    // Check if cached token exists and is valid (refresh 60 seconds before expiration to prevent edge races)
    if (cached && cached.expiresAt > now + 60000) {
      return cached.token;
    }

    // Check if there is an active refresh promise in-flight
    let promise = this.refreshPromises.get(cacheKey);
    if (!promise) {
      promise = this.fetchToken(clientId, clientSecret).finally(() => {
        // Clean up the promise map once resolved/rejected
        this.refreshPromises.delete(cacheKey);
      });
      this.refreshPromises.set(cacheKey, promise);
    }

    return promise;
  }

  private async fetchToken(clientId: string, clientSecret: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await fetch(`${this.tossApiUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody.error_description || errBody.error || `HTTP ${response.status}`;
      throw new Error(`TossOAuthError: Client credentials authentication failed: ${errMsg}`);
    }

    const data = (await response.json()) as TokenResponse;
    if (!data.access_token) {
      throw new Error('TossOAuthError: Invalid token response structure (missing access_token).');
    }

    const expiresAt = Date.now() + (data.expires_in * 1000);
    this.cache.set(clientId, {
      token: data.access_token,
      expiresAt
    });

    return data.access_token;
  }

  /**
   * Clears all cached items and active promises (mainly for unit tests).
   */
  clear(): void {
    this.cache.clear();
    this.refreshPromises.clear();
  }

  /**
   * Directly set cache item for testing expiration/mocking.
   */
  setCacheItem(clientId: string, token: string, expiresAt: number): void {
    this.cache.set(clientId, { token, expiresAt });
  }

  /**
   * Check if a refresh promise is currently active (for testing).
   */
  isRefreshActive(clientId: string): boolean {
    return this.refreshPromises.has(clientId);
  }
}

export const tossTokenCache = new TossTokenCache();
