import { prisma } from "@/lib/prisma";

export async function getSettings() {
  return prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST || process.env.SMTP_JSON === "1");
}
