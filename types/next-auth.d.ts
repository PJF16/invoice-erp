import type { DefaultSession } from "next-auth";
import type { ModuleName } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      modules: ModuleName[];
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "MEMBER";
    modules: ModuleName[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADMIN" | "MEMBER";
    modules?: ModuleName[];
  }
}
