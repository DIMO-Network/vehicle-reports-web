import { LitElement, css, html } from 'lit'
import { storageService } from './storage-service.js'

/**
 * App Configuration component for DIMO credentials
 */
export class AppConfigurationComponent extends LitElement {
  static get properties() {
    return {
      clientId: { type: String },
      apiKey: { type: String },
      isLoading: { type: Boolean },
      error: { type: String }
    }
  }

  constructor() {
    super()
    this.clientId = ''
    this.apiKey = ''
    this.isLoading = false
    this.error = ''
  }

  render() {
    return html`
      <div class="login-container">
        <div class="login-card">
          <h2>App Configuration</h2>
          <p class="subtitle">Please configure your application before proceeding</p>
          <p class="config-text">Enter your DIMO credentials to configure the Odometer Reporting Tool</p>
          
          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          
          <form @submit=${this._handleSubmit}>
            <div class="form-group">
              <label for="clientId">DIMO Client ID</label>
              <input
                type="text"
                id="clientId"
                .value=${this.clientId}
                @input=${this._handleClientIdChange}
                placeholder="0x8CFd006E6B73dbF00e700C85c32CE5C9aBD591a0"
                required
                ?disabled=${this.isLoading}
              />
            </div>
            
            <div class="form-group">
              <label for="apiKey">DIMO API Key</label>
              <input
                type="password"
                id="apiKey"
                .value=${this.apiKey}
                @input=${this._handleApiKeyChange}
                placeholder="Enter your DIMO API Key"
                required
                ?disabled=${this.isLoading}
              />
            </div>
            
            <button type="submit" ?disabled=${this.isLoading}>
              ${this.isLoading ? 'Configuring...' : 'Configure App'}
            </button>
          </form>
          
          <div class="help-text">
            <p>Get your credentials from <a href="https://console.dimo.org" target="_blank">console.dimo.org</a></p>
          </div>
        </div>
      </div>
    `
  }

  _handleClientIdChange(e) {
    this.clientId = e.target.value
  }

  _handleApiKeyChange(e) {
    this.apiKey = e.target.value
  }

  async _handleSubmit(e) {
    e.preventDefault()
    this.isLoading = true
    this.error = ''

    try {
      // Store credentials using storage service
      storageService.setAppConfig(this.clientId, this.apiKey)

      console.log('App configuration saved successfully')
      console.log('Client ID:', this.clientId)
      console.log('API Key:', this.apiKey)

      // Dispatch configuration success event
      this.dispatchEvent(new CustomEvent('config-success', {
        detail: { clientId: this.clientId },
        bubbles: true
      }))

      console.log('Config success event dispatched')

    } catch (error) {
      console.error('Configuration failed:', error)
      this.error = error.message || 'Configuration failed. Please check your credentials.'
    } finally {
      this.isLoading = false
    }
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
      }

      h2 {
        text-align: center;
        color: #2c3e50;
        margin-bottom: 0.5rem;
        font-size: 2rem;
      }

      .subtitle {
        text-align: center;
        color: #6c757d;
        margin-bottom: 1rem;
        font-size: 0.95rem;
        font-weight: 500;
      }

      .config-text {
        text-align: center;
        color: #6c757d;
        margin-bottom: 2rem;
        font-size: 0.9rem;
      }

      .form-group {
        margin-bottom: 1.5rem;
      }

      label {
        display: block;
        margin-bottom: 0.5rem;
        color: #495057;
        font-weight: 500;
      }

      input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e9ecef;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      input:focus {
        outline: none;
        border-color: #667eea;
      }

      input:disabled {
        background-color: #f8f9fa;
        cursor: not-allowed;
      }

      button {
        width: 100%;
        padding: 0.75rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
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
        text-align: center;
      }

      .help-text p {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
      }

      .help-text a {
        color: #667eea;
        text-decoration: none;
      }

      .help-text a:hover {
        text-decoration: underline;
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

        .config-text {
          color: #adb5bd;
        }

        label {
          color: #e9ecef;
        }

        input {
          background-color: #495057;
          border-color: #6c757d;
          color: #e9ecef;
        }

        input:focus {
          border-color: #667eea;
        }

        input:disabled {
          background-color: #343a40;
        }

        .error {
          background-color: #721c24;
          color: #f8d7da;
          border-color: #f5c6cb;
        }

        .help-text p {
          color: #adb5bd;
        }
      }
    `
  }
}

window.customElements.define('app-configuration', AppConfigurationComponent)
