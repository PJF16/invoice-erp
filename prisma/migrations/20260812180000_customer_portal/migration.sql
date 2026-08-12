-- CreateTable
CREATE TABLE "PortalLoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "linkHash" TEXT NOT NULL,
    "requestIpHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalLoginToken_linkHash_key" ON "PortalLoginToken"("linkHash");

-- CreateIndex
CREATE INDEX "PortalLoginToken_email_createdAt_idx" ON "PortalLoginToken"("email", "createdAt");

-- CreateIndex
CREATE INDEX "PortalLoginToken_requestIpHash_createdAt_idx" ON "PortalLoginToken"("requestIpHash", "createdAt");

-- CreateIndex
CREATE INDEX "PortalLoginToken_expiresAt_idx" ON "PortalLoginToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PortalSession_email_idx" ON "PortalSession"("email");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");
