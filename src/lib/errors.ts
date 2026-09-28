// Felmeddelanden som användaren förstår. Databasens och bibliotekens
// tekniska fel (ofta på engelska) visas aldrig direkt; de loggas på servern
// och ersätts med en begriplig text.

type DbError = { code?: string; message: string };

const SAVE_FAILED = "Vi kunde inte spara ändringen. Försök igen om en stund.";

/**
 * Översätter ett fel från databasen. Egna regelbrott (P0001) har redan en
 * svensk text skriven för användaren och skickas vidare som de är.
 */
export function dbError(error: DbError, fallback = SAVE_FAILED): Error {
  switch (error.code) {
    case "P0001":
      return new Error(error.message);
    case "23505":
      return new Error("Uppgiften finns redan.");
    case "23503":
      return new Error("Det du försöker koppla till finns inte längre. Ladda om sidan.");
    case "23514":
    case "22001":
    case "22P02":
      return new Error("Någon uppgift är för lång eller har fel format. Kontrollera formuläret.");
    case "42501":
      return new Error("Du har inte behörighet att göra det här.");
  }
  if (/row-level security/i.test(error.message)) {
    return new Error("Du har inte behörighet att göra det här.");
  }
  console.error(`Databasfel${error.code ? ` ${error.code}` : ""}: ${error.message}`);
  return new Error(fallback);
}

/** Text att visa i en notis för ett fel som fångats i gränssnittet. */
export function errorMessage(error: unknown, fallback = "Något gick fel. Försök igen."): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return fallback;
  if (
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message)
  ) {
    return "Vi fick ingen kontakt med servern. Kontrollera din internetanslutning och försök igen.";
  }
  if (/invalid login credentials/i.test(message)) return "Fel e-postadress eller lösenord.";
  if (/email not confirmed/i.test(message)) {
    return "E-postadressen är inte bekräftad ännu. Följ länken i mejlet vi skickade.";
  }
  if (/unauthorized|jwt expired|invalid token|refresh token/i.test(message)) {
    return "Du har blivit utloggad. Logga in igen.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "För många försök på kort tid. Vänta en stund och försök igen.";
  }
  // Valideringsfel från servern kommer som en JSON-lista.
  if (message.trim().startsWith("[") || /^validation/i.test(message)) {
    return "Någon uppgift saknas eller har fel format. Kontrollera formuläret.";
  }
  if (/timeout|timed out/i.test(message)) {
    return "Det tog för lång tid. Kontrollera din internetanslutning och försök igen.";
  }
  return message;
}
