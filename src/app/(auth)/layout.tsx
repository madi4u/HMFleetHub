/**
 * Auth layout: centered card layout for login, forgot-password, reset-password.
 * No sidebar, no header -- just the branding and the form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-xl font-bold text-primary-foreground">
              H+M
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            FleetHub
          </h1>
        </div>

        {children}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          H+M FleetHub &mdash; Fuhrparkmanagement
        </p>
      </div>
    </div>
  )
}
