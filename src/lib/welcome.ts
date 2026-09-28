// Välkomstmeddelandet till nya boende. Standardtexten visas alltid;
// föreningen kan lägga till en egen hälsning under Föreningsinställningar.
// Variabler skrivs inom klammerparenteser och ersätts när texten visas.

export type WelcomeVars = {
  föreningsnamn: string;
  adress: string;
  lägenhetsnummer: string;
  boendes_namn: string;
};

export const WELCOME_VARIABLES: { key: keyof WelcomeVars; description: string }[] = [
  { key: "föreningsnamn", description: "Föreningens namn" },
  { key: "adress", description: "Den boendes adress" },
  { key: "lägenhetsnummer", description: "Den boendes lägenhetsnummer" },
  { key: "boendes_namn", description: "Den boendes namn" },
];

export const WELCOME_TITLE = "Välkommen till {föreningsnamn}!";

export const WELCOME_INTRO =
  "Du är nu ansluten till {adress}, lägenhet {lägenhetsnummer}.\n\n" +
  "Här hittar du information om ditt boende, bokningar, felanmälningar, dokument och meddelanden från föreningen.";

export const WELCOME_EXAMPLE =
  "Vi hoppas att du ska trivas! Har du frågor är du välkommen att kontakta styrelsen.";

export function fillWelcome(template: string, vars: WelcomeVars) {
  return template.replace(/\{([a-zåäö_]+)\}/gi, (match, key: string) => {
    const value = vars[key.toLowerCase() as keyof WelcomeVars];
    return value === undefined ? match : value;
  });
}

/** Rubrik, standardtext och föreningens egen hälsning med variablerna ifyllda. */
export function renderWelcome(custom: string | null | undefined, vars: WelcomeVars) {
  return {
    title: fillWelcome(WELCOME_TITLE, vars),
    intro: fillWelcome(WELCOME_INTRO, vars),
    custom: custom?.trim() ? fillWelcome(custom.trim(), vars) : null,
  };
}
