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
    }
  }
  interface User {
    role?: string | null
    sessionVersion?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number
    role?: string | null
    sessionVersion?: number
  }
}
