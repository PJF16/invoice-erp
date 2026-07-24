import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import type { BackupInterval, BackupSettings } from "@/lib/generated/prisma/client";

const execFileAsync = promisify(execFile);
const LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function encryptionKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("BACKUP_ENCRYPTION_KEY oder AUTH_SECRET ist für SMB-Zugangsdaten erforderlich");
  }
  return createHash("sha256").update(`invoice-erp-backup:${secret}`).digest();
}

export function encryptBackupSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptBackupSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Gespeicherte SMB-Zugangsdaten sind ungültig");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export async function getBackupSettings() {
  return prisma.backupSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export function publicBackupSettings(settings: BackupSettings) {
  const { smbPasswordEncrypted, runningSince, ...safe } = settings;
  return {
    ...safe,
    smbPasswordConfigured: Boolean(smbPasswordEncrypted),
    running: Boolean(runningSince),
  };
}

export function addBackupInterval(date: Date, interval: BackupInterval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

function nextFutureRun(scheduledFor: Date, interval: BackupInterval, now = new Date()) {
  let next = new Date(scheduledFor);
  do {
    next = addBackupInterval(next, interval);
  } while (next <= now);
  return next;
}

function backupFilename(now = new Date()) {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `invoice-erp_${timestamp}.dump`;
}

function databaseConnection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL ist nicht gesetzt");

  const url = new URL(raw);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL ist keine PostgreSQL-Verbindung");
  }

  return {
    host: url.hostname,
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    sslMode: url.searchParams.get("sslmode"),
  };
}

async function createDatabaseDump(outputPath: string) {
  const connection = databaseConnection();
  try {
    await execFileAsync(
      "pg_dump",
      [
        "--format=custom",
        "--compress=6",
        "--no-owner",
        "--no-privileges",
        "--file",
        outputPath,
        "--host",
        connection.host,
        "--port",
        connection.port,
        "--username",
        connection.username,
        connection.database,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: connection.password,
          ...(connection.sslMode ? { PGSSLMODE: connection.sslMode } : {}),
        },
        timeout: 60 * 60 * 1000,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("pg_dump ist auf dem Server nicht installiert");
    }
    const stderr = typeof (error as { stderr?: unknown }).stderr === "string"
      ? (error as { stderr: string }).stderr.trim()
      : "";
    throw new Error(stderr ? `Datenbank-Dump fehlgeschlagen: ${stderr}` : "Datenbank-Dump fehlgeschlagen");
  }
}

async function storeLocally(sourcePath: string, directory: string, filename: string) {
  await mkdir(directory, { recursive: true });
  const destination = join(directory, filename);
  const partial = `${destination}.partial`;
  try {
    await copyFile(sourcePath, partial);
    await rename(partial, destination);
    return destination;
  } catch (error) {
    await unlink(partial).catch(() => undefined);
    throw error;
  }
}

function smbQuote(value: string) {
  if (/[";\r\n]/.test(value)) throw new Error("Der SMB-Pfad enthält ungültige Zeichen");
  return `"${value}"`;
}

async function runSmbClient(settings: BackupSettings, password: string, authFile: string, command: string) {
  await writeFile(
    authFile,
    [
      `username = ${settings.smbUsername}`,
      `password = ${password}`,
      ...(settings.smbDomain ? [`domain = ${settings.smbDomain}`] : []),
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );

  try {
    await execFileAsync(
      "smbclient",
      [
        `//${settings.smbHost}/${settings.smbShare}`,
        "--authentication-file",
        authFile,
        "--port",
        String(settings.smbPort),
        "--option",
        "client min protocol=SMB2",
        "--no-pass",
        "--command",
        command,
      ],
      { timeout: 60 * 60 * 1000, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error("smbclient ist auf dem Server nicht installiert");
    const stderr = typeof (error as { stderr?: unknown }).stderr === "string"
      ? (error as { stderr: string }).stderr.trim()
      : "";
    throw new Error(stderr ? `SMB-Übertragung fehlgeschlagen: ${stderr}` : "SMB-Übertragung fehlgeschlagen");
  } finally {
    await unlink(authFile).catch(() => undefined);
  }
}

async function storeOnSmb(sourcePath: string, settings: BackupSettings, filename: string, authFile: string) {
  if (!settings.smbPasswordEncrypted) throw new Error("Kein SMB-Passwort gespeichert");
  const password = decryptBackupSecret(settings.smbPasswordEncrypted);
  const segments = settings.smbPath.split(/[/\\]+/).filter(Boolean);
  let prefix = "";

  for (const segment of segments) {
    if (segment === "." || segment === "..") throw new Error("Ungültiger SMB-Unterordner");
    prefix = prefix ? `${prefix}/${segment}` : segment;
    await runSmbClient(settings, password, authFile, `mkdir ${smbQuote(prefix)}`).catch(() => undefined);
  }

  const remoteDirectory = segments.join("/");
  const partial = `${filename}.partial`;
  const commands = [
    ...(remoteDirectory ? [`cd ${smbQuote(remoteDirectory)}`] : []),
    `put ${smbQuote(sourcePath)} ${smbQuote(partial)}`,
    `rename ${smbQuote(partial)} ${smbQuote(filename)}`,
  ];
  await runSmbClient(settings, password, authFile, commands.join("; "));
  return `smb://${settings.smbHost}/${settings.smbShare}/${remoteDirectory ? `${remoteDirectory}/` : ""}${filename}`;
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Backup-Fehler";
  return message.slice(0, 1000);
}

async function acquireBackupLock() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const result = await prisma.backupSettings.updateMany({
    where: {
      id: "singleton",
      OR: [{ runningSince: null }, { runningSince: { lt: staleBefore } }],
    },
    data: { runningSince: new Date() },
  });
  if (result.count === 0) throw new ApiError(409, "Es läuft bereits ein Backup");
}

async function executeBackup(lockAcquired: boolean) {
  await getBackupSettings();
  if (!lockAcquired) await acquireBackupLock();
  const startedAt = new Date();
  let tempDirectory: string | null = null;

  try {
    const settings = await prisma.backupSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    if (settings.target === "SMB") {
      if (!settings.smbHost || !settings.smbShare || !settings.smbUsername || !settings.smbPasswordEncrypted) {
        throw new Error("Die SMB-Konfiguration ist unvollständig");
      }
    } else if (!settings.localPath.startsWith("/")) {
      throw new Error("Der lokale Backup-Pfad muss absolut sein");
    }

    tempDirectory = await mkdtemp(join(tmpdir(), "invoice-erp-backup-"));
    const filename = backupFilename(startedAt);
    const dumpPath = join(tempDirectory, filename);
    await createDatabaseDump(dumpPath);

    const destination =
      settings.target === "SMB"
        ? await storeOnSmb(dumpPath, settings, filename, join(tempDirectory, "smb-auth.conf"))
        : await storeLocally(dumpPath, settings.localPath, filename);
    const size = (await stat(dumpPath)).size;

    await prisma.backupSettings.update({
      where: { id: "singleton" },
      data: {
        runningSince: null,
        lastRunAt: startedAt,
        lastSuccessAt: new Date(),
        lastError: null,
      },
    });
    return { filename, destination, size };
  } catch (error) {
    const message = errorMessage(error);
    await prisma.backupSettings.update({
      where: { id: "singleton" },
      data: { runningSince: null, lastRunAt: startedAt, lastError: message },
    }).catch(() => undefined);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, message);
  } finally {
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runBackup() {
  return executeBackup(false);
}

/** Reserviert und startet ein fälliges Backup. Die Reservierung verhindert Doppelstarts in mehreren Serverprozessen. */
export async function runDueBackup() {
  const settings = await getBackupSettings();
  const now = new Date();
  if (!settings.enabled || !settings.nextRun || settings.nextRun > now) return { ran: false as const };

  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const claimed = await prisma.backupSettings.updateMany({
    where: {
      id: "singleton",
      enabled: true,
      nextRun: { lte: now },
      OR: [{ runningSince: null }, { runningSince: { lt: staleBefore } }],
    },
    data: {
      nextRun: nextFutureRun(settings.nextRun, settings.interval, now),
      runningSince: now,
    },
  });
  if (claimed.count === 0) return { ran: false as const };

  const result = await executeBackup(true);
  return { ran: true as const, ...result };
}
