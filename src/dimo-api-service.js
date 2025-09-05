/**
 * DIMO API Service - Direct API calls without SDK dependencies
 * Implements the core functionality we need for JWT token management
 */

export class DimoApiService {
  constructor() {
    this.baseUrl = 'https://api.dimo.org'
  }

  /**
   * Get Developer JWT token
   * @param {Object} credentials - DIMO credentials
   * @param {string} credentials.clientId - DIMO Client ID
   * @param {string} credentials.domain - Redirect URI domain
   * @param {string} credentials.privateKey - DIMO API Key
   * @returns {Promise<Object>} JWT response
   */
  async getDeveloperJwt(credentials) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: credentials.clientId,
          domain: credentials.domain,
          private_key: credentials.privateKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in
      }
    } catch (error) {
      console.error('Failed to get Developer JWT:', error)
      throw new Error(`Failed to authenticate with DIMO: ${error.message}`)
    }
  }

  /**
   * Get Vehicle JWT token
   * @param {Object} params - Parameters for vehicle JWT
   * @param {string} params.access_token - Developer JWT token
   * @param {string} params.tokenId - Vehicle token ID
   * @returns {Promise<Object>} Vehicle JWT response
   */
  async getVehicleJwt(params) {
    try {
      const response = await fetch(`${this.baseUrl}/token-exchange/vehicle-jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.access_token}`,
        },
        body: JSON.stringify({
          tokenId: params.tokenId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        token: data.token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in
      }
    } catch (error) {
      console.error(`Failed to get Vehicle JWT for token ${params.tokenId}:`, error)
      throw new Error(`Failed to get vehicle access for token ${params.tokenId}: ${error.message}`)
    }
  }

  /**
   * Query vehicle telemetry data
   * @param {Object} params - Query parameters
   * @param {string} params.token - Vehicle JWT token
   * @param {string} params.query - GraphQL query
   * @param {Object} params.variables - GraphQL variables
   * @returns {Promise<Object>} Query response
   */
  async queryTelemetry(params) {
    try {
      const response = await fetch(`${this.baseUrl}/telemetry/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.token}`,
        },
        body: JSON.stringify({
          query: params.query,
          variables: params.variables || {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to query telemetry:', error)
      throw new Error(`Failed to query vehicle data: ${error.message}`)
    }
  }

  /**
   * Check if JWT token is valid and not expired
   * @param {string} jwt - JWT token to validate
   * @returns {boolean} True if token is valid
   */
  isJwtValid(jwt) {
    if (!jwt) return false
    
    try {
      // Decode JWT payload to check expiration
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      console.error('Error validating JWT:', error)
      return false
    }
  }

  /**
   * Get JWT expiration time
   * @param {string} jwt - JWT token
   * @returns {number|null} Expiration timestamp or null if invalid
   */
  getJwtExpiration(jwt) {
    if (!jwt) return null
    
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      return payload.exp ? payload.exp * 1000 : null // Convert to milliseconds
    } catch (error) {
      console.error('Error getting JWT expiration:', error)
      return null
    }
  }
}

// Create a singleton instance
export const dimoApiService = new DimoApiService()
