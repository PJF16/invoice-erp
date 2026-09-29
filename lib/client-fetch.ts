/** Netzwerkfehler als normale API-Fehler behandeln, damit Formulare bedienbar bleiben.
 * Keine automatischen Wiederholungen: Eine abgebrochene Antwort kann bereits gebucht sein.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await globalThis.fetch(input, init);
    // JSON vollständig lesen, damit auch ein Verbindungsabbruch während der Antwort
    // nicht erst außerhalb der Fehlerbehandlung des Formulars auftritt.
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body = await response.text();
      JSON.parse(body);
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    return response;
  } catch {
    return Response.json({ error: "Die Serverantwort konnte nicht geladen werden. Bitte Verbindung prüfen und vor erneutem Speichern kontrollieren, ob der Vorgang bereits ausgeführt wurde." }, { status: 503 });
  }
}
