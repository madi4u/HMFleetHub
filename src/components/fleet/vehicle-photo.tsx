"use client"

import { Car } from "lucide-react"
import { cn } from "@/lib/utils"

interface VehiclePhotoProps {
  imageUrl: string | null
  licensePlate: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-20 w-20",
  lg: "h-40 w-40",
}

const iconSizeClasses = {
  sm: "h-5 w-5",
  md: "h-10 w-10",
  lg: "h-20 w-20",
}

export function VehiclePhoto({
  imageUrl,
  licensePlate,
  size = "sm",
  className,
}: VehiclePhotoProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`Fahrzeug ${licensePlate}`}
        className={cn(
          "rounded-md object-cover",
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-muted",
        sizeClasses[size],
        className
      )}
      aria-label={`Kein Bild fuer ${licensePlate}`}
    >
      <Car className={cn("text-muted-foreground", iconSizeClasses[size])} />
    </div>
  )
}
