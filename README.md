# Home Haven

Bygg en komplett SaaS-plattform för boende och fastighetsadministration

Jag vill bygga en modern, premium och skalbar SaaS-plattform för bostadsrättsföreningar, hyresvärdar, fastighetsbolag och deras boende.

Arbetsnamn: Boendeplattformen

Tagline:
"Allt som rör ditt boende – på ett ställe."

Plattformen ska fungera för både:

Bostadsrättsföreningar – där användaren är medlem och betalar månadsavgift.

Hyresfastigheter – där användaren är hyresgäst och betalar hyra.

Fastighetsbolag/förvaltare – som administrerar en eller flera fastigheter och många boenden.

Bygg arkitekturen så att samma system kan hantera alla tre scenarierna.

1. DESIGN & KÄNSLA

Designen ska kännas som en blandning av:

modern fintech

premium SaaS

Apple

Linear

Stripe

moderna svenska bostadsappar

Undvik känslan av ett gammalt kommunalt/fastighetsadministrativt system.

Designprinciper:

minimalistiskt

mycket whitespace

tydlig typografi

mjuka hörn

subtila borders

diskreta shadows

eleganta cards

modern navigation

mycket tydlig hierarki

responsiv design

desktop-first men fullt fungerande på mobil

Använd inte för mycket färg.

Basera UI:t på neutrala färger med en tydlig accentfärg.

Status ska vara visuellt tydliga:

grön = klart/betalt

gul = pågående/väntar

röd = akut/problem

blå = information

Appen ska kännas dyr, trygg och professionell.

2. TVÅ HUVUDGRÄNSSNITT

Systemet ska ha två huvudsakliga upplevelser:

A. BOENDE

Detta är gränssnittet för hyresgästen eller bostadsrättsinnehavaren.

Navigation:

Översikt

Mitt boende

Felanmälan

Bokningar

Ekonomi

Information

Dokument

Möten

Meddelanden

B. ADMINISTRATION

Detta är gränssnittet för styrelse, fastighetsägare eller förvaltare.

Navigation:

Översikt

Fastigheter

Lägenheter

Boende

Felanmälningar

Bokningar

Kommunikation

Dokument

Ekonomi

Underhåll

Entreprenörer

Statistik

Inställningar

Rollbaserad åtkomst ska användas så att olika användare bara ser det de ska se.

3. BOENDESIDAN – DASHBOARD

Skapa en fantastisk dashboard.

Rubrik:

God kväll, [namn]

Visa användarens bostad:

Storgatan 12 · Lägenhet 3B

74 m² · 3 rum

Dashboarden ska innehålla cards för:

Min avgift/hyra

September

5 420 kr

Förfaller 30 september

Status:
Betald

För hyresgäster ska detta istället kunna visas som:

Hyra
8 420 kr

Förfallodatum:
30 september

Mina felanmälningar

Visa exempel:

Element i sovrum

🟡 Pågående

Senast uppdaterad:
Idag 14:32

Knapp:
Visa ärende

Nästa bokning

🧺 Tvättstuga 1

18:00–20:00

Idag

Knapp:
Visa bokningar

Viktig information

📢 Vattenavstängning torsdag

Visa kort sammanfattning och:
Läs mer

Kommande

📅 Föreningsstämma

24 september · 18:00

4. "MITT BOENDE"

Skapa en detaljerad sida för användarens bostad.

Visa:

adress

lägenhetsnummer

objektsnummer

storlek

antal rum

våning

inflyttningsdatum

förråd

parkering

balkong

antal registrerade nycklar/taggar

Sektion:

Mina dokument

Hyresavtal / upplåtelseavtal

Stadgar

Ordningsregler

Planritning

Energideklaration

Övriga dokument

Dokumenten ska vara klickbara och ha tydliga filikoner.

5. FELANMÄLAN

Bygg ett komplett felanmälningsflöde.

Knapp:

Ny felanmälan

Steg:

Vad gäller problemet?

Vatten

Värme

El

Dörr/lås

Vitvaror

Tvättstuga

Ventilation

Annat

Sedan:

Beskriv problemet

Textfält.

Möjlighet att:

ladda upp bilder

ladda upp video

ange rum

ange om problemet är akut

När användaren skickar skapas ett ärende.

Exempel:

Ärende #1827

Element i sovrum

Status:
🟡 Pågående

Timeline:

10 sep
Felanmälan skickad

10 sep
Ärendet mottaget

11 sep
Fastighetsskötare tilldelad

12 sep
Tid bokad

Användaren ska kunna:

se status

se kommentarer

svara

ladda upp ytterligare bilder

markera att problemet kvarstår

bekräfta att problemet är löst

6. BOKNINGAR

Bygg ett generellt bokningssystem.

Det ska inte bara vara för tvättstuga.

Systemet ska kunna hantera:

tvättstugor

bastu

gästrum

festlokal

hobbyrum

parkering

laddplatser

andra gemensamma resurser

Skapa:

Boka resurs

Visa kalender.

Exempel:

Tvättstuga 1

08–10 🔴 Bokad
10–12 🟢 Ledig
12–14 🟢 Ledig
14–16 🔴 Bokad

Klicka:

Boka 10–12

Visa bekräftelse.

Admin ska kunna konfigurera:

öppettider

bokningslängd

max antal bokningar

avbokningsregler

hur långt fram man får boka

vilka användargrupper som får boka

7. INFORMATION

Skapa en modern informationsfeed.

Admin ska kunna publicera:

nyheter

driftinformation

vattenavstängningar

underhåll

gårdsdagar

viktiga meddelanden

Varje inlägg ska kunna riktas till:

alla boende

specifik fastighet

specifikt hus

specifika lägenheter

Boende ska kunna se:

📢 Information från föreningen

Exempel:

"Vattenavstängning torsdag"

"Fasadrenovering börjar vecka 42"

"Höstens gårdsdag"

8. MÖTEN

Skapa en sida för:

föreningsstämma

årsmöten

informationsmöten

andra möten

Visa:

datum

tid

plats

agenda

dokument

motioner

protokoll

Boende ska kunna:

Anmäla deltagande

Efter mötet kan admin publicera protokoll.

Förbered arkitekturen för framtida digital röstning, men bygg inte juridiskt bindande digital röstning i första MVP-versionen.

9. EKONOMI

Skapa en ekonomi-sektion.

För BRF:

Min månadsavgift

5 420 kr

Förfallodatum:
30 september

Status:
🟢 Betald

Visa betalningshistorik:

September ✓
Augusti ✓
Juli ✓
Juni ✓

För hyresgäster ska motsvarande sida visa:

Min hyra

8 420 kr

Förfallodatum
30 september

Status
Betald

Arkitekturen ska förberedas för framtida integration med betalningssystem.

10. MEDDELANDEN

Skapa ett modernt meddelandesystem.

Boende ska kunna kommunicera med:

styrelse

förvaltare

fastighetsägare

administratör

Även meddelanden kopplade till specifika felanmälningar ska kunna finnas.

Exempel:

Ärende #1827

Fastighetsskötaren:
"Jag kommer förbi imorgon kl. 10."

Boende:
"Det fungerar bra."

11. ADMIN DASHBOARD

Skapa ett professionellt administratörsgränssnitt.

Rubrik:

Översikt

Visa:

184 lägenheter

179 aktiva

Felanmälningar

12 öppna
3 nya idag
1 akut

Ekonomi

97,8 % betalda avgifter/hyror

Bokningar

72 % beläggning

Kommunikation

2 opublicerade meddelanden

12. FELANMÄLNINGSADMIN

Admin ska kunna se alla ärenden.

Tabell:

Ärende
Lägenhet
Kategori
Prioritet
Status
Ansvarig
Skapad

Exempel:

#1832
3B
Värme
🔴 Akut
Pågående
Johan

Admin ska kunna:

öppna ärende

ändra status

ändra prioritet

tilldela ansvarig

kommentera

kontakta boende

lägga till entreprenör

ladda upp dokument

stänga ärendet

Status:

Nytt
Mottaget
Tilldelat
Bokat
Pågående
Löst
Stängt

13. ENTREPRENÖRER

Skapa ett entreprenörssystem.

Admin ska kunna lägga till:

företag

kontaktperson

telefon

e-post

kategori

avtal

dokument

Ett felärende kan tilldelas en entreprenör.

Exempel:

ABC VVS

Ärende #1832

Entreprenören ska kunna få ett eget begränsat gränssnitt där de kan:

acceptera ärende

kommentera

boka tid

ladda upp bilder

markera klart

14. FASTIGHETER

Admin ska kunna skapa en hierarki:

Organisation
↓
Fastighet
↓
Byggnad
↓
Lägenhet
↓
Boende

Exempel:

BRF Solrosen

Fastighet:
Storgatan 10–16

Byggnad A

Lägenhet 3B

Boende:
Hannes

Systemet måste stödja flera fastigheter inom samma organisation.

15. BOENDEREGISTER

Admin ska kunna se:

namn

lägenhet

kontaktuppgifter

inflyttningsdatum

status

roll

Klicka på en boende för att se:

Hannes
Storgatan 12, 3B

Kontaktuppgifter

Aktiva ärenden

Betalningsstatus

Bokningar

Dokument

16. UNDERHÅLLSPLAN

Skapa en sida för långsiktigt underhåll.

Exempel:

2026

🟢 Tak – klart

🟡 Fasad – pågår

🔵 Ventilation – planerad

2027

⚪ Fönster

⚪ Balkonger

Visa gärna en enkel tidslinje.

Boende ska kunna se relevant information men admin ska ha full kontroll.

17. STATISTIK

Skapa en dashboard för administration.

Visa exempelvis:

Felanmälningar

Totalt
124

Genomsnittlig lösningstid
2,4 dagar

Vanligaste kategorier:

Värme 31 %
Dörr/lås 18 %
Vatten 14 %
Tvättstuga 11 %

Bokningar

Beläggningsgrad

Tvättstuga 1
72 %

Tvättstuga 2
61 %

Ekonomi

Betalningsgrad

97,8 %

Designa detta snyggt med enkla grafer och KPI-cards.

18. AI – FÖRBERED SYSTEMET

AI ska finnas som en framtida central del av produkten.

Skapa en AI-assistent för admin:

"Vad behöver jag veta idag?"

Exempel:

5 saker behöver uppmärksamhet.

🔴 2 felanmälningar har väntat längre än 7 dagar.

🟡 3 avgifter är obetalda.

🟡 Fasadprojektet saknar uppdatering.

📅 Föreningsstämman är om 14 dagar.

Förbered även funktioner för:

sammanfatta felanmälningar

sammanfatta möten

skriva informationsmeddelanden

analysera återkommande problem

föreslå åtgärder

svara på frågor om fastigheten

söka i dokument

Bygg strukturen så att AI kan kopplas in senare utan att behöva göra om hela systemet.

19. MULTI-TENANT SAAS

Det här är extremt viktigt.

Systemet ska vara byggt som en riktig SaaS.

En organisation ska kunna ha:

flera fastigheter

flera byggnader

hundratals/tusentals lägenheter

många boende

flera administratörer

entreprenörer

Data mellan organisationer måste vara strikt separerad.

Roller:

Super Admin

Hanterar hela SaaS-plattformen.

Organization Admin

Hanterar sin organisation.

Property Manager

Hanterar fastigheter.

Board Member

Kan hantera föreningens information och ärenden.

Staff

Begränsad administrativ åtkomst.

Contractor

Ser tilldelade ärenden.

Resident

Ser endast sitt eget boende och relevant information.

20. DEMODATA

Skapa realistisk seed/demo-data så att appen ser levande ut direkt.

Organisation:

BRF Solrosen

184 lägenheter

Fastigheter:

Storgatan 10
Storgatan 12
Storgatan 14
Storgatan 16

Skapa exempel på:

boende

felanmälningar

bokningar

dokument

information

betalningar

möten

entreprenörer

Det ska kännas som ett riktigt system, inte en tom prototyp.

21. STARTSIDA / LANDING PAGE

Skapa även en publik landing page.

Hero:

Allt som rör ditt boende.

På ett ställe.

Underrubrik:

"En modern boendeplattform för bostadsrättsföreningar, fastighetsägare och hyresgäster."

CTA:

Boka demo

Sektioner:

För boende

För styrelsen

För fastighetsägaren

Felanmälan

Bokningar

Kommunikation

Ekonomi

Dokument

Statistik

AI

Visa en premium produktpresentation med screenshots/mockups från själva appen.

22. TEKNISK ARKITEKTUR

Använd Lovables rekommenderade moderna stack.

Prioritera:

säker autentisering

rollbaserad access

robust datamodell

multi-tenancy

responsiv frontend

komponentbaserat UI

återanvändbara komponenter

tydlig separation mellan resident/admin

skalbar databasstruktur

Skapa datamodeller för minst:

organizations
properties
buildings
units
users
residents
maintenance_requests
maintenance_comments
bookings
resources
announcements
documents
meetings
payments
contractors
maintenance_projects
notifications

Använd relationer mellan tabellerna istället för duplicerad information.

23. VIKTIGT – BYGG EN RIKTIG MVP

Första versionen ska vara fungerande, inte bara en statisk design.

Prioritera att följande fungerar:

Login

Roller

Boende-dashboard

Admin-dashboard

Felanmälan

Ärendehantering

Bokning

Information

Dokument

Boende/fastighet-struktur

Använd realistisk demo-data.

Gör UI:t extremt genomarbetat.

24. CONNECTORS – FÖRBERED, MEN ÖVERBYGG INTE

Systemet ska designas så att vi senare kan koppla exempelvis:

Google Calendar

Microsoft Calendar

Gmail

Stripe

Fortnox

Visma

Twilio

BankID

Google Drive

Microsoft OneDrive

Men bygg inte hela integrationerna innan kärnprodukten fungerar.

Vi kommer att lägga till connectors stegvis.

25. PRODUKTTÄNK

Detta ska inte kännas som ett traditionellt fastighetssystem.

Det ska kännas som:

"Min digitala plats för allt som rör mitt boende."

Och för administratören:

"Mitt operativsystem för fastigheten."

Bygg därför produkten med mycket hög designkvalitet.

Jag vill att du tänker som ett team bestående av:

senior SaaS-designer

senior frontendutvecklare

senior backendutvecklare

produktdesigner

UX-specialist

SaaS-produktchef

Innan du börjar bygga, skapa en tydlig intern struktur för datamodellen och användarrollerna så att vi inte bygger in teknisk skuld.

Börja sedan bygga MVP:n.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://my-rent-life.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3357f93a-80d5-482f-a6b1-128bfa16e0af).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
