# Produktgenomgång av den inloggade appen (september 2026)

Den här genomgången bygger på koden, databasens radregler och de fem demorollerna
(Boende, Förvaltare, Styrelse, Fastighetsskötare, Entreprenör).

## 1. Kartläggning

**Roller.** Det finns sju roller: superadmin, administratör, förvaltare, styrelseledamot,
fastighetsskötare, entreprenör och boende.

- Vad roll­erna får göra styrs av `permissions.ts` i appen och av radregler i databasen (RLS).
- Att vara boende är inte egentligen en roll. Det bestäms av att kontot är kopplat till en
  lägenhet i `residencies`.

**Datamodell.** Kedjan ser ut så här:

```
förening → fastighet → hus → lägenhet → boende (residencies) → konto (user_id)
```

- Flera `residencies` per lägenhet stöds redan, och varje rad har `is_primary`.
- Hushåll och sambo finns alltså i datamodellen, men det saknas i gränssnittet.

**Boendesidor (10 menyval).** Hem, Felanmälan, Bokningar, Ekonomi, Nycklar, Mitt boende,
Nyheter, Meddelanden, Dokument, Möten och Profil.

**Adminsidor (18 menyval).**

- Vanliga: Översikt, Ärenden, Meddelanden, Nyheter, Bokningar, Möten, Dokument, Boende,
  Fastigheter, Ekonomi, Inställningar, Abonnemang.
- Avancerade: Entreprenörer, Besiktningar, Underhållsplan, Passersystem, Integrationer.

## 2. Problem

### P0 – en viktig uppgift går inte att genomföra

| #    | Problem                                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **En ny boende kan inte få ett konto.** Egen registrering är avstängd, och inbjudningar finns inte. Därför kan en förening i praktiken inte ta in sina boende. |
| P0-2 | **Man kan inte lägga till en sambo eller hushållsmedlem.** "Registrera inflytt" visar bara lediga lägenheter.                                                  |
| P0-3 | **Det går inte att se vilka som bor i en lägenhet.** Det finns ingen lägenhetssida med boende, och lägenhetslistan går inte att klicka på.                     |
| P0-4 | **Man kan inte flytta en boende till en annan lägenhet eller byta vem som är primär boende.**                                                                  |

### P1 – stor förbättring

| #     | Problem                                                                                                                                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1  | **Tekniska felmeddelanden syns för användaren.** 55 ställen skickar databasens råa felmeddelande (ofta på engelska) direkt till en notis.                                                                                                                                                                      |
| P1-2  | **Ingen historik över administrativa ändringar.** Det går inte att se vem som flyttade eller bjöd in vem.                                                                                                                                                                                                      |
| P1-3  | **Föreningens kontaktuppgifter saknas.** Det finns ingen kontaktmejl, inget telefonnummer, inget journummer och ingen presentation, och boende hittar inte vem de ska ringa.                                                                                                                                   |
| P1-4  | **Inget välkomstmeddelande** och ingen introduktion för nya boende.                                                                                                                                                                                                                                            |
| P1-5  | **Boenderegistret saknar status.** Man kan inte se vem som är _inbjuden_, vem som _saknar konto_ och vem som _saknar lägenhet_, och man kan inte filtrera på det.                                                                                                                                              |
| P1-6  | **Det finns ingen sökning** i boendedelen, förutom i dokumentlistan.                                                                                                                                                                                                                                           |
| P1-7  | **Felanmälans status är svår att tolka.** Sju interna statusar (nytt, mottaget, tilldelat, bokat …) visas råa. Det behövs en enkel stegvisare: Mottagen → Påbörjad → Åtgärdas → Klar.                                                                                                                          |
| P1-8  | **Mitt boende visar inte hushållet** och inte heller föreningens kontaktuppgifter.                                                                                                                                                                                                                             |
| P1-9  | **Dokument är sorterade efter filtyp, inte efter hur viktiga de är.** Stadgar och ordningsregler ska ligga först, som i en föreningspärm.                                                                                                                                                                      |
| P1-10 | **Säkerhet: en boendepost kan kopplas till en lägenhet i en annan förening.** Radregeln kontrollerar bara att `organization_id` på raden är användarens egen, inte att lägenheten hör till samma förening. En illasinnad förvaltare skulle därmed kunna ge någon läsrätt till en lägenhet i en annan förening. |
| P1-11 | **Adminmenyn blandar register och inställningar.** "Fastigheter" och "Boende" är två separata ingångar till samma sak, och historik saknas.                                                                                                                                                                    |
| P1-12 | **Översiktens text "sammanställs av assistenten" är missvisande.** Uppgifterna räknas fram direkt från databasen, ingen AI är inblandad.                                                                                                                                                                       |

### P2 – polish och senare steg

- **AI-assistent ("Fråga om ditt boende").** Den kräver en språkmodellnyckel, och att
  dokumentens innehåll görs sökbart. Utan källor skulle svaren bli gissningar, så den bör
  vänta tills underlaget finns. Sökningen och hjälpsidan täcker behovet tills dess.
- **Import av boende från CSV.** Den blir relevant när en större förening ska läggas in.
- Utskick av inbjudan på **sms**.
- Adminlistorna som tabeller på mobil.
- Separat roll för **Superadmin** i gränssnittet (den finns redan i databasen).

## 3. Ny navigation

**Boende**

| Grupp       | Menyval                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| –           | Hem                                                                                 |
| Mitt boende | Felanmälan · Bokningar · Mitt boende (hushåll, nycklar, besiktningar) · Avgift/Hyra |
| Föreningen  | Nyheter · Meddelanden · Föreningspärmen · Möten                                     |
| Hjälp       | Sök och hjälp                                                                       |

"Nycklar" flyttas in under Mitt boende som en länk. Sidan finns kvar.

På mobilen finns en flikrad med **Hem, Felanmälan, Boka och Sök**, plus Meny.

**Admin**

| Grupp                 | Menyval                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| –                     | Översikt                                                                                   |
| Dagligt arbete        | Ärenden · Meddelanden · Nyheter till boende · Bokningar · Möten · Dokument                 |
| Lägenheter och boende | Lägenheter · Boende och konton · Ekonomi                                                   |
| Föreningen            | Föreningsinställningar · Användare och roller · Historik · Abonnemang                      |
| Fler verktyg          | Entreprenörer · Besiktningar · Underhållsplan · Passersystem · Integrationer · Fastigheter |

## 4. Lägenhet → boende → hushåll → konto

- **Lägenheten** är navet. Varje lägenhet har en egen sida som visar:
  - uppgifter om lägenheten
  - hushållet
  - inbjudningar
  - historik
- **Boende** (`residencies`) är personer som bor i lägenheten:
  - Exakt en av dem är _primär boende_. Övriga är _hushållsmedlemmar_, till exempel en sambo.
  - Utflyttade personer finns kvar som historik med status `moved_out`.
- **Konto** (`user_id`) är valfritt. En boende utan konto syns ändå i registret, med
  statusen _Inget konto_.
- **Flytt till annan lägenhet** avslutar boendet i den gamla lägenheten och skapar ett nytt i
  den nya. Kontot följer med, så att historiken blir rätt.
- **Primär boende** kan bytas. Då blir de övriga i hushållet automatiskt hushållsmedlemmar.

## 5. Inbjudningsflödet

1. **Admin skapar inbjudan.** Det görs på lägenhetssidan, antingen för en person som redan
   finns i hushållet eller för en ny person.
2. **Servern skapar länken.**
   - Länken innehåller en slumpad token på 256 bitar. Bara tokenens hash sparas i databasen.
   - Länken gäller i 14 dagar och kan användas en gång.
3. **Admin delar länken.**
   - Länken visas en gång och kan kopieras. Den kan också skickas direkt med e-post (Resend).
   - Behövs länken igen skapar admin en ny, och den gamla spärras då automatiskt.
4. **Den boende öppnar `/invite/<token>`.** Sidan visar vilken förening, adress och lägenhet
   inbjudan gäller.
5. **Den boende skapar ett konto** med namn, e-post och lösenord. Har personen redan ett konto
   loggar hen in i stället.
6. **Servern tar emot inbjudan i en databasfunktion.** Funktionen:
   - kontrollerar att inbjudan varken är använd, spärrad eller för gammal
   - kopplar kontot till föreningen och lägenheten
   - ger kontot rollen boende
   - markerar inbjudan som använd
   - skriver en rad i historiken
7. **Välkomstmeddelandet visas,** och därefter kommer den boende till sin startsida.

Säkerheten bygger på följande:

- Lägenhets-id i webbadressen ger ingen behörighet. Bara tokenen gör det.
- All kontroll sker på servern och i databasen.
- Ett konto som redan tillhör en annan förening kan inte ta emot inbjudan.

## 6. Välkomstmeddelandet

- Administratören skriver meddelandet i Föreningsinställningar. Det finns en förhandsvisning
  och det behövs ingen HTML.
- Variabler som kan användas: `{föreningsnamn}`, `{adress}`, `{lägenhetsnummer}` och
  `{boendes_namn}`.
- Meddelandet visas:
  - på inbjudningssidan när kontot har skapats
  - som en panel på startsidan tills den boende stänger den

## 7. Förenkla och slå ihop

- "Fastigheter" och "Boende" blir **Lägenheter** och **Boende och konton**. Varje lägenhet
  länkar till sin egen sida, där allt om hushållet finns samlat.
- "Registrera inflytt" och "Lägg till sambo" blir samma dialog, "Lägg till boende". Den
  fungerar för både lediga och bebodda lägenheter.
- Organisationsinställningarna delas upp i två sidor:
  - **Föreningsinställningar:** namn, kontakt, välkomstmeddelande.
  - **Användare och roller.**
- "Nycklar" flyttas in under Mitt boende.

## 8. Nya funktioner som är motiverade

| Funktion                                            | Motivering                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Inbjudningar per lägenhet                           | Nödvändig, eftersom det är enda vägen in för en ny boende (P0-1).                                                        |
| Hushåll: lägg till, primär boende, flytta           | Datamodellen stöder det redan. Det som saknas är gränssnittet.                                                           |
| Historik (audit log)                                | Gör det möjligt att spåra vem som gjort vad. Loggen skrivs av databasen själv, så den går inte att förfalska från appen. |
| Föreningens kontaktuppgifter och välkomstmeddelande | Minskar antalet samtal till styrelsen.                                                                                   |
| Sök och hjälp                                       | Ett ställe där man hittar allt, och där en AI kan kopplas in senare.                                                     |

Följande byggs **inte** nu:

- AI-chatt utan källor
- import från CSV
- nya roller
