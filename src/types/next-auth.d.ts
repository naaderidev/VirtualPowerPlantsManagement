import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/access-control";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mobile: string;
      role: AppRole;
      partyId: string | null;
      loginSessionId: string;
    } & DefaultSession["user"];
  }

  interface User {
    mobile: string;
    role: AppRole;
    partyId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    mobile?: string;
    role?: AppRole;
    partyId?: string | null;
    loginSessionId?: string;
  }
}
