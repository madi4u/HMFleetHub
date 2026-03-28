import {
  LayoutDashboard,
  Car,
  FileText,
  FolderOpen,
  BarChart3,
  Wrench,
  Shield,
  Users,
  Building2,
  type LucideIcon,
} from "lucide-react"

/**
 * User roles as defined in the PRD.
 * Used to filter navigation items per role.
 */
export type UserRole =
  | "SUPERADMIN"
  | "TENANT_ADMIN"
  | "FLEET_MANAGER"
  | "OFFICE_USER"
  | "WORKSHOP_MECHANIC"
  | "READ_ONLY"

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
  allowedRoles: UserRole[]
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
  allowedRoles: UserRole[]
}

/**
 * Central navigation configuration.
 * Each item specifies which roles can see it.
 * WORKSHOP_MECHANIC only sees "Werkstatt".
 * SUPERADMIN sees everything including the Superadmin section.
 */
export const navigationConfig: NavigationGroup[] = [
  {
    label: "Allgemein",
    allowedRoles: [
      "SUPERADMIN",
      "TENANT_ADMIN",
      "FLEET_MANAGER",
      "OFFICE_USER",
      "READ_ONLY",
    ],
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "OFFICE_USER",
          "READ_ONLY",
        ],
      },
    ],
  },
  {
    label: "Fuhrpark",
    allowedRoles: [
      "SUPERADMIN",
      "TENANT_ADMIN",
      "FLEET_MANAGER",
      "OFFICE_USER",
      "READ_ONLY",
    ],
    items: [
      {
        title: "Fahrzeuge",
        href: "/fleet",
        icon: Car,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "OFFICE_USER",
          "READ_ONLY",
        ],
      },
      {
        title: "Verträge",
        href: "/contracts",
        icon: FileText,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "OFFICE_USER",
        ],
      },
      {
        title: "Dokumente",
        href: "/documents",
        icon: FolderOpen,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "OFFICE_USER",
          "READ_ONLY",
        ],
      },
      {
        title: "Berichte",
        href: "/reports",
        icon: BarChart3,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
        ],
      },
    ],
  },
  {
    label: "Werkstatt",
    allowedRoles: [
      "SUPERADMIN",
      "TENANT_ADMIN",
      "FLEET_MANAGER",
      "WORKSHOP_MECHANIC",
    ],
    items: [
      {
        title: "Werkstatt",
        href: "/workshop",
        icon: Wrench,
        allowedRoles: [
          "SUPERADMIN",
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "WORKSHOP_MECHANIC",
        ],
      },
    ],
  },
  {
    label: "Verwaltung",
    allowedRoles: ["SUPERADMIN", "TENANT_ADMIN"],
    items: [
      {
        title: "Benutzer",
        href: "/admin/users",
        icon: Users,
        allowedRoles: ["SUPERADMIN", "TENANT_ADMIN"],
      },
    ],
  },
  {
    label: "Superadmin",
    allowedRoles: ["SUPERADMIN"],
    items: [
      {
        title: "Mandanten",
        href: "/admin/tenants",
        icon: Building2,
        allowedRoles: ["SUPERADMIN"],
      },
      {
        title: "System",
        href: "/admin/system",
        icon: Shield,
        allowedRoles: ["SUPERADMIN"],
      },
    ],
  },
]

/**
 * Filters navigation groups and items based on the user's role.
 * Returns only the groups and items the given role is allowed to see.
 */
export function getNavigationForRole(role: UserRole): NavigationGroup[] {
  return navigationConfig
    .filter((group) => group.allowedRoles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.allowedRoles.includes(role)),
    }))
    .filter((group) => group.items.length > 0)
}

/**
 * Map of route segments to human-readable labels for breadcrumbs.
 */
export const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  fleet: "Fahrzeuge",
  vehicles: "Fahrzeuge",
  contracts: "Verträge",
  documents: "Dokumente",
  reports: "Berichte",
  workshop: "Werkstatt",
  admin: "Verwaltung",
  users: "Benutzer",
  superadmin: "Superadmin",
  tenants: "Mandanten",
  new: "Neu anlegen",
  edit: "Bearbeiten",
  system: "System",
}

/**
 * Returns the default landing page for a given role.
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "WORKSHOP_MECHANIC":
      return "/workshop"
    default:
      return "/dashboard"
  }
}
