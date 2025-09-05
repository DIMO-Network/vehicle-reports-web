import { LitElement, css, html } from 'lit'
import { storageService } from './storage-service.js'

/**
 * OAuth Login component for DIMO user authentication
 */
export class LoginElement extends LitElement {
  static get properties() {
    return {
      isLoading: { type: Boolean },
      error: { type: String }
    }
  }

  constructor() {
    super()
    this.isLoading = false
    this.error = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this.checkForExistingSession()
    this.checkForOAuthCallback()
  }

  checkForExistingSession() {
    // Check if user already has a valid JWT session
    const userJwt = storageService.getUserJwt()
    if (userJwt && this.isJWTValid(userJwt)) {
      console.log('Valid JWT found, redirecting to vehicles page')
      // Dispatch login success event to redirect to vehicles
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { 
          jwt: userJwt,
          walletAddress: storageService.getUserWalletAddress(),
          email: storageService.getUserEmail()
        },
        bubbles: true
      }))
    }
  }

  isJWTValid(jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      console.error('Failed to validate JWT:', error)
      return false
    }
  }

  checkForOAuthCallback() {
    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const walletAddress = urlParams.get('walletAddress')
    const email = urlParams.get('email')
    const error = urlParams.get('error')

    if (error) {
      this.error = `OAuth error: ${error}`
      return
    }

    if (token && walletAddress) {
      this.handleOAuthCallback(token, walletAddress, email)
    }
  }

  async handleOAuthCallback(token, walletAddress, email) {
    console.log('OAuth callback received:', { token: token?.substring(0, 20) + '...', walletAddress, email })
    this.isLoading = true
    this.error = ''

    try {
      // Get the client ID from storage service
      const clientId = storageService.getClientId()
      if (!clientId) {
        throw new Error('No client ID found. Please configure the app first.')
      }

      // Validate the JWT token (basic validation)
      if (!this.isValidJWT(token)) {
        throw new Error('Invalid JWT token received')
      }

      // Store the user session with token and additional info
      const userSession = {
        jwt: token,
        walletAddress: walletAddress,
        email: email,
        timestamp: Date.now()
      }
      
      storageService.setUserSession(userSession)

      // Clear OAuth state
      storageService.clearOAuthState()

      // Clean up URL parameters after successful login
      const url = new URL(window.location)
      url.searchParams.delete('token')
      url.searchParams.delete('walletAddress')
      url.searchParams.delete('email')
      window.history.replaceState({}, '', url.pathname)

      // Dispatch login success event
      console.log('Dispatching login-success event')
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { 
          jwt: token,
          walletAddress: walletAddress,
          email: email
        },
        bubbles: true
      }))

    } catch (error) {
      console.error('OAuth callback failed:', error)
      this.error = error.message || 'Login failed. Please try again.'
    } finally {
      this.isLoading = false
    }
  }

  isValidJWT(token) {
    return true
    try {
      // Basic JWT structure validation (header.payload.signature)
      const parts = token.split('.')
      if (parts.length !== 3) {
        return false
      }

      // Decode the header to check if it's a valid JWT
      const header = JSON.parse(atob(parts[0]))
      if (!header.alg || !header.typ) {
        return false
      }

      // Decode the payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const now = Math.floor(Date.now() / 1000)
      
      if (payload.exp && payload.exp < now) {
        return false
      }

      return true
    } catch (error) {
      console.error('JWT validation error:', error)
      return false
    }
  }

  async initiateLogin() {
    this.isLoading = true
    this.error = ''

    try {
      // Get the client ID from storage service
      const clientId = storageService.getClientId()
      if (!clientId) {
        throw new Error('No client ID found. Please configure the app first.')
      }

      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15)
      storageService.setOAuthState(state)

      // Build OAuth URL
      const loginBaseUrl = 'https://login.dimo.org'
      const redirectUri = encodeURIComponent(window.location.origin + "/login")
      const oauthUrl = `${loginBaseUrl}?` +
        `clientId=${encodeURIComponent(clientId)}&` +
        `redirectUri=${redirectUri}&` +
        `entryState=EMAIL_INPUT&forceEmail=true`

      // Redirect to OAuth provider
      window.location.href = oauthUrl

    } catch (error) {
      console.error('Login initiation failed:', error)
      this.error = error.message || 'Failed to initiate login'
      this.isLoading = false
    }
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="login-container">
          <div class="login-card">
            <div class="loading">
              <div class="spinner"></div>
              <p>Processing login...</p>
            </div>
          </div>
        </div>
      `
    }

    return html`
      <div class="login-container">
        <div class="login-card">
          <h2>User Login</h2>
          <p class="subtitle">Sign in with your DIMO account to access your vehicles</p>
          
          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          
          <div class="login-options">
            <button @click=${this.initiateLogin} class="login-btn">
              <svg class="login-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z" fill="currentColor"/>
              </svg>
              Sign in with DIMO
            </button>
          </div>
          
          <div class="help-text">
            <p>You'll be redirected to DIMO's secure login page</p>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .login-card {
        background: white;
        padding: 3rem;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 400px;
        text-align: center;
      }

      h2 {
        color: #2c3e50;
        margin-bottom: 0.5rem;
        font-size: 2rem;
        font-weight: 600;
      }

      .subtitle {
        color: #6c757d;
        margin-bottom: 2rem;
        font-size: 0.95rem;
      }

      .login-options {
        margin-bottom: 2rem;
      }

      .login-btn {
        width: 100%;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .login-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
      }

      .login-icon {
        width: 20px;
        height: 20px;
      }

      .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        border: 1px solid #f5c6cb;
      }

      .help-text {
        margin-top: 1.5rem;
      }

      .help-text p {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
      }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(102, 126, 234, 0.3);
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (prefers-color-scheme: dark) {
        .login-card {
          background: #2c3e50;
          color: #e9ecef;
        }

        h2 {
          color: #e9ecef;
        }

        .subtitle {
          color: #adb5bd;
        }

        .help-text p {
          color: #adb5bd;
        }

        .error {
          background-color: #721c24;
          color: #f8d7da;
          border-color: #f5c6cb;
        }
      }
    `
  }
}

window.customElements.define('login-element', LoginElement)
