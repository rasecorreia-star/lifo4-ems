/**
 * Prospect Analysis Types for Lifo4 EMS
 * Pre-sales analysis system for BESS dimensioning
 */

// ============================================
// PROSPECT MANAGEMENT
// ============================================

export interface Prospect {
  id: string;
  organizationId: string;              // Lifo4 org ID

  // Contact Information
  contact: ProspectContact;

  // Company/Site Information
  company: ProspectCompany;

  // Analysis Kit
  analyzerId?: string;                 // assigned analyzer kit
  analyzerStatus: AnalyzerStatus;

  // Analysis Data
  analysis?: ProspectAnalysis;

  // Sales Pipeline
  pipeline: PipelineStage;
  assignedTo?: string;                 // sales rep user ID
  probability?: number;                // 0-100%
  estimatedValue?: number;             // R$
  expectedCloseDate?: Date;

  // Proposals
  proposals: Proposal[];

  // Notes & Activities
  notes: ProspectNote[];
  activities: ProspectActivity[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastContactDate?: Date;
  convertedToCustomerAt?: Date;
  customerId?: string;                 // if converted
}

export interface ProspectContact {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  position?: string;
  preferredContact: 'email' | 'phone' | 'whatsapp';
}

export interface ProspectCompany {
  name: string;
  cnpj?: string;
  segment: CompanySegment;

  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };

  // Utility Information
  utility: string;                     // e.g., "Equatorial Energia PI"
  tariffGroup: 'A' | 'B';             // A = industrial, B = residential/commercial
  tariffModality?: 'azul' | 'verde' | 'convencional';
  contractedDemand?: number;           // kW

  // Site Characteristics
  availableArea?: number;              // m² for solar
  roofType?: 'flat' | 'sloped' | 'metal' | 'concrete' | 'none';
  shadingIssues?: boolean;
  gridConnectionCapacity?: number;     // kW

  // Current Energy Profile (manual input or from bills)
  monthlyConsumption?: number;         // kWh average
  monthlyBill?: number;                // R$ average
  peakDemand?: number;                 // kW
  powerFactor?: number;
  hasSolar?: boolean;
  solarCapacity?: number;              // kWp
}

export enum CompanySegment {
  RESIDENTIAL = 'residential',
  COMMERCIAL_SMALL = 'commercial_small',
  COMMERCIAL_MEDIUM = 'commercial_medium',
  COMMERCIAL_LARGE = 'commercial_large',
  INDUSTRIAL_SMALL = 'industrial_small',
  INDUSTRIAL_MEDIUM = 'industrial_medium',
  INDUSTRIAL_LARGE = 'industrial_large',
  UTILITY = 'utility',
  RURAL = 'rural',
  PUBLIC = 'public',
}

export enum AnalyzerStatus {
  NOT_ASSIGNED = 'not_assigned',
  PENDING_INSTALLATION = 'pending_installation',
  INSTALLED = 'installed',
  MEASURING = 'measuring',
  COMPLETED = 'completed',
  REMOVED = 'removed',
}

export enum PipelineStage {
  LEAD = 'lead',                       // initial contact
  QUALIFIED = 'qualified',             // qualified lead
  ANALYSIS = 'analysis',               // analyzer installed
  PROPOSAL = 'proposal',               // proposal sent
  NEGOTIATION = 'negotiation',         // in negotiation
  WON = 'won',                         // closed deal
  LOST = 'lost',                       // lost deal
}

// ============================================
// ANALYZER KIT
// ============================================

export interface AnalyzerKit {
  id: string;
  serialNumber: string;
  name: string;

  // Hardware
  hardware: AnalyzerHardware;

  // Current Assignment
  currentProspectId?: string;
  installationDate?: Date;
  expectedRemovalDate?: Date;

  // Status
  status: AnalyzerKitStatus;
  lastSeen?: Date;
  batteryLevel?: number;               // % (for UPS)
  signalStrength?: number;             // RSSI

  // Configuration
  measurementInterval: number;         // seconds
  reportingInterval: number;           // seconds

  // Maintenance
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  firmwareVersion?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyzerHardware {
  // Main Controller
  controllerType: 'raspberry_pi_4' | 'raspberry_pi_5' | 'industrial_pc';
  controllerSerial?: string;

  // Meter
  meterModel: string;                  // e.g., "Eastron SDM630"
  meterSerial?: string;

  // CTs
  ctRatings: number[];                 // [100, 200] for different CTs included

  // Connectivity
  modemModel?: string;
  simNumber?: string;
  modemSerial?: string;

  // UPS
  hasUps: boolean;
  upsCapacity?: number;                // Wh
}

export enum AnalyzerKitStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  IN_TRANSIT = 'in_transit',
  INSTALLED = 'installed',
  MEASURING = 'measuring',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
}

// ============================================
// ANALYSIS DATA
// ============================================

export interface ProspectAnalysis {
  id: string;
  prospectId: string;
  analyzerId: string;

  // Measurement Period
  startDate: Date;
  endDate?: Date;
  measurementDays: number;

  // Raw Data Summary
  rawDataSummary: RawDataSummary;

  // Calculated Metrics
  loadProfile: LoadProfile;
  demandAnalysis: DemandAnalysis;
  tariffAnalysis: TariffAnalysis;
  qualityAnalysis: PowerQualityAnalysis;

  // AI Analysis
  patterns: LoadPatterns;
  opportunities: EnergyOpportunities;

  // Recommendations
  recommendations: SystemRecommendation[];

  // Status
  status: 'collecting' | 'processing' | 'completed' | 'failed';
  processingProgress?: number;         // 0-100%
  error?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface RawDataSummary {
  totalDataPoints: number;
  missingDataPoints: number;
  dataCompleteness: number;            // %

  // Aggregated Values
  totalEnergyImport: number;           // kWh
  totalEnergyExport: number;           // kWh
  peakDemand: number;                  // kW
  peakDemandTimestamp: Date;
  averagePower: number;                // kW
  minPower: number;                    // kW

  // Power Factor
  averagePowerFactor: number;
  minPowerFactor: number;

  // Voltage
  averageVoltage: number;              // V
  minVoltage: number;
  maxVoltage: number;
  voltageDeviations: number;           // count of >±10%

  // Frequency
  averageFrequency: number;            // Hz
  frequencyDeviations: number;
}

export interface LoadProfile {
  // Hourly Profile (average per hour, 0-23)
  hourlyAverage: number[];             // kW
  hourlyMax: number[];
  hourlyMin: number[];

  // Daily Profile (by day of week, 0-6)
  dailyAverage: number[];              // kW
  dailyTotal: number[];                // kWh

  // Monthly Projection
  projectedMonthlyConsumption: number; // kWh
  projectedMonthlyDemand: number;      // kW

  // Typical Day Curves
  weekdayProfile: number[];            // 24 values, kW
  weekendProfile: number[];            // 24 values
}

export interface DemandAnalysis {
  // Current Demand
  measuredPeakDemand: number;          // kW
  averageDemand: number;               // kW
  loadFactor: number;                  // % (average/peak)

  // Contracted vs Actual
  contractedDemand?: number;           // kW
  demandUtilization?: number;          // %
  overdmandEvents?: number;            // count

  // Peak Times
  peakHours: number[];                 // typical peak hours
  offPeakHours: number[];

  // Demand Reduction Potential
  peakShavingPotential: number;        // kW that can be shaved
  demandReductionSavings: number;      // R$/month
}

export interface TariffAnalysis {
  // Current Costs
  currentMonthlyCost: number;          // R$
  energyCost: number;                  // R$ (energy only)
  demandCost: number;                  // R$ (demand charges)
  reactiveEnergyCost: number;          // R$ (power factor penalty)
  otherCharges: number;                // R$ (taxes, fees)

  // Cost by Period
  peakEnergyCost: number;              // R$
  offPeakEnergyCost: number;           // R$

  // Consumption by Period
  peakConsumption: number;             // kWh
  offPeakConsumption: number;          // kWh
  peakPercentage: number;              // %

  // Savings Potential
  arbitrageSavingsPotential: number;   // R$/month (buy low, use high)
  demandSavingsPotential: number;      // R$/month
  powerFactorSavingsPotential: number; // R$/month
}

export interface PowerQualityAnalysis {
  // Voltage Quality
  averageVoltage: number;
  voltageImbalance: number;            // %
  voltageDeviation: number;            // % from nominal
  voltageEvents: VoltageEvent[];

  // Power Factor
  averagePowerFactor: number;
  belowMinimumEvents: number;          // count < 0.92
  reactiveEnergyImported: number;      // kVArh

  // THD
  averageThdVoltage?: number;          // %
  averageThdCurrent?: number;          // %
  harmonicsIssues: boolean;
}

export interface VoltageEvent {
  timestamp: Date;
  type: 'sag' | 'swell' | 'interruption';
  magnitude: number;                   // %
  duration: number;                    // seconds
}

export interface LoadPatterns {
  // Classification
  loadType: 'constant' | 'variable' | 'peaky' | 'cyclical';
  predictability: number;              // 0-100%

  // Weekday vs Weekend
  weekdayWeekendRatio: number;         // weekday/weekend consumption

  // Seasonality (if enough data)
  hasSeasonality: boolean;
  seasonalFactor?: number;

  // Anomalies Detected
  anomalies: LoadAnomaly[];
}

export interface LoadAnomaly {
  timestamp: Date;
  type: 'spike' | 'drop' | 'unusual_pattern';
  magnitude: number;                   // % deviation from expected
  duration: number;                    // minutes
}

export interface EnergyOpportunities {
  // Peak Shaving
  peakShaving: {
    potential: number;                 // kW
    savings: number;                   // R$/month
    requiredBessSize: number;          // kWh
  };

  // Energy Arbitrage
  arbitrage: {
    potential: number;                 // kWh/day
    savings: number;                   // R$/month
    requiredBessSize: number;          // kWh
  };

  // Solar Integration
  solar: {
    estimatedGeneration: number;       // kWh/month
    selfConsumptionPotential: number;  // %
    exportPotential: number;           // kWh/month
    recommendedSize: number;           // kWp
  };

  // Backup
  backup: {
    criticalLoadEstimate: number;      // kW
    backupHoursNeeded: number;         // hours desired
    requiredBessSize: number;          // kWh
  };

  // Total Value
  totalMonthlySavings: number;         // R$
  totalAnnualSavings: number;          // R$
}

// ============================================
// SYSTEM RECOMMENDATIONS
// ============================================

export interface SystemRecommendation {
  id: string;
  name: string;
  type: 'conservative' | 'recommended' | 'premium' | 'custom';
  isRecommended: boolean;

  // System Configuration
  bessSize: number;                    // kWh
  bessPower: number;                   // kW
  solarSize?: number;                  // kWp
  inverterSize?: number;               // kW

  // Operating Strategy
  strategy: 'peak_shaving' | 'arbitrage' | 'self_consumption' | 'backup' | 'hybrid';
  strategyDescription: string;

  // Financial Projections
  financial: FinancialProjection;

  // Environmental Impact
  environmental: EnvironmentalImpact;

  // Technical Details
  technical: TechnicalDetails;
}

export interface FinancialProjection {
  // Costs
  equipmentCost: number;               // R$
  installationCost: number;            // R$
  totalCapex: number;                  // R$
  annualOpex: number;                  // R$

  // Savings
  monthlyEnergySavings: number;        // R$
  monthlyDemandSavings: number;        // R$
  totalMonthlySavings: number;         // R$
  annualSavings: number;               // R$

  // Returns
  simplePayback: number;               // years
  roi: number;                         // % (10 years)
  irr: number;                         // %
  npv: number;                         // R$ (10 years, 10% discount)
  lcoe: number;                        // R$/kWh

  // Cash Flow (10 years)
  cashFlow: YearlyCashFlow[];
}

export interface YearlyCashFlow {
  year: number;
  savings: number;                     // R$
  opex: number;                        // R$
  netCashFlow: number;                 // R$
  cumulativeCashFlow: number;          // R$
}

export interface EnvironmentalImpact {
  annualCo2Avoided: number;            // tonnes
  lifetimeCo2Avoided: number;          // tonnes (10 years)
  treesEquivalent: number;             // trees planted equivalent
  carsOffRoad: number;                 // cars removed equivalent
  renewableShare: number;              // % of consumption
}

export interface TechnicalDetails {
  // Equipment Specs
  bessModel?: string;
  solarPanelModel?: string;
  inverterModel?: string;

  // Installation Requirements
  requiredArea: number;                // m²
  weightTotal: number;                 // kg
  installationDays: number;

  // Performance Estimates
  expectedCycles: number;              // per year
  expectedEfficiency: number;          // %
  expectedLifetime: number;            // years

  // Grid Connection
  requiredGridUpgrade: boolean;
  gridUpgradeCost?: number;            // R$
}

// ============================================
// PROPOSALS
// ============================================

export interface Proposal {
  id: string;
  prospectId: string;
  version: number;
  name: string;

  // Selected Recommendation
  recommendationId: string;
  recommendation: SystemRecommendation;

  // Customizations
  customizations?: ProposalCustomization;

  // Pricing
  pricing: ProposalPricing;

  // Terms
  paymentTerms: PaymentTerms;
  warranty: WarrantyTerms;
  deliverySchedule: string;

  // Status
  status: ProposalStatus;
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  response?: 'accepted' | 'rejected' | 'counter';
  responseNotes?: string;

  // Document
  pdfUrl?: string;
  pdfGeneratedAt?: Date;

  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface ProposalCustomization {
  bessSize?: number;
  solarSize?: number;
  additionalFeatures?: string[];
  removedFeatures?: string[];
  notes?: string;
}

export interface ProposalPricing {
  equipmentPrice: number;              // R$
  installationPrice: number;           // R$
  additionalServices: PricingItem[];
  subtotal: number;                    // R$
  discount?: number;                   // R$
  discountReason?: string;
  total: number;                       // R$
}

export interface PricingItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentTerms {
  method: 'cash' | 'installments' | 'financing' | 'lease';
  downPayment?: number;                // R$ or %
  installments?: number;
  installmentValue?: number;           // R$
  interestRate?: number;               // % per month
  financingBank?: string;
  totalWithInterest?: number;          // R$
}

export interface WarrantyTerms {
  equipmentWarranty: number;           // years
  installationWarranty: number;        // years
  performanceGuarantee?: string;       // e.g., "90% capacity for 10 years"
  maintenanceIncluded: boolean;
  maintenancePeriod?: number;          // years
}

export enum ProposalStatus {
  DRAFT = 'draft',
  READY = 'ready',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COUNTER = 'counter',
  EXPIRED = 'expired',
}

// ============================================
// ACTIVITIES & NOTES
// ============================================

export interface ProspectNote {
  id: string;
  prospectId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  isPinned: boolean;
}

export interface ProspectActivity {
  id: string;
  prospectId: string;
  type: ActivityType;
  title: string;
  description?: string;

  // Scheduling
  scheduledAt?: Date;
  completedAt?: Date;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;

  // Outcome
  outcome?: 'completed' | 'rescheduled' | 'cancelled' | 'no_show';
  outcomeNotes?: string;

  createdAt: Date;
  createdBy: string;
}

export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  SITE_VISIT = 'site_visit',
  ANALYZER_INSTALLATION = 'analyzer_installation',
  ANALYZER_REMOVAL = 'analyzer_removal',
  PROPOSAL_SENT = 'proposal_sent',
  PROPOSAL_FOLLOW_UP = 'proposal_follow_up',
  CONTRACT_SIGNING = 'contract_signing',
  OTHER = 'other',
}

// ============================================
// SALES STATISTICS
// ============================================

export interface SalesStatistics {
  period: {
    start: Date;
    end: Date;
  };

  // Pipeline
  totalProspects: number;
  prospectsByStage: Record<PipelineStage, number>;

  // Conversion
  conversionRate: number;              // % from lead to won
  averageSalesCycle: number;           // days
  conversionBySource: Record<string, number>;

  // Revenue
  totalRevenue: number;                // R$
  averageDealSize: number;             // R$
  revenueBySegment: Record<CompanySegment, number>;

  // Activity
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;

  // Analyzers
  analyzersDeployed: number;
  averageMeasurementDays: number;

  // Proposals
  proposalsSent: number;
  proposalsAccepted: number;
  proposalAcceptanceRate: number;      // %

  // Team Performance
  performanceByRep: SalesRepPerformance[];
}

export interface SalesRepPerformance {
  userId: string;
  userName: string;
  prospectsAssigned: number;
  dealsWon: number;
  dealsLost: number;
  revenue: number;                     // R$
  conversionRate: number;              // %
  averageCycleTime: number;            // days
}
