export type VatCheckResult = {
  countryCode: string;
  vatNumber: string;
  status: "VALID" | "INVALID" | "UNAVAILABLE" | "ERROR";
  requestDate: Date | null;
  name: string | null;
  address: string | null;
  requestId: string | null;
  errorMessage: string | null;
};

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlValue(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;",
  })[char]!);
}

export function normalizeVatId(uid: string, fallbackCountryCode?: string) {
  const compact = uid.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = compact.match(/^([A-Z]{2})(.+)$/);
  const rawCountryCode = prefix?.[1] ?? fallbackCountryCode?.toUpperCase() ?? "";
  const countryCode = rawCountryCode === "GR" ? "EL" : rawCountryCode;
  const vatNumber = prefix?.[2] ?? compact;
  return { countryCode, vatNumber };
}

export async function checkVatId(uid: string, fallbackCountryCode?: string): Promise<VatCheckResult> {
  const { countryCode, vatNumber } = normalizeVatId(uid, fallbackCountryCode);
  if (!/^[A-Z]{2}$/.test(countryCode) || !vatNumber) {
    return {
      countryCode,
      vatNumber,
      status: "ERROR",
      requestDate: null,
      name: null,
      address: null,
      requestId: null,
      errorMessage: "UID und zweistelliger Ländercode sind erforderlich.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/><soapenv:Body><urn:checkVat>
    <urn:countryCode>${escapeXml(countryCode)}</urn:countryCode>
    <urn:vatNumber>${escapeXml(vatNumber)}</urn:vatNumber>
  </urn:checkVat></soapenv:Body>
</soapenv:Envelope>`;

  try {
    const response = await fetch(
      "https://ec.europa.eu/taxation_customs/vies/services/checkVatService",
      {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
        body: envelope,
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const xml = await response.text();
    if (!response.ok) throw new Error(`VIES antwortete mit HTTP ${response.status}`);

    const fault = xmlValue(xml, "faultstring");
    if (fault) {
      const unavailable = /SERVICE_UNAVAILABLE|MS_UNAVAILABLE|TIMEOUT|SERVER_BUSY/i.test(fault);
      return {
        countryCode,
        vatNumber,
        status: unavailable ? "UNAVAILABLE" : "ERROR",
        requestDate: null,
        name: null,
        address: null,
        requestId: null,
        errorMessage: fault,
      };
    }

    const valid = xmlValue(xml, "valid");
    if (valid !== "true" && valid !== "false") throw new Error("VIES-Antwort konnte nicht gelesen werden");
    const requestDateText = xmlValue(xml, "requestDate");
    return {
      countryCode,
      vatNumber,
      status: valid === "true" ? "VALID" : "INVALID",
      requestDate: requestDateText ? new Date(`${requestDateText}T00:00:00.000Z`) : null,
      name: xmlValue(xml, "name")?.replace(/^---$/, "") || null,
      address: xmlValue(xml, "address")?.replace(/^---$/, "") || null,
      requestId: xmlValue(xml, "requestIdentifier"),
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.name === "AbortError" ? "Zeitüberschreitung bei der VIES-Abfrage" : error.message
      : "VIES-Abfrage fehlgeschlagen";
    return {
      countryCode,
      vatNumber,
      status: "UNAVAILABLE",
      requestDate: null,
      name: null,
      address: null,
      requestId: null,
      errorMessage: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

