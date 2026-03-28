"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { routeLabels } from "@/lib/navigation"

/**
 * Dynamic breadcrumbs that update based on the current pathname.
 * Translates route segments to German labels from the central config.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname()

  // Split the path into segments and filter out empty strings
  const segments = pathname.split("/").filter(Boolean)

  // If we are at root or have no segments, show nothing
  if (segments.length === 0) {
    return null
  }

  // Build breadcrumb items with cumulative hrefs
  const breadcrumbItems = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const label = routeLabels[segment] || segment
    const isLast = index === segments.length - 1

    return { href, label, isLast, key: href }
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={item.key}>
            {index > 0 && <BreadcrumbSeparator />}
            {item.isLast ? (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.href}>{item.label}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
