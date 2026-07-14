export const MODULES = ["STOCK", "INVOICES"] as const;
export type ModuleName = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  STOCK: "Lager",
  INVOICES: "Rechnungen",
};

export function hasModule(
  user: { role: "ADMIN" | "MEMBER"; modules: ModuleName[] },
  module: ModuleName,
) {
  return user.role === "ADMIN" || user.modules.includes(module);
}
