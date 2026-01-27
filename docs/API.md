# API Documentation - Lifo4 EMS

Base URL: `https://api.lifo4.com.br/api/v1`

## Authentication

Todas as requisicoes (exceto login) requerem header `Authorization: Bearer <token>`.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "twoFactorCode": "123456"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "admin"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 3600
    }
  }
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

---

## Systems

### List Systems

```http
GET /systems?page=1&limit=20&status=online
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status (online, offline, error)
- `organizationId` - Filter by organization

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sys-001",
      "name": "BESS Site 1",
      "model": "Lifo4 100kWh",
      "connectionStatus": "online",
      "status": "charging"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Get System

```http
GET /systems/:systemId
```

### Create System

```http
POST /systems
Content-Type: application/json

{
  "name": "BESS Site 2",
  "siteId": "site-001",
  "serialNumber": "LF4-2024-001",
  "model": "Lifo4 50kWh",
  "manufacturer": "Lifo4",
  "batterySpec": {
    "chemistry": "LiFePO4",
    "nominalCapacity": 100,
    "nominalVoltage": 51.2,
    "cellCount": 16,
    "cellsInParallel": 4
  }
}
```

### Update System

```http
PUT /systems/:systemId
Content-Type: application/json

{
  "name": "Updated Name",
  "operationMode": "economic"
}
```

---

## Telemetry

### Get Current Telemetry

```http
GET /telemetry/:systemId/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "systemId": "sys-001",
    "timestamp": "2024-01-15T10:30:00Z",
    "soc": 75.5,
    "soh": 98.2,
    "totalVoltage": 51.8,
    "current": 45.2,
    "power": 2341,
    "temperature": {
      "min": 25,
      "max": 32,
      "average": 28.5
    },
    "cells": [
      {"index": 0, "voltage": 3.24, "status": "normal"},
      {"index": 1, "voltage": 3.23, "status": "normal"}
    ],
    "isCharging": true,
    "isDischarging": false,
    "isBalancing": false
  }
}
```

### Get Historical Telemetry

```http
GET /telemetry/:systemId/history?start=2024-01-01&end=2024-01-15&interval=hour
```

**Query Parameters:**
- `start` - Start date (ISO 8601)
- `end` - End date (ISO 8601)
- `interval` - Aggregation interval (minute, hour, day)
- `metrics` - Comma-separated metrics to include

---

## Control

### Set Operation Mode

```http
POST /control/:systemId/mode
Content-Type: application/json

{
  "mode": "economic"  // auto, manual, economic, grid_support, maintenance
}
```

### Start Charge

```http
POST /control/:systemId/charge/start
Content-Type: application/json

{
  "targetSoc": 95,
  "maxCurrent": 50,
  "maxPower": 25000
}
```

### Stop Charge

```http
POST /control/:systemId/charge/stop
```

### Emergency Stop

```http
POST /control/:systemId/emergency-stop
Content-Type: application/json

{
  "reason": "User initiated emergency stop"
}
```

---

## EV Chargers

### List Chargers

```http
GET /ev-chargers?siteId=site-001&status=available
```

### Get Charger Status

```http
GET /ev-chargers/:chargerId/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chargerId": "evse-001",
    "status": "charging",
    "connectors": [
      {
        "connectorId": 1,
        "type": "Type2",
        "status": "charging",
        "currentPower": 22000,
        "sessionId": "sess-001"
      }
    ],
    "ocppStatus": "online",
    "lastHeartbeat": "2024-01-15T10:30:00Z"
  }
}
```

### Start Charging

```http
POST /ev-chargers/:chargerId/start
Content-Type: application/json

{
  "connectorId": 1,
  "idTag": "RFID-001",
  "limitType": "power",
  "limitValue": 11000
}
```

### Stop Charging

```http
POST /ev-chargers/:chargerId/stop
Content-Type: application/json

{
  "connectorId": 1
}
```

### Get Active Sessions

```http
GET /ev-chargers/sessions/active
```

---

## Cameras

### List Cameras

```http
GET /cameras?siteId=site-001&status=online
```

### Get Stream URL

```http
GET /cameras/:cameraId/stream
```

**Response:**
```json
{
  "success": true,
  "data": {
    "streamUrl": "rtsp://...",
    "hlsUrl": "https://...",
    "expiresAt": "2024-01-15T11:30:00Z"
  }
}
```

### PTZ Control

```http
POST /cameras/:cameraId/ptz
Content-Type: application/json

{
  "action": "move",  // move, zoom, stop, preset
  "direction": "up", // up, down, left, right
  "speed": 50
}
```

### Take Snapshot

```http
POST /cameras/:cameraId/snapshot
```

### Get Events

```http
GET /cameras/:cameraId/events?type=person_detected&start=2024-01-15
```

---

## Microgrids

### List Microgrids

```http
GET /microgrids?organizationId=org-001
```

### Get Microgrid Status

```http
GET /microgrids/:microgridId/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "microgridId": "mg-001",
    "name": "Site 1 Microgrid",
    "operatingMode": "grid_connected",
    "gridConnected": true,
    "powerBalance": {
      "generation": 50000,
      "consumption": 35000,
      "storage": 15000,
      "gridExchange": 0
    },
    "components": [
      {"type": "bess", "id": "sys-001", "power": 15000},
      {"type": "solar", "id": "pv-001", "power": 50000},
      {"type": "load", "id": "load-001", "power": -35000}
    ]
  }
}
```

### Set Operating Mode

```http
POST /microgrids/:microgridId/mode
Content-Type: application/json

{
  "mode": "islanded",
  "reason": "Grid maintenance"
}
```

### Initiate Islanding

```http
POST /microgrids/:microgridId/island
Content-Type: application/json

{
  "reason": "Scheduled maintenance",
  "plannedDuration": 3600
}
```

### Initiate Black Start

```http
POST /microgrids/:microgridId/blackstart
```

---

## Prospects (Pre-Sales)

### List Prospects

```http
GET /prospects?stage=analysis&assignedTo=user-001
```

### Create Prospect

```http
POST /prospects
Content-Type: application/json

{
  "name": "Company ABC",
  "contactName": "John Doe",
  "email": "john@company.com",
  "phone": "+55 86 99999-9999",
  "address": {
    "street": "Rua Example, 123",
    "city": "Teresina",
    "state": "PI"
  },
  "segmentType": "commercial",
  "estimatedDemand": 100
}
```

### Get Analysis Results

```http
GET /prospects/:prospectId/analysis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prospectId": "prospect-001",
    "measurementPeriod": {
      "start": "2024-01-08",
      "end": "2024-01-15",
      "days": 7
    },
    "loadProfile": {
      "avgDailyConsumption": 450,
      "peakDemand": 85,
      "loadFactor": 0.72,
      "peakHours": [18, 19, 20]
    },
    "status": "completed"
  }
}
```

### Get BESS Recommendations

```http
GET /prospects/:prospectId/recommendations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "tier": "optimal",
        "tierName": "Ideal",
        "specifications": {
          "batteryCapacityKwh": 100,
          "batteryPowerKw": 50,
          "batteryChemistry": "LiFePO4"
        },
        "financials": {
          "totalInvestment": 350000,
          "annualSavings": 72000,
          "simplePaybackYears": 4.9,
          "npv10Years": 180000,
          "irr": 18.5
        },
        "isRecommended": true
      }
    ]
  }
}
```

---

## Alerts

### List Alerts

```http
GET /alerts?severity=critical&acknowledged=false
```

### Acknowledge Alert

```http
POST /alerts/:alertId/acknowledge
Content-Type: application/json

{
  "notes": "Checked system, no issues found"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error
