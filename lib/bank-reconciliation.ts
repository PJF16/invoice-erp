import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { openAmount, recordPayment, skontoAmount, skontoDeadline } from "@/lib/payments";

const MAX_CSV_ROWS = 10_000;
const cents = (value: number) => Math.round(value * 100);

export type ParsedBankTransaction = {
  bookingDate: Date;
  valueDate: Date;
  amount: number;
  currency: string;
  description: string;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  paymentReference: string | null;
  sourceReference: string | null;
  sourceRow: number;
};

export type MatchCandidate = {
  id: string;
  number: string | null;
  customerName: string;
  issueDate: Date;
  dueDate: Date;
  grossTotal: number;
  paidTotal: number;
  skontoGranted: number;
  skontoPercent: number;
  skontoDays: number;
};

export type MatchSuggestion = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  openAmount: number;
  score: number;
  confidence: "AUTO" | "SUGGESTION";
  reasons: string[];
  grantSkonto: boolean;
};

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      if (rows.length > MAX_CSV_ROWS) throw new ApiError(400, `Die CSV darf höchstens ${MAX_CSV_ROWS} Zeilen enthalten`);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new ApiError(400, "Die CSV enthält ein nicht geschlossenes Anführungszeichen");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function parseElbaDate(value: string, row: number): Date {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) throw new ApiError(400, `Ungültiges Datum in CSV-Zeile ${row}`);
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new ApiError(400, `Ungültiges Datum in CSV-Zeile ${row}`);
  }
  return date;
}

function extract(description: string, label: string, followingLabels: string[]) {
  const end = followingLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*?)(?=\\s+(?:${end}):|$)`, "i");
  return description.match(pattern)?.[1]?.trim() || null;
}

function parseGermanAmount(value: string, row: number) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new ApiError(400, `Ungültiger Betrag in CSV-Zeile ${row}`);
  return Math.round(amount * 100) / 100;
}

export function parseElbaCsv(input: string): ParsedBankTransaction[] {
  const clean = input.replace(/^\uFEFF/, "");
  return parseCsvRows(clean).map((columns, index) => {
    const sourceRow = index + 1;
    if (columns.length !== 6) {
      throw new ApiError(400, `CSV-Zeile ${sourceRow} hat ${columns.length} statt 6 Spalten`);
    }
    const [bookingDate, description, valueDate, rawAmount, rawCurrency, sourceReference] = columns;
    const counterpartyName = extract(description, "Auftraggeber", [
      "Zahlungsreferenz", "Verwendungszweck", "IBAN Auftraggeber", "BIC Auftraggeber", "Auftraggeberreferenz",
    ]);
    const counterpartyIban = extract(description, "IBAN Auftraggeber", ["BIC Auftraggeber", "Auftraggeberreferenz"]);
    const paymentReference =
      extract(description, "Zahlungsreferenz", ["IBAN Auftraggeber", "BIC Auftraggeber", "Auftraggeberreferenz"]) ??
      extract(description, "Verwendungszweck", ["IBAN Auftraggeber", "BIC Auftraggeber", "Auftraggeberreferenz"]);

    return {
      bookingDate: parseElbaDate(bookingDate, sourceRow),
      valueDate: parseElbaDate(valueDate, sourceRow),
      amount: parseGermanAmount(rawAmount, sourceRow),
      currency: rawCurrency.trim().toUpperCase(),
      description: description.trim(),
      counterpartyName,
      counterpartyIban,
      paymentReference,
      sourceReference: sourceReference.trim() || null,
      sourceRow,
    };
  });
}

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hasInvoiceReference(description: string, invoiceNumber: string) {
  const characters = normalized(invoiceNumber).split("");
  if (characters.length < 4) return false;
  const flexibleNumber = characters.join("[^A-Z0-9]*");
  return new RegExp(`(?:^|[^A-Z0-9])${flexibleNumber}(?![A-Z0-9])`, "i").test(description);
}

function nameSimilarity(left: string | null, right: string) {
  if (!left) return 0;
  const tokens = (value: string) => new Set(
    value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/)
      .filter((token) => token.length >= 3 && !["GMBH", "AG", "KG", "EINZELUNTERNEHMEN"].includes(token)),
  );
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const common = [...a].filter((token) => b.has(token)).length;
  return common / Math.max(a.size, b.size);
}

export function suggestMatches(
  transaction: Pick<ParsedBankTransaction, "amount" | "bookingDate" | "description" | "counterpartyName">,
  invoices: MatchCandidate[],
): MatchSuggestion[] {
  if (transaction.amount <= 0) return [];
  return invoices.flatMap((invoice): MatchSuggestion[] => {
    if (!invoice.number) return [];
    const open = openAmount(invoice);
    if (open <= 0) return [];
    const exactReference = hasInvoiceReference(transaction.description, invoice.number);
    const exactAmount = cents(transaction.amount) === cents(open);
    const partialAmount = transaction.amount > 0 && cents(transaction.amount) < cents(open);
    const deadline = skontoDeadline(invoice);
    const discounted = Math.round((Number(invoice.grossTotal) - skontoAmount(invoice) - Number(invoice.paidTotal)) * 100) / 100;
    const skontoMatch =
      invoice.skontoGranted === 0 &&
      deadline !== null &&
      transaction.bookingDate.getTime() < deadline.getTime() + 86_400_000 &&
      cents(transaction.amount) === cents(discounted);
    const similarity = nameSimilarity(transaction.counterpartyName, invoice.customerName);
    const plausibleDate = transaction.bookingDate >= new Date(invoice.issueDate.getTime() - 3 * 86_400_000);
    const overpayment = cents(transaction.amount) > cents(open);
    let score = 0;
    const reasons: string[] = [];

    if (exactReference) {
      score += 65;
      reasons.push("Rechnungsnummer im Buchungstext");
    }
    if (exactAmount) {
      score += 30;
      reasons.push("Betrag entspricht dem offenen Betrag");
    } else if (skontoMatch) {
      score += 27;
      reasons.push("Betrag entspricht dem fristgerechten Skontobetrag");
    } else if (partialAmount) {
      score += 12;
      reasons.push("Betrag ist als Teilzahlung möglich");
    }
    if (similarity >= 0.65) {
      score += 20;
      reasons.push("Auftraggeber passt zum Kunden");
    } else if (similarity >= 0.4) {
      score += 10;
      reasons.push("Auftraggeber ähnelt dem Kunden");
    }
    if (plausibleDate) score += 5;
    if (overpayment) score -= 25;
    if (score < 35) return [];

    const automatic = exactReference && !overpayment && (exactAmount || partialAmount || skontoMatch);
    return [{
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      openAmount: open,
      score: Math.max(0, Math.min(100, score)),
      confidence: automatic ? "AUTO" : "SUGGESTION",
      reasons,
      grantSkonto: skontoMatch,
    }];
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function fingerprint(accountIban: string | null, transaction: ParsedBankTransaction) {
  return createHash("sha256").update([
    accountIban ?? "",
    transaction.bookingDate.toISOString(),
    transaction.valueDate.toISOString(),
    transaction.amount.toFixed(2),
    transaction.currency,
    transaction.description,
    transaction.sourceReference ?? "",
  ].join("\u001f")).digest("hex");
}

function invoiceCandidates() {
  return prisma.invoice.findMany({
    where: { type: "INVOICE", number: { not: null }, status: { in: ["OPEN", "SENT"] } },
    select: {
      id: true, number: true, customerName: true, issueDate: true, dueDate: true,
      grossTotal: true, paidTotal: true, skontoGranted: true, skontoPercent: true, skontoDays: true,
    },
  });
}

function toCandidate(invoice: Awaited<ReturnType<typeof invoiceCandidates>>[number]): MatchCandidate {
  return {
    ...invoice,
    grossTotal: Number(invoice.grossTotal),
    paidTotal: Number(invoice.paidTotal),
    skontoGranted: Number(invoice.skontoGranted),
  };
}

export async function importElbaCsv(text: string, filename: string, userId: string, configuredIban?: string) {
  const parsed = parseElbaCsv(text);
  const incoming = parsed.filter((row) => row.amount > 0);
  const filenameIban = filename.toUpperCase().match(/AT\d{18}/)?.[0] ?? null;
  const accountIban = filenameIban ?? configuredIban?.replace(/\s/g, "").toUpperCase() ?? null;
  const prepared = incoming.map((transaction) => ({ transaction, fingerprint: fingerprint(accountIban, transaction) }));
  const existing = await prisma.bankTransaction.findMany({
    where: { fingerprint: { in: prepared.map((item) => item.fingerprint) } },
    select: { fingerprint: true },
  });
  const existingSet = new Set(existing.map((item) => item.fingerprint));
  const fresh = prepared.filter((item) => !existingSet.has(item.fingerprint));

  if (fresh.length > 0) {
    await prisma.bankTransaction.createMany({
      data: fresh.map(({ transaction, fingerprint: value }) => ({
        fingerprint: value,
        accountIban,
        bookingDate: transaction.bookingDate,
        valueDate: transaction.valueDate,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        counterpartyName: transaction.counterpartyName,
        counterpartyIban: transaction.counterpartyIban,
        paymentReference: transaction.paymentReference,
        sourceReference: transaction.sourceReference,
        sourceRow: transaction.sourceRow,
        importedById: userId,
      })),
      skipDuplicates: true,
    });
  }

  const created = await prisma.bankTransaction.findMany({
    where: { fingerprint: { in: fresh.map((item) => item.fingerprint) } },
    orderBy: { bookingDate: "asc" },
  });
  let automaticMatches = 0;
  for (const transaction of created) {
    if (transaction.currency !== "EUR") continue;
    const candidates = (await invoiceCandidates()).map(toCandidate);
    const suggestions = suggestMatches({
      amount: Number(transaction.amount),
      bookingDate: transaction.bookingDate,
      description: transaction.description,
      counterpartyName: transaction.counterpartyName,
    }, candidates);
    const best = suggestions[0];
    if (best?.confidence === "AUTO" && suggestions.filter((item) => item.confidence === "AUTO").length === 1) {
      await reconcileBankTransaction(transaction.id, best.invoiceId, userId, best.grantSkonto);
      automaticMatches += 1;
    }
  }

  const unresolved = await prisma.bankTransaction.count({
    where: { fingerprint: { in: fresh.map((item) => item.fingerprint) }, payment: null, ignoredAt: null },
  });
  return {
    parsedRows: parsed.length,
    incomingRows: incoming.length,
    importedRows: fresh.length,
    duplicateRows: incoming.length - fresh.length,
    automaticMatches,
    unresolved,
  };
}

export async function reconcileBankTransaction(
  bankTransactionId: string,
  invoiceId: string,
  userId: string,
  grantSkonto = false,
) {
  const transaction = await prisma.bankTransaction.findUnique({
    where: { id: bankTransactionId },
    include: { payment: { select: { id: true } } },
  });
  if (!transaction) throw new ApiError(404, "Bankumsatz nicht gefunden");
  if (transaction.payment) throw new ApiError(409, "Bankumsatz wurde bereits zugeordnet");
  if (transaction.amount.toNumber() <= 0) throw new ApiError(400, "Nur Zahlungseingänge können zugeordnet werden");
  if (transaction.currency !== "EUR") throw new ApiError(400, "Derzeit können nur EUR-Zahlungen zugeordnet werden");
  return recordPayment(invoiceId, {
    amount: Number(transaction.amount),
    date: transaction.bookingDate,
    method: "BANK_TRANSFER",
    reference: transaction.paymentReference ?? transaction.description.slice(0, 500),
    note: "Aus ELBA-CSV abgeglichen",
    grantSkonto,
    bankTransactionId,
  }, userId);
}

export async function ignoreBankTransaction(id: string) {
  const transaction = await prisma.bankTransaction.findUnique({ where: { id }, include: { payment: true } });
  if (!transaction) throw new ApiError(404, "Bankumsatz nicht gefunden");
  if (transaction.payment) throw new ApiError(409, "Ein bereits zugeordneter Umsatz kann nicht ignoriert werden");
  return prisma.bankTransaction.update({ where: { id }, data: { ignoredAt: new Date() } });
}

export async function reopenBankTransaction(id: string) {
  return prisma.bankTransaction.update({ where: { id }, data: { ignoredAt: null } });
}

export async function getReconciliationData() {
  const [unresolvedTransactions, completedTransactions, invoices] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { payment: null, ignoredAt: null },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { payment: { include: { invoice: { select: { id: true, number: true, customerName: true } } } } },
    }),
    prisma.bankTransaction.findMany({
      where: { OR: [{ payment: { isNot: null } }, { ignoredAt: { not: null } }] },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { payment: { include: { invoice: { select: { id: true, number: true, customerName: true } } } } },
    }),
    invoiceCandidates(),
  ]);
  const transactions = [...unresolvedTransactions, ...completedTransactions];
  const candidates = invoices.map(toCandidate);
  return {
    invoices: candidates.map((invoice) => ({
      id: invoice.id,
      number: invoice.number!,
      customerName: invoice.customerName,
      openAmount: openAmount(invoice),
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      bookingDate: transaction.bookingDate.toISOString(),
      amount: Number(transaction.amount),
      currency: transaction.currency,
      description: transaction.description,
      counterpartyName: transaction.counterpartyName,
      counterpartyIban: transaction.counterpartyIban,
      paymentReference: transaction.paymentReference,
      ignoredAt: transaction.ignoredAt?.toISOString() ?? null,
      payment: transaction.payment ? {
        id: transaction.payment.id,
        invoiceId: transaction.payment.invoice.id,
        invoiceNumber: transaction.payment.invoice.number,
        customerName: transaction.payment.invoice.customerName,
      } : null,
      suggestions: transaction.payment || transaction.ignoredAt ? [] : suggestMatches({
        amount: Number(transaction.amount),
        bookingDate: transaction.bookingDate,
        description: transaction.description,
        counterpartyName: transaction.counterpartyName,
      }, candidates),
    })),
  };
}
