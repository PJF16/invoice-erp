"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
const sections = [["company", "Firma"], ["bank", "Bank"], ["documents", "Belege"], ["mail", "E-Mail-Vorlagen"], ["reminders", "Mahnwesen"], ["smtp", "SMTP"], ["backup", "Backups"]] as const;
const SettingsContext = createContext<{ section: string; selectSection: (section: string) => void }>({ section: "company", selectSection: () => {} });
export const useSettingsSection = () => useContext(SettingsContext);

export function SettingsWorkspace({ general, smtp, backup }: { general: ReactNode; smtp: ReactNode; backup: ReactNode }) {
  const [section, selectSection] = useState("company");
  const id = useId();
  return <SettingsContext.Provider value={{ section, selectSection }}>
    <div role="tablist" aria-label="Einstellungsbereiche" className="mb-5 flex flex-wrap gap-2">
      {sections.map(([key, label], index) => <button key={key} id={`${id}-${key}-tab`} type="button" role="tab" aria-selected={section === key} aria-controls={`${id}-panel`} tabIndex={section === key ? 0 : -1}
        onClick={() => selectSection(key)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); selectSection(sections[next][0]); document.getElementById(`${id}-${sections[next][0]}-tab`)?.focus(); }
        }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${section === key ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>{label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${section}-tab`}>
      <div hidden={section === "smtp" || section === "backup"}>{general}</div>
      <div hidden={section !== "smtp"}>{smtp}</div>
      <div hidden={section !== "backup"}>{backup}</div>
    </div>
  </SettingsContext.Provider>;
}
