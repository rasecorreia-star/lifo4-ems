-- LIFO4 EMS PostgreSQL Schema
-- Executed automatically on first container start
-- Supports multi-tenancy via Row-Level Security

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Organizations (multi-tenant root)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'standard',  -- standard, premium, enterprise
    max_systems INTEGER DEFAULT 10,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Users (complement Firebase Auth — same UUID)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,  -- Same ID from Firebase Auth
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    -- Roles: super_admin, admin, manager, technician, operator, viewer, user
    permissions JSONB DEFAULT '[]',
    allowed_systems UUID[] DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- BESS Systems
-- ============================================================
CREATE TABLE IF NOT EXISTS systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    site_name VARCHAR(255),
    serial_number VARCHAR(100),
    location JSONB,           -- {lat, lng, address, timezone}
    battery_spec JSONB,       -- {chemistry, capacity_kwh, cell_count, voltage, etc}
    connection_config JSONB,  -- {modbus_host, modbus_port, mqtt_topic, etc}
    status VARCHAR(50) DEFAULT 'offline',
    -- Statuses: offline, online, charging, discharging, idle, fault, maintenance
    firmware_version VARCHAR(50),
    last_communication TIMESTAMPTZ,
    commissioned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security for multi-tenancy
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY systems_tenant_isolation ON systems
    USING (
        organization_id::text = current_setting('app.current_org_id', TRUE)
        OR current_setting('app.bypass_rls', TRUE) = 'true'
    );

CREATE INDEX IF NOT EXISTS idx_systems_org ON systems(organization_id);
CREATE INDEX IF NOT EXISTS idx_systems_status ON systems(status);

-- ============================================================
-- Alarms
-- ============================================================
CREATE TABLE IF NOT EXISTS alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,  -- critical, high, medium, low
    type VARCHAR(100) NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    auto_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alarms_system_time ON alarms(system_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_unresolved ON alarms(system_id) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity, created_at DESC);

-- ============================================================
-- Decision Engine Log
-- ============================================================
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,         -- CHARGE, DISCHARGE, IDLE, EMERGENCY_STOP
    power_kw REAL,
    duration_minutes REAL,
    priority VARCHAR(50) NOT NULL,       -- SAFETY, GRID_CODE, CONTRACTUAL, ECONOMIC, LONGEVITY
    reason TEXT,
    confidence REAL,
    mode VARCHAR(50),                    -- ONLINE, AUTONOMOUS, SAFE_MODE
    soc_at_decision REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_system_time ON decisions(system_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action, created_at DESC);

-- ============================================================
-- Audit Log (immutable — no UPDATE or DELETE allowed)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    organization_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- Prevent mutation of audit records
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ============================================================
-- Optimization Configurations (per system)
-- ============================================================
CREATE TABLE IF NOT EXISTS optimization_configs (
    system_id UUID PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
    arbitrage_config JSONB DEFAULT '{
        "buy_threshold_price": 0.45,
        "sell_threshold_price": 0.85,
        "min_soc_for_sell": 30,
        "max_soc_for_buy": 90
    }',
    peak_shaving_config JSONB DEFAULT '{
        "demand_limit_kw": 100,
        "trigger_percent": 80,
        "min_soc_percent": 20
    }',
    solar_config JSONB DEFAULT '{
        "min_solar_excess_kw": 1,
        "target_soc": 80,
        "night_discharge": true
    }',
    grid_services_config JSONB DEFAULT '{}',
    tax_optimizer_config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- ML Models Registry
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,           -- load_forecast, soh_estimator, anomaly_detector
    version VARCHAR(50) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    system_id UUID REFERENCES systems(id),  -- NULL = global model
    onnx_size_bytes INTEGER,
    mape REAL,                            -- Mean Absolute Percentage Error
    rmse REAL,
    training_samples INTEGER,
    training_end_date TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_name_active ON ml_models(name, active);

-- ============================================================
-- Telemetry snapshots (PostgreSQL — last known state per system)
-- The full time-series goes to InfluxDB; this table stores ONLY the latest state
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry_latest (
    system_id UUID PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
    soc REAL,
    soh REAL,
    voltage REAL,
    current REAL,
    power_kw REAL,
    temp_min REAL,
    temp_max REAL,
    temp_avg REAL,
    frequency REAL,
    grid_voltage REAL,
    cell_voltage_min REAL,
    cell_voltage_max REAL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Initial seed data (demo organization)
-- ============================================================
INSERT INTO organizations (id, name, slug, plan, max_systems)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'LIFO4 Demo',
    'lifo4-demo',
    'enterprise',
    100
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Helper function: update updated_at automatically
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_systems_updated_at
    BEFORE UPDATE ON systems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
