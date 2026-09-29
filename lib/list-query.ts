import { normalizeDateInput } from "@/lib/localized-input";

export type ListParams = { q?: string; from?: string; to?: string; sort?: string; page?: string; status?: string; kunde?: string; lager?: string; typ?: string };
export const PAGE_SIZE = 50;
export function readListQuery(params: ListParams) {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const q = text(params.q);
  const from = normalizeDateInput(text(params.from));
  const to = normalizeDateInput(text(params.to));
  const end = to ? new Date(to) : undefined;
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  const pageValue = Number(params.page);
  const requestedPage = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const sort = ["date_desc", "date_asc", "number", "amount_desc"].includes(text(params.sort)) ? text(params.sort) : "date_desc";
  return {
    q, from: from ?? "", to: to ?? "", sort,
    dateRange: from || end ? { ...(from ? { gte: new Date(from) } : {}), ...(end ? { lt: end } : {}) } : undefined,
    pagination(total: number) {
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(requestedPage, pages);
      return { page, pages, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, total };
    },
  };
}
