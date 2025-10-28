"use client"

import { useState, useEffect } from "react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomNavbar } from "@/components/landing/CustomNavbar"
import {Instrument_Serif} from 'next/font/google'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
})

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Check if user is already logged in and redirect if needed
  useEffect(() => {
    const checkSession = async () => {
      const { data: session } = await authClient.getSession()
      if (session?.user) {
        const redirectUrl = searchParams.get("redirect") || "/dashboard"
        router.push(redirectUrl)
      }
    }
    checkSession()
  }, [router, searchParams])

  const handleGoogleSignIn = async () => {
    setError("")
    setLoading(true)

    try {
      const redirectUrl = searchParams.get("redirect") || "/dashboard"
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectUrl
      })
    } catch (err) {
      setError("Failed to sign in with Google")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <CustomNavbar className={instrumentSerif.className} />
      <div className="flex items-center justify-center p-4 pt-24">
        <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Sign in to your account using Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button 
            type="button" 
            className="w-full" 
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Google"}
          </Button>

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <a href={`/sign-up${searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : ""}`} className="text-primary hover:underline">
              Sign up
            </a>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}

