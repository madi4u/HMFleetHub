/**
 * Database types for the FleetHub application.
 * Mirrors the Supabase schema defined in the PROJ-1 migration.
 */

export type TenantStatus = "active" | "inactive"

export type UserRole =
  | "SUPERADMIN"
  | "TENANT_ADMIN"
  | "FLEET_MANAGER"
  | "OFFICE_USER"
  | "WORKSHOP_MECHANIC"
  | "READ_ONLY"

export interface Tenant {
  id: string
  name: string
  slug: string
  status: TenantStatus
  contact_email: string | null
  address: string | null
  created_at: string
  updated_at: string
}

/**
 * Tenant with aggregated counts, returned by the admin API.
 */
export interface TenantWithCounts extends Tenant {
  user_count: number
  vehicle_count: number
}

export interface Profile {
  id: string
  tenant_id: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserTenantMembership {
  id: string
  user_id: string
  tenant_id: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * User as returned by GET /api/users for the tenant user list.
 */
export interface TenantUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
}

/**
 * A user with their tenant membership, profile, and last sign-in.
 * Includes membership_id for PATCH /api/users/[id] operations.
 */
export interface UserWithMembership {
  membership_id: string
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
}

/**
 * The response shape returned by GET /api/auth/me.
 * Combines auth user data with profile and membership info.
 */
export interface AuthMeResponse {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  is_active: boolean
}

/**
 * Vehicle status values (PROJ-5).
 */
export type VehicleStatus =
  | "Aktiv"
  | "Inaktiv"
  | "In Werkstatt"
  | "Verkauft"
  | "Abgemeldet"

/**
 * Vehicle type categories (PROJ-5).
 */
export type VehicleType =
  | "PKW"
  | "LKW"
  | "Transporter"
  | "Motorrad"
  | "Anhänger"
  | "Verkaufsanhänger"
  | "Foodtruck"
  | "Sonstige"

/**
 * Fuel type options (PROJ-5).
 */
export type FuelType =
  | "Benzin"
  | "Diesel"
  | "Elektro"
  | "Hybrid"
  | "Gas"
  | "LPG"
  | "CNG"
  | "Sonstige"

/**
 * Vehicle record as returned by the API (PROJ-5).
 */
export interface Vehicle {
  id: string
  tenant_id: string
  license_plate: string
  make: string
  model: string
  vehicle_type: VehicleType
  status: VehicleStatus
  image_url: string | null
  vin: string | null
  first_registration: string | null
  year: number | null
  color: string | null
  current_mileage: number | null
  location: string | null
  assigned_to: string | null
  notes: string | null
  tire_size: string | null
  engine_oil_spec: string | null
  transmission_oil_spec: string | null
  fuel_type: FuelType | null
  engine_code: string | null
  engine_power: number | null
  hsn: string | null
  tsn: string | null
  tuev_bis: string | null
  service_interval_notes: string | null
  technical_notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Paginated vehicle list response from GET /api/vehicles.
 */
export interface PaginatedVehicles {
  data: Vehicle[]
  total: number
  page: number
  pageSize: number
}

/** @deprecated Use PaginatedVehicles instead */
export type VehicleListResponse = PaginatedVehicles

// ---------------------------------------------------------------------------
// PROJ-9: Repair status
// ---------------------------------------------------------------------------

export type RepairStatus = "OPEN" | "IN_PROGRESS" | "DONE"

// ---------------------------------------------------------------------------
// PROJ-6: History Module
// ---------------------------------------------------------------------------

export type HistoryEntryType =
  | "NOTE"
  | "REPAIR"
  | "MAINTENANCE"
  | "OIL_CHANGE"
  | "TIRE_CHANGE"
  | "DAMAGE"
  | "INSPECTION"
  | "TUV"
  | "MILEAGE_UPDATE"
  | "DOCUMENT_UPLOAD"
  | "PHOTO_UPLOAD"
  | "VIDEO_UPLOAD"
  | "OTHER"

export type AttachmentType = "IMAGE" | "VIDEO" | "DOCUMENT"

export interface HistoryAttachment {
  id: string
  tenant_id: string
  history_entry_id: string
  vehicle_id: string
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  attachment_type: AttachmentType
  signed_url?: string | null
  created_at: string
}

export interface HistoryEntry {
  id: string
  tenant_id: string
  vehicle_id: string
  author_user_id: string
  author_name: string | null
  author_avatar: string | null
  entry_type: HistoryEntryType
  title: string | null
  message: string | null
  mileage: number | null
  cost_net: number | null
  cost_gross: number | null
  currency: string | null
  supplier: string | null
  invoice_number: string | null
  repair_status: RepairStatus | null
  next_due_date: string | null
  event_date: string
  created_at: string
  updated_at: string
  attachments: HistoryAttachment[]
}

export interface PaginatedHistory {
  data: HistoryEntry[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// PROJ-7: Workshop View
// ---------------------------------------------------------------------------

/**
 * Minimal vehicle data for workshop search results (PROJ-7).
 */
export interface VehicleWorkshopSearchResult {
  id: string
  license_plate: string
  make: string
  model: string
  vehicle_type: VehicleType
  status: VehicleStatus
  image_url: string | null
}

/**
 * Workshop-safe vehicle view: technical fields only, no financial/contract data (PROJ-7).
 */
export interface VehicleWorkshopView {
  id: string
  tenant_id: string
  license_plate: string
  make: string
  model: string
  vehicle_type: VehicleType
  status: VehicleStatus
  image_url: string | null
  vin: string | null
  current_mileage: number | null
  year: number | null
  first_registration: string | null
  tire_size: string | null
  engine_oil_spec: string | null
  transmission_oil_spec: string | null
  fuel_type: FuelType | null
  engine_code: string | null
  engine_power: number | null
  hsn: string | null
  tsn: string | null
  tuev_bis: string | null
  service_interval_notes: string | null
  technical_notes: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// PROJ-8: Mileage & Costs
// ---------------------------------------------------------------------------

export type CostCategory =
  | "REPAIR"
  | "MAINTENANCE"
  | "OIL"
  | "TIRES"
  | "INSPECTION"
  | "BODYWORK"
  | "ELECTRICAL"
  | "OTHER"

export interface MileageEntry {
  id: string
  tenant_id: string
  vehicle_id: string
  user_id: string
  author_name: string | null
  mileage: number
  recorded_at: string
  source: string | null
  notes: string | null
  created_at: string
}

export interface CostSummary {
  total_net: number
  total_gross: number
  currency: string
  by_category: { category: CostCategory; total_gross: number; count: number }[]
  by_month: { year: number; month: number; total_gross: number; count: number }[]
}

// ---------------------------------------------------------------------------
// PROJ-10: Contracts
// ---------------------------------------------------------------------------

export type ContractType = "LEASING" | "FINANCING" | "PURCHASE"
export type ContractStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "PLANNED"

export interface ContractDocument {
  id: string
  tenant_id: string
  contract_id: string
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  signed_url?: string | null
  created_at: string
}

export interface Contract {
  id: string
  tenant_id: string
  vehicle_id: string
  contract_type: ContractType
  contract_status: ContractStatus
  provider: string
  contract_start: string
  contract_end: string | null
  monthly_cost: number | null
  purchase_price: number | null
  financing_amount: number | null
  residual_value: number | null
  currency: string
  contract_number: string | null
  notice_period_days: number | null
  notes: string | null
  documents: ContractDocument[]
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// PROJ-11: Vehicle Documents (DMS)
// ---------------------------------------------------------------------------

export type VehicleDocumentType =
  | "REGISTRATION_CERTIFICATE"
  | "INSURANCE"
  | "LEASE_CONTRACT"
  | "FINANCING_CONTRACT"
  | "INVOICE"
  | "INSPECTION_REPORT"
  | "OTHER"

export interface VehicleDocument {
  id: string
  tenant_id: string
  vehicle_id: string
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  document_type: VehicleDocumentType
  attachment_type: AttachmentType
  description: string | null
  is_current: boolean
  signed_url?: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// PROJ-13: Dashboard & Reporting
// ---------------------------------------------------------------------------

export interface FleetStats {
  total: number
  active: number
  in_workshop: number
  due_soon: number // next_due_date within 30 days
}

export interface DashboardRecentActivity {
  id: string
  vehicle_id: string
  vehicle_license_plate: string
  vehicle_make: string
  vehicle_model: string
  entry_type: HistoryEntryType
  title: string | null
  message: string | null
  author_name: string | null
  event_date: string
  created_at: string
}

export interface DashboardRecentMileage {
  id: string
  vehicle_id: string
  vehicle_license_plate: string
  vehicle_make: string
  vehicle_model: string
  mileage: number
  recorded_at: string
  author_name: string | null
}

export interface DashboardTopVehicle {
  vehicle_id: string
  license_plate: string
  make: string
  model: string
  total_gross: number
}

export interface DashboardExpiringContract {
  id: string
  vehicle_id: string
  vehicle_license_plate: string
  vehicle_make: string
  vehicle_model: string
  contract_type: ContractType
  contract_status: ContractStatus
  provider: string
  contract_end: string
  monthly_cost: number | null
  currency: string
}

export interface DashboardData {
  operative: {
    fleet_stats: FleetStats
    upcoming_maintenance: Array<{
      id: string
      vehicle_id: string
      vehicle_license_plate: string
      vehicle_make: string
      vehicle_model: string
      entry_type: HistoryEntryType
      title: string | null
      next_due_date: string
      repair_status: RepairStatus | null
    }>
    recent_activities: DashboardRecentActivity[]
    recent_mileage: DashboardRecentMileage[]
    upcoming_tuev: Array<{
      vehicle_id: string
      license_plate: string
      make: string
      model: string
      tuev_bis: string
    }>
  }
  financial?: {
    cost_this_month: number
    cost_this_year: number
    cost_total: number
    monthly_trend: { year: number; month: number; total_gross: number }[]
    by_category: { category: string; total_gross: number }[]
    top_vehicles: DashboardTopVehicle[]
    expiring_contracts: DashboardExpiringContract[]
  }
}
