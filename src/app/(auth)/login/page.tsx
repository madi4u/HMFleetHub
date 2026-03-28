import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Anmelden | H+M FleetHub",
  description: "Melden Sie sich bei H+M FleetHub an.",
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-xl">Anmelden</CardTitle>
        <CardDescription className="text-center">
          Melden Sie sich mit Ihren Zugangsdaten an.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
