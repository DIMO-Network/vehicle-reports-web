import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { DIMO } from '@dimo-network/data-sdk'
import fs from 'fs/promises'
import { createObjectCsvWriter } from 'csv-writer'
import https from 'https'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const HTTPS_PORT = process.env.HTTPS_PORT || 3443
const USE_HTTPS = process.env.USE_HTTPS !== 'false' // Default to true for development

// Middleware
app.use(cors({
  origin: ['https://localhost:5173', 'https://localhost:3443', 'http://localhost:3001'],
  credentials: true
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../dist')))

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, '../tmp')

// Initialize DIMO SDK
const dimo = new DIMO('Production')

// Initialize server
async function initializeServer() {
  await fs.mkdir(tmpDir, { recursive: true })
}

// File storage utilities
class FileStorage {
  constructor(baseDir) {
    this.baseDir = baseDir
  }

  async saveConfig(config) {
    const configPath = path.join(this.baseDir, 'app-config.json')
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    return configPath
  }

  async loadConfig() {
    try {
      const configPath = path.join(this.baseDir, 'app-config.json')
      const data = await fs.readFile(configPath, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      return null
    }
  }

  async saveReport(reportData, filename) {
    const reportPath = path.join(this.baseDir, filename)
    await fs.writeFile(reportPath, reportData)
    return reportPath
  }

  async listReports() {
    try {
      const files = await fs.readdir(this.baseDir)
      return files.filter(file => file.endsWith('.csv'))
    } catch (error) {
      return []
    }
  }
}

const storage = new FileStorage(tmpDir)

// API Routes

// Get app configuration
app.get('/api/config', async (req, res) => {
  try {
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(404).json({ error: 'No configuration found' })
    }
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' })
  }
})

// Save app configuration
app.post('/api/config', async (req, res) => {
  try {
    const { clientId, apiKey, redirectUri } = req.body
    
    if (!clientId || !apiKey) {
      return res.status(400).json({ error: 'Client ID and API Key are required' })
    }

    const config = {
      clientId,
      apiKey,
      redirectUri: redirectUri || 'http://localhost:5173',
      createdAt: new Date().toISOString()
    }

    await storage.saveConfig(config)
    res.json({ message: 'Configuration saved successfully', config })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save configuration' })
  }
})

// Delete app configuration
app.delete('/api/config', async (req, res) => {
  try {
    const configPath = path.join(tmpDir, 'app-config.json')
    
    // Check if config file exists
    try {
      await fs.access(configPath)
    } catch (error) {
      return res.status(404).json({ error: 'No configuration found' })
    }

    // Delete the config file
    await fs.unlink(configPath)
    res.json({ message: 'Configuration deleted successfully' })
  } catch (error) {
    console.error('Failed to delete configuration:', error)
    res.status(500).json({ error: 'Failed to delete configuration' })
  }
})

// Get developer JWT
app.post('/api/auth/developer', async (req, res) => {
  try {
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(400).json({ error: 'No configuration found. Please configure the app first.' })
    }

    const developerJwt = await dimo.auth.getToken({
      client_id: config.clientId,
      domain: config.redirectUri,
      private_key: config.apiKey,
    })

    res.json(developerJwt)
  } catch (error) {
    console.error('Failed to get developer JWT:', error)
    res.status(500).json({ error: 'Failed to authenticate with DIMO. Please check your credentials.' })
  }
})

// Get vehicle JWT
app.post('/api/auth/vehicle', async (req, res) => {
  try {
    const { tokenId, developerJwt } = req.body
    
    if (!tokenId || !developerJwt) {
      return res.status(400).json({ error: 'Token ID and Developer JWT are required' })
    }

    const vehicleJwt = await dimo.tokenexchange.getVehicleJwt({
      ...developerJwt,
      tokenId: parseInt(tokenId)
    })

    res.json(vehicleJwt)
  } catch (error) {
    console.error(`Failed to get vehicle JWT for token ${req.body.tokenId}:`, error)
    res.status(500).json({ error: `Failed to get vehicle access for token ${req.body.tokenId}` })
  }
})

// Get vehicles (using existing GraphQL service logic)
app.get('/api/vehicles', async (req, res) => {
  try {
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(400).json({ error: 'No configuration found. Please configure the app first.' })
    }

    // Get developer JWT
    const developerJwt = await dimo.auth.getToken({
      client_id: config.clientId,
      domain: config.redirectUri,
      private_key: config.apiKey,
    })

    // Query vehicles using DIMO SDK
    const vehiclesQuery = `
      query GetVehicles($after: String) {
        vehicles(first: 50, after: $after) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            tokenId
            definition {
              make
              model
              year
            }
            aftermarketDevice {
              imei
            }
            syntheticDevice {
              mintedAt
            }
          }
        }
      }
    `

    const result = await dimo.identity.query({
      ...developerJwt,
      query: vehiclesQuery,
      variables: { after: req.query.after || null }
    })

    // Map the data to match frontend expectations
    const mappedVehicles = result.data.vehicles.nodes.map(vehicle => ({
      tokenId: vehicle.tokenId,
      vehicleType: `${vehicle.definition.make} ${vehicle.definition.model} ${vehicle.definition.year}`,
      imei: vehicle.aftermarketDevice?.imei || 'N/A',
      mintedAt: vehicle.syntheticDevice?.mintedAt ? new Date(vehicle.syntheticDevice.mintedAt).toLocaleDateString() : 'N/A'
    }))

    res.json({
      totalCount: result.data.vehicles.totalCount,
      pageInfo: result.data.vehicles.pageInfo,
      nodes: mappedVehicles
    })
  } catch (error) {
    console.error('Failed to get vehicles:', error)
    res.status(500).json({ error: 'Failed to load vehicles' })
  }
})

// Generate vehicle report
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { vehicleTokenIds, startDate, endDate } = req.body
    
    if (!vehicleTokenIds || !Array.isArray(vehicleTokenIds) || vehicleTokenIds.length === 0) {
      return res.status(400).json({ error: 'Vehicle token IDs are required' })
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' })
    }

    const config = await storage.loadConfig()
    if (!config) {
      return res.status(400).json({ error: 'No configuration found. Please configure the app first.' })
    }

    // Get developer JWT
    const developerJwt = await dimo.auth.getDeveloperJwt({
      client_id: config.clientId,
      domain: config.redirectUri,
      private_key: config.apiKey,
    })

    // Generate report data
    const reportData = []
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `vehicle-report-${timestamp}.csv`

    for (const tokenId of vehicleTokenIds) {
      try {
        // Get vehicle JWT
        const vehicleJwt = await dimo.tokenexchange.exchange({
          ...developerJwt,
          privileges: [1],
          tokenId: parseInt(tokenId)
        })

        // Query vehicle telemetry data
        const telemetryQuery = `
          {
            vinVCLatest(tokenId: ${tokenId}) {
              vin
            }
            signals(tokenId: ${tokenId}, interval: "24h", from: "${startDate}T00:00:00Z", to: "${endDate}T23:59:59Z") {
              powertrainTransmissionTravelledDistance (agg: MAX)
              timestamp
            }
          }
        `

        const telemetryResult = await dimo.telemetry.query({
          ...vehicleJwt,
          query: telemetryQuery
        })

        console.log(telemetryResult.data.signals)

        // Extract VIN from the response
        const vin = telemetryResult.data.vinVCLatest?.vin || 'N/A'

        // Add to report data - create a record for each signal
        if (telemetryResult.data.signals && Array.isArray(telemetryResult.data.signals)) {
          telemetryResult.data.signals.forEach((signal, index) => {
            const odometerReading = signal.powertrainTransmissionTravelledDistance || 0
            let travelledDistance = 0
            
            // Calculate travelled distance as difference from previous reading
            if (index > 0) {
              const previousReading = telemetryResult.data.signals[index - 1].powertrainTransmissionTravelledDistance || 0
              travelledDistance = odometerReading - previousReading
            }
            
            reportData.push({
              tokenId: tokenId,
              vin: vin,
              timestamp: signal.timestamp || 'N/A',
              odometerReading: odometerReading,
              travelledDistance: travelledDistance
            })
          })
        } else {
          // Fallback if no signals data
          reportData.push({
            tokenId: tokenId,
            vin: vin,
            timestamp: 'N/A',
            odometerReading: 'N/A',
            travelledDistance: 0
          })
        }

      } catch (error) {
        console.error(`Failed to get data for vehicle ${tokenId}:`, error)
        // Add error entry to report
        reportData.push({
          tokenId: tokenId,
          vin: 'ERROR',
          timestamp: 'ERROR',
          odometerReading: 'ERROR',
          travelledDistance: 0
        })
      }
    }

    // Generate CSV
    const csvWriter = createObjectCsvWriter({
      path: path.join(tmpDir, filename),
      header: [
        { id: 'tokenId', title: 'Token ID' },
        { id: 'vin', title: 'VIN' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'odometerReading', title: 'Odometer Reading' },
        { id: 'travelledDistance', title: 'Travelled Distance' }
      ]
    })

    await csvWriter.writeRecords(reportData)

    res.json({
      message: 'Report generated successfully',
      filename: filename,
      recordCount: reportData.length,
      downloadUrl: `/api/reports/download/${filename}`
    })

  } catch (error) {
    console.error('Failed to generate report:', error)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// Download report
app.get('/api/reports/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename
    const filePath = path.join(tmpDir, filename)
    
    // Check if file exists
    await fs.access(filePath)
    
    res.download(filePath, filename)
  } catch (error) {
    res.status(404).json({ error: 'Report file not found' })
  }
})

// List available reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await storage.listReports()
    res.json({ reports })
  } catch (error) {
    res.status(500).json({ error: 'Failed to list reports' })
  }
})

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

// Start server
async function startServer() {
  await initializeServer()
  
  if (USE_HTTPS) {
    try {
      // Load SSL certificates
      const certPath = path.join(__dirname, '../../.mkcert/cert.pem')
      const keyPath = path.join(__dirname, '../../.mkcert/dev.pem')
      
      const options = {
        key: await fs.readFile(keyPath),
        cert: await fs.readFile(certPath)
      }
      
      https.createServer(options, app).listen(HTTPS_PORT, () => {
        console.log(`🔒 Vehicle Reports Backend (HTTPS) running on port ${HTTPS_PORT}`)
        console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
        console.log(`💾 Using tmp directory: ${tmpDir}`)
        console.log(`🔐 HTTPS enabled with mkcert certificates`)
      })
    } catch (error) {
      console.error('Failed to start HTTPS server:', error.message)
      console.log('Falling back to HTTP server...')
      
      app.listen(PORT, () => {
        console.log(`🚀 Vehicle Reports Backend (HTTP) running on port ${PORT}`)
        console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
        console.log(`💾 Using tmp directory: ${tmpDir}`)
      })
    }
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Vehicle Reports Backend (HTTP) running on port ${PORT}`)
      console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
      console.log(`💾 Using tmp directory: ${tmpDir}`)
    })
  }
}

startServer().catch(console.error)

export default app
