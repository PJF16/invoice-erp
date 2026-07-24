CREATE TYPE "BackupTarget" AS ENUM ('LOCAL', 'SMB');

CREATE TYPE "BackupInterval" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "BackupSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "target" "BackupTarget" NOT NULL DEFAULT 'SMB',
    "interval" "BackupInterval" NOT NULL DEFAULT 'DAILY',
    "nextRun" TIMESTAMP(3),
    "localPath" TEXT NOT NULL DEFAULT '/backups',
    "smbHost" TEXT NOT NULL DEFAULT '',
    "smbPort" INTEGER NOT NULL DEFAULT 445,
    "smbShare" TEXT NOT NULL DEFAULT '',
    "smbPath" TEXT NOT NULL DEFAULT 'invoice-erp',
    "smbDomain" TEXT NOT NULL DEFAULT '',
    "smbUsername" TEXT NOT NULL DEFAULT '',
    "smbPasswordEncrypted" TEXT NOT NULL DEFAULT '',
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "runningSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupSettings_pkey" PRIMARY KEY ("id")
);
