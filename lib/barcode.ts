// Generiert einen internen Barcode für gebrauchte Geräte ohne Schachtel/Originalbarcode.
// Präfix "20" folgt der GS1-Konvention für den innerbetrieblichen Gebrauch.
export function generateInternalBarcode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0];
  return `20${n.toString().padStart(10, "0")}`;
}
