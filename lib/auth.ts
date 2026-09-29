import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Selbst gehostet (Docker/Reverse-Proxy): eingehendem Host-Header vertrauen,
  // sonst wirft Auth.js im Production-Build UntrustedHost (z.B. bei http://localhost:3000).
  // Über AUTH_TRUST_HOST in der .env steuerbar; next-auth wertet die Variable in dieser
  // Version nicht selbst aus, daher lesen wir sie hier explizit. Default: vertrauen.
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          modules: user.modules,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.modules = user.modules;
      }
      if (typeof token.id !== "string") return null;
      // Berechtigungen nie aus einer möglicherweise veralteten Sitzung übernehmen.
      const current = await prisma.user.findUnique({ where: { id: token.id },
        select: { role: true, modules: true, name: true, email: true } });
      if (!current) return null;
      token.role = current.role;
      token.modules = current.modules;
      token.name = current.name;
      token.email = current.email;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "MEMBER";
        session.user.modules = (token.modules as ("STOCK" | "INVOICES")[] | undefined) ?? [];
      }
      return session;
    },
  },
});
