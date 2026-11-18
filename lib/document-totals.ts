import { Prisma } from "@/lib/generated/prisma/browser";

type LineAmounts = { quantity: number; unitPrice: number; taxRate: number };
type TaxableLine = { lineNet: number; taxRate: number };

const { Decimal } = Prisma;
type DecimalAmount = InstanceType<typeof Decimal>;
const round = (value: DecimalAmount) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function adjustedUnitPrice(
  unitPrice: number,
  adjustment: { priceAdjustmentType: "ABSOLUTE" | "PERCENTAGE"; priceAdjustmentValue: number; priceAdjustmentIsDiscount: boolean },
) {
  const base = new Decimal(unitPrice);
  const value = new Decimal(adjustment.priceAdjustmentValue);
  const amount = adjustment.priceAdjustmentType === "PERCENTAGE" ? base.times(value).dividedBy(100) : value;
  return round(Decimal.max(0, adjustment.priceAdjustmentIsDiscount ? base.minus(amount) : base.plus(amount))).toNumber();
}

export function calculateLineAmounts<T extends LineAmounts>(line: T) {
  const quantity = round(new Decimal(line.quantity));
  const unitPrice = round(new Decimal(line.unitPrice));
  return {
    ...line,
    quantity: quantity.toNumber(),
    unitPrice: unitPrice.toNumber(),
    lineNet: round(quantity.times(unitPrice)).toNumber(),
  };
}

export function calculateTaxBreakdown(lines: TaxableLine[]) {
  const byRate = new Map<number, DecimalAmount>();
  for (const { taxRate, lineNet } of lines) {
    if (taxRate > 0) byRate.set(taxRate, (byRate.get(taxRate) ?? new Decimal(0)).plus(lineNet));
  }
  return [...byRate.entries()].sort(([left], [right]) => right - left).map(([rate, net]) => ({
    rate,
    net: net.toNumber(),
    tax: round(net.times(rate).dividedBy(100)).toNumber() || 0,
  }));
}

export function calculateDocumentTotals<T extends LineAmounts>(input: T[], standard: boolean) {
  const lines = input.map((line) => calculateLineAmounts({ ...line, taxRate: standard ? line.taxRate : 0 }));
  const taxBreakdown = calculateTaxBreakdown(lines);
  const net = lines.reduce((sum, line) => sum.plus(line.lineNet), new Decimal(0));
  const tax = taxBreakdown.reduce((sum, group) => sum.plus(group.tax), new Decimal(0));
  return { lines, netTotal: net.toNumber(), taxTotal: tax.toNumber(), grossTotal: net.plus(tax).toNumber(), taxBreakdown };
}

export function matchesTaxTotal(breakdown: { tax: number }[], total: number) {
  return breakdown.reduce((sum, group) => sum.plus(group.tax), new Decimal(0)).equals(total);
}
