import NextAuth, { type NextAuthOptions } from "next-auth";
import { randomUUID } from "node:crypto";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { isAppRole } from "@/lib/access-control";
import { DEMO_ACCOUNTS, isDemoLoginEnabled } from "@/lib/demo-accounts";

async function findActiveUserByMobile(mobile: string) {
  return prisma.user.findUnique({ where: { mobile } });
}

async function recordLoginAndCreateSessionUser(
  user: Awaited<ReturnType<typeof findActiveUserByMobile>>
) {
  if (!user || !user.active) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    partyId: user.partyId,
  };
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        mobile: { label: "شماره موبایل", type: "text" },
        password: { label: "رمز عبور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.mobile || !credentials?.password) {
          return null;
        }

        const user = await findActiveUserByMobile(credentials.mobile as string);

        if (!user || !user.password || !user.active) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return recordLoginAndCreateSessionUser(user);
      },
    }),
    CredentialsProvider({
      id: "demo",
      name: "demo",
      credentials: {
        role: { label: "نقش", type: "text" },
      },
      async authorize(credentials) {
        if (!isDemoLoginEnabled() || !credentials?.role) return null;

        const account = DEMO_ACCOUNTS.find(({ role }) => role === credentials.role);
        if (!account) return null;

        const user = account.role === "ADMIN"
          ? await prisma.user.findFirst({ where: { email: "admin@vpp.local", role: "ADMIN" } })
          : await findActiveUserByMobile(account.mobile);
        if (!user || user.role !== account.role) return null;

        return recordLoginAndCreateSessionUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.mobile = user.mobile;
        token.partyId = user.partyId;
        token.loginSessionId = randomUUID();
      } else if (typeof token.loginSessionId !== "string") {
        token.loginSessionId = randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      if (
        session.user &&
        token.sub &&
        isAppRole(token.role) &&
        typeof token.mobile === "string"
      ) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.mobile = token.mobile;
        session.user.partyId = typeof token.partyId === "string" ? token.partyId : null;
        session.user.loginSessionId =
          typeof token.loginSessionId === "string" ? token.loginSessionId : "";
      }
      return session;
    },
  },
} satisfies NextAuthOptions;

export default NextAuth(authOptions);
