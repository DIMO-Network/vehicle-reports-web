import { LitElement, css, html } from 'lit'
import { graphqlService } from './graphql-service.js'
import { storageService } from './storage-service.js'
import { dimoApiService } from './dimo-api-service.js'
import { ConfigUtils } from './config-utils.js'

/**
 * Vehicles page component displaying user's vehicles
 */
export class VehiclesPage extends LitElement {
  static get properties() {
    return {
      vehicles: { type: Array },
      totalCount: { type: Number },
      isLoading: { type: Boolean },
      error: { type: String },
      hasNextPage: { type: Boolean },
      endCursor: { type: String },
      loadingMore: { type: Boolean },
      selectedVehicles: { type: Set },
      startDate: { type: String },
      endDate: { type: String },
      selectedMonth: { type: String },
      isGeneratingReport: { type: Boolean }
    }
  }

  constructor() {
    super()
    this.vehicles = []
    this.totalCount = 0
    this.isLoading = true
    this.error = ''
    this.hasNextPage = false
    this.endCursor = null
    this.loadingMore = false
    this.selectedVehicles = new Set()
    this.startDate = ''
    this.endDate = ''
    this.selectedMonth = ''
    this.isGeneratingReport = false
    
    // DIMO API service is imported and ready to use
  }

  connectedCallback() {
    super.connectedCallback()
    this.loadVehicles()
  }

  async loadVehicles(after = null) {
    if (after) {
      this.loadingMore = true
    } else {
      this.isLoading = true
      this.vehicles = [] // Reset vehicles for fresh load
    }
    this.error = ''

    try {
      const { config } = await ConfigUtils.checkAppConfiguration()
      if (!config) {
        throw new Error('No configuration found. Please configure the app.')
      }
      
      // Fetch vehicles from DIMO GraphQL API
      const vehiclesData = await graphqlService.getVehicles(config.clientId, after)
      
      // Map the data to our table format
      const mappedVehicles = vehiclesData.nodes.map(vehicle => graphqlService.mapVehicleData(vehicle))
      
      if (after) {
        // Append to existing vehicles for pagination
        this.vehicles = [...this.vehicles, ...mappedVehicles]
      } else {
        // Replace vehicles for fresh load
        this.vehicles = mappedVehicles
      }
      
      this.totalCount = vehiclesData.totalCount
      this.hasNextPage = vehiclesData.pageInfo.hasNextPage
      this.endCursor = vehiclesData.pageInfo.endCursor

    } catch (error) {
      console.error('Failed to load vehicles:', error)
      this.error = error.message || 'Failed to load vehicles'
    } finally {
      this.isLoading = false
      this.loadingMore = false
    }
  }

  getLastFiveMonths() {
    const months = []
    const today = new Date()
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1)
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      
      months.push({
        value: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`,
        label: monthName,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
    }
    
    return months
  }

  onMonthChange(event) {
    const selectedValue = event.target.value
    if (selectedValue) {
      const month = this.getLastFiveMonths().find(m => m.value === selectedValue)
      if (month) {
        this.startDate = month.startDate
        this.endDate = month.endDate
        this.selectedMonth = selectedValue
      }
    } else {
      this.selectedMonth = ''
    }
    this.requestUpdate()
  }

  onDateChange(event) {
    const { name, value } = event.target
    if (name === 'startDate') {
      this.startDate = value
    } else if (name === 'endDate') {
      this.endDate = value
    }
    // Clear month selection when manually changing dates
    this.selectedMonth = ''
    this.requestUpdate()
  }

  onVehicleSelect(event) {
    const tokenId = event.target.value
    const isChecked = event.target.checked
    
    if (isChecked) {
      this.selectedVehicles.add(tokenId)
    } else {
      this.selectedVehicles.delete(tokenId)
    }
    
    // Create a new Set to trigger reactivity
    this.selectedVehicles = new Set(this.selectedVehicles)
    this.requestUpdate()
  }

  onSelectAll(event) {
    const isChecked = event.target.checked
    
    if (isChecked) {
      this.selectedVehicles = new Set(this.vehicles.map(v => v.tokenId))
    } else {
      this.selectedVehicles = new Set()
    }
    
    this.requestUpdate()
  }





  async generateReport() {
    // Validate required fields
    if (!this.startDate || !this.endDate) {
      alert('Please select both start and end dates.')
      return
    }
    
    if (this.selectedVehicles.size === 0) {
      alert('Please select at least one vehicle.')
      return
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(this.startDate) || !dateRegex.test(this.endDate)) {
      alert('Please use YYYY-MM-DD format for dates.')
      return
    }
    
    // Validate that start date is before end date
    if (new Date(this.startDate) > new Date(this.endDate)) {
      alert('Start date must be before end date.')
      return
    }
    
    this.isGeneratingReport = true
    this.requestUpdate()
    
    try {
      console.log('=== Vehicle Report Generation ===')
      console.log('Start Date:', this.startDate)
      console.log('End Date:', this.endDate)
      console.log('Selected Vehicles:', Array.from(this.selectedVehicles))
      console.log('Total Selected:', this.selectedVehicles.size)
      
      // Generate report using backend (backend handles all JWT logic)
      console.log('Generating report via backend...')
      const reportResult = await dimoApiService.generateReport({
        vehicleTokenIds: Array.from(this.selectedVehicles),
        startDate: this.startDate,
        endDate: this.endDate
      })
      
      console.log('Report generated:', reportResult)
      
      // Download the report
      const blob = await dimoApiService.downloadReport(reportResult.filename)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = reportResult.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert(`Report generated successfully! Downloaded ${reportResult.filename} with ${reportResult.recordCount} records.`)
      
    } catch (error) {
      console.error('Report generation failed:', error)
      alert(`Report generation failed: ${error.message}`)
    } finally {
      this.isGeneratingReport = false
      this.requestUpdate()
    }
  }



  render() {
    return html`
      <div class="vehicles-container">
        <header class="page-header">
          <div class="header-content">
            <h1>Vehicles</h1>
            ${this.totalCount > 0 ? html`<span class="total-count">${this.totalCount} total</span>` : ''}
          </div>
          <div class="header-actions">
            <button @click=${this.loadVehicles} class="refresh-btn" ?disabled=${this.isLoading}>
              ${this.isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </header>

        <main class="vehicles-content">
          ${this.error ? html`
            <div class="error-message">
              <p>${this.error}</p>
              <button @click=${this.loadVehicles} class="retry-btn">Try Again</button>
            </div>
          ` : ''}

          <!-- Report Generation Form -->
          <div class="report-form-container">
            <div class="report-form">
              <h2>Generate Vehicle Report</h2>
              <div class="form-row">
                <div class="form-group">
                  <label for="month-selector">Quick Select Month (Optional)</label>
                  <select 
                    id="month-selector" 
                    @change=${this.onMonthChange}
                    .value=${this.selectedMonth}
                    class="form-select"
                  >
                    <option value="">Select a month...</option>
                    ${this.getLastFiveMonths().map(month => html`
                      <option value=${month.value}>${month.label}</option>
                    `)}
                  </select>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="start-date">Start Date *</label>
                  <input 
                    type="date" 
                    id="start-date" 
                    name="startDate"
                    .value=${this.startDate}
                    @change=${this.onDateChange}
                    class="form-input"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="end-date">End Date *</label>
                  <input 
                    type="date" 
                    id="end-date" 
                    name="endDate"
                    .value=${this.endDate}
                    @change=${this.onDateChange}
                    class="form-input"
                    required
                  >
                </div>
                <div class="form-group">
                  <button @click=${this.generateReport} class="generate-btn" ?disabled=${this.isLoading || this.isGeneratingReport}>
                    ${this.isGeneratingReport ? 'Generating Report...' : 'Generate Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          ${this.isLoading ? html`
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading vehicles...</p>
            </div>
          ` : html`
            <div class="vehicles-table-container">
              <table class="vehicles-table">
                <thead>
                  <tr>
                    <th class="checkbox-column">
                      <input 
                        type="checkbox" 
                        @change=${this.onSelectAll}
                        .checked=${this.vehicles.length > 0 && this.selectedVehicles.size === this.vehicles.length}
                        class="select-all-checkbox"
                      >
                    </th>
                    <th>Token ID</th>
                    <th>Vehicle Definition</th>
                    <th>IMEI</th>
                    <th>Minted Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.vehicles.length === 0 ? html`
                    <tr>
                      <td colspan="5" class="no-data">
                        <div class="no-data-content">
                          <svg class="no-data-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM17 12H15V15H13V12H11V10H13V7H15V10H17V12Z" fill="currentColor"/>
                          </svg>
                          <p>No vehicles found</p>
                        </div>
                      </td>
                    </tr>
                  ` : this.vehicles.map(vehicle => html`
                    <tr>
                      <td class="checkbox-column">
                        <input 
                          type="checkbox" 
                          value=${vehicle.tokenId}
                          @change=${this.onVehicleSelect}
                          .checked=${this.selectedVehicles.has(vehicle.tokenId)}
                          class="vehicle-checkbox"
                        >
                      </td>
                      <td class="token-id">
                        <code>${vehicle.tokenId}</code>
                      </td>
                      <td class="vehicle-definition">${vehicle.vehicleType}</td>
                      <td class="imei">${vehicle.imei}</td>
                      <td class="minted-date">${vehicle.mintedAt}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
              
              ${this.hasNextPage ? html`
                <div class="load-more-container">
                  <button @click=${() => this.loadVehicles(this.endCursor)} class="load-more-btn" ?disabled=${this.loadingMore}>
                    ${this.loadingMore ? 'Loading more...' : 'Load More Vehicles'}
                  </button>
                </div>
              ` : ''}
            </div>
          `}
        </main>
      </div>
    `
  }

  static get styles() {
    return css`
      .vehicles-container {
        min-height: 100vh;
        background-color: #f8f9fa;
      }

      .page-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .header-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .page-header h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 600;
      }

      .total-count {
        font-size: 0.9rem;
        opacity: 0.9;
        font-weight: 400;
      }

      .header-actions {
        display: flex;
        gap: 1rem;
      }

      .refresh-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;
      }

      .refresh-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
      }

      .refresh-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .vehicles-content {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .report-form-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        margin-bottom: 2rem;
        padding: 0;
        overflow: hidden;
      }

      .report-form {
        padding: 1.5rem;
        border-bottom: 1px solid #dee2e6;
      }

      .report-form h2 {
        margin: 0 0 1.5rem 0;
        color: #2c3e50;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .form-row {
        display: flex;
        gap: 1rem;
        align-items: end;
        flex-wrap: wrap;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        min-width: 150px;
        flex: 1;
      }

      .form-group:last-child {
        flex: 0 0 auto;
      }

      .form-group label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #495057;
        margin-bottom: 0.5rem;
      }

      .form-input,
      .form-select {
        padding: 0.5rem;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 0.9rem;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .form-input:focus,
      .form-select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
      }

      .generate-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: transform 0.2s, box-shadow 0.2s;
        white-space: nowrap;
      }

      .generate-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .generate-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .checkbox-column {
        width: 50px;
        text-align: center;
        padding: 0.5rem !important;
      }

      .select-all-checkbox,
      .vehicle-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .select-all-checkbox {
        transform: scale(1.1);
      }

      .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        text-align: center;
        margin-bottom: 2rem;
      }

      .retry-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 0.5rem;
      }

      .retry-btn:hover {
        background: #c82333;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: #6c757d;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(102, 126, 234, 0.3);
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .vehicles-table-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .vehicles-table {
        width: 100%;
        border-collapse: collapse;
      }

      .vehicles-table th {
        background: #f8f9fa;
        color: #495057;
        font-weight: 600;
        padding: 1rem;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
      }

      .vehicles-table td {
        padding: 1rem;
        border-bottom: 1px solid #dee2e6;
        vertical-align: top;
      }

      .vehicles-table tr:hover {
        background-color: #f8f9fa;
      }

      .token-id {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
      }

      .token-id code {
        background: #e9ecef;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        color: #495057;
      }

      .vehicle-definition {
        font-weight: 500;
        color: #2c3e50;
      }

      .imei {
        color: #6c757d;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
      }

      .minted-date {
        color: #6c757d;
        font-size: 0.9rem;
      }

      .no-data {
        text-align: center;
        padding: 3rem;
        color: #6c757d;
      }

      .no-data-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .no-data-icon {
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      .load-more-container {
        padding: 2rem;
        text-align: center;
        background: white;
        border-top: 1px solid #dee2e6;
      }

      .load-more-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .load-more-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
      }

      .load-more-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      @media (prefers-color-scheme: dark) {
        .vehicles-container {
          background-color: #1a1a1a;
        }

        .report-form-container {
          background: #2c3e50;
        }

        .report-form {
          border-bottom-color: #495057;
        }

        .report-form h2 {
          color: #e9ecef;
        }

        .form-group label {
          color: #e9ecef;
        }

        .form-input,
        .form-select {
          background: #343a40;
          border-color: #495057;
          color: #e9ecef;
        }

        .form-input:focus,
        .form-select:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
        }

        .vehicles-table-container {
          background: #2c3e50;
        }

        .vehicles-table th {
          background: #343a40;
          color: #e9ecef;
          border-bottom-color: #495057;
        }

        .vehicles-table td {
          border-bottom-color: #495057;
          color: #e9ecef;
        }

        .vehicles-table tr:hover {
          background-color: #343a40;
        }

        .token-id code {
          background: #495057;
          color: #e9ecef;
        }

        .vehicle-definition {
          color: #e9ecef;
        }

        .imei {
          color: #adb5bd;
        }

        .minted-date {
          color: #adb5bd;
        }

        .no-data {
          color: #adb5bd;
        }

        .load-more-container {
          background: #2c3e50;
          border-top-color: #495057;
        }
      }

      @media (max-width: 768px) {
        .page-header {
          flex-direction: column;
          gap: 1rem;
          text-align: center;
        }

        .vehicles-content {
          padding: 1rem;
        }

        .form-row {
          flex-direction: column;
          align-items: stretch;
        }

        .form-group {
          min-width: auto;
        }

        .form-group:last-child {
          flex: 1;
        }

        .generate-btn {
          width: 100%;
          margin-top: 0.5rem;
        }

        .vehicles-table {
          font-size: 0.9rem;
        }

        .vehicles-table th,
        .vehicles-table td {
          padding: 0.75rem 0.5rem;
        }

        .checkbox-column {
          width: 40px;
          padding: 0.25rem !important;
        }
      }
    `
  }
}

window.customElements.define('vehicles-page', VehiclesPage)
