import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: number
      role: string | null
      name?: string | null
      email?: string | null
      image?: string | null
      sessionVersion?: number
      signInProvider?: string
      authenticatedAt?: number
    }
  }
  interface User {
    role?: string | null
    sessionVersion?: number
    signInProvider?: string
    authenticatedAt?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number
    role?: string | null
    sessionVersion?: number
    signInProvider?: string
    authenticatedAt?: number
  }
}
