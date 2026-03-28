import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Passwort vergessen | H+M FleetHub",
  description: "Setzen Sie Ihr Passwort zurueck.",
}

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">
          Passwort vergessen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  )
}
