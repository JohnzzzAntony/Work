'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Workflow, LogIn, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import type { UserDTO } from '@/lib/types'

export function LoginView() {
  const setUser = useAppStore((s) => s.setUser)
  const [email, setEmail] = React.useState('admin@workflowhub.com')
  const [password, setPassword] = React.useState('admin123')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<{ user: UserDTO }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      setUser(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="border-slate-200/80 shadow-lg dark:border-slate-800">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <Workflow className="size-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                WorkFlow Hub
              </CardTitle>
              <CardDescription>
                Sign in to manage work assignments, follow-ups &amp; completions.
              </CardDescription>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Log In
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Demo admin:{' '}
                <span className="font-medium text-foreground">admin@workflowhub.com</span> /{' '}
                <span className="font-medium text-foreground">admin123</span>
                <br />
                Employees: john/asha/liz/raj @workflowhub.com /{' '}
                <span className="font-medium text-foreground">emp123</span>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
