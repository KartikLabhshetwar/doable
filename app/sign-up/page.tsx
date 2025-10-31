"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleGoogleSignUp = async () => {
    setError("")
    setLoading(true)

    try {
      const redirectUrl = searchParams.get("redirect") || "/dashboard"
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectUrl
      })
    } catch (err) {
      setError("Failed to sign up with Google")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Section - Primary Gradient */}
      <div className="hidden lg:flex lg:w-[40%] relative overflow-hidden">
        {/* Gradient Background using primary color */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background"></div>
        
        {/* Subtle animated background patterns */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob bg-primary"></div>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob [animation-delay:2s] bg-primary"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-blob [animation-delay:4s] bg-primary"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 h-full">
          {/* Back Button */}
          <Link href="/">
            <Button 
              variant="outline" 
              className="bg-card/50 border-border/50 text-foreground hover:bg-card/80 hover:border-border backdrop-blur-sm w-fit"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>

          {/* Bottom Text */}
          <div className="text-foreground space-y-4">
            <h2 className="text-3xl font-light tracking-tight">Ship Faster, Work Smarter</h2>
            <p className="text-base text-muted-foreground">The task management platform that actually works. Beautiful, intuitive, and built for teams who ship.</p>
          </div>
        </div>
      </div>

      {/* Right Section - Main Form */}
      <div className="flex-1 lg:w-[60%] bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <span className="text-foreground text-xl font-medium tracking-tight">doable</span>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-tight text-foreground">Create your account</h1>
            <p className="text-base text-muted-foreground">Sign up to start your journey with doable</p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 border border-destructive/50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Google Sign Up Button */}
          <Button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            <span className="ml-2">{loading ? "Signing up..." : "Sign up with Google"}</span>
          </Button>

          {/* Sign In Link */}
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link 
              href={`/sign-in${searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : ""}`}
              className="text-primary hover:text-primary/80 hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}