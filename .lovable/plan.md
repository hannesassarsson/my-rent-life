# Boendeplattformen – MVP

"Allt som rör ditt boende – på ett ställe."

En premium SaaS för bostadsrättsföreningar, hyresvärdar och förvaltare, med två upplevelser: **Boende** och **Administration**.

## Så här bygger jag i steg

### Steg 1 – Grund (denna omgång)
- Aktivera Lovable Cloud (databas, inloggning, filer, serverkod).
- Datamodell och roller (se teknisk del nedan), med strikt separation mellan organisationer.
- Realistisk demodata: BRF Solrosen, Storgatan 10–16, 184 lägenheter, boende, ärenden, bokningar, information, dokument, betalningar, möten, entreprenörer.
- Designsystem: neutral bas, en accentfärg, tydlig typografi, mjuka hörn, diskreta skuggor. Statusfärger: grön klart, gul pågående, röd akut, blå information.
- Publik startsida med hero, CTA "Boka demo" och sektioner för boende, styrelse, fastighetsägare.
- Inloggning med e-post och lösenord, samt demokonton för boende och administratör.

### Steg 2 – Boendeupplevelsen
- Översikt: hälsning, bostadskort, avgift/hyra, egna ärenden, nästa bokning, viktig information, kommande händelser.
- Mitt boende: alla uppgifter om bostaden + egna dokument.
- Felanmälan: guidat flöde (kategori, beskrivning, rum, akut, bilder) och ärendesida med tidslinje, kommentarer och "problemet kvarstår"/"löst".
- Bokningar: kalender med tidsluckor för tvättstuga, bastu, gästrum, festlokal, laddplats m.m.
- Information, Dokument, Möten (med anmälan), Ekonomi (avgift eller hyra beroende på boendeform), Meddelanden.

### Steg 3 – Administrationen
- Översikt med nyckeltal (lägenheter, ärenden, betalningsgrad, beläggning, opublicerat).
- Felanmälningar som tabell med status, prioritet, ansvarig; ärendevy där status, prioritet, ansvarig och entreprenör kan ändras.
- Fastigheter → byggnader → lägenheter → boende, boenderegister med detaljvy.
- Bokningsresurser med regler (öppettider, längd, max antal, avbokning, hur långt fram, vilka grupper).
- Kommunikation (riktad till alla, fastighet, byggnad eller enskilda lägenheter), Dokument, Ekonomi, Underhållsplan som tidslinje, Entreprenörer, Statistik med KPI-kort och enkla grafer, Inställningar.
- AI-panel "Vad behöver jag veta idag?" som listar det som kräver uppmärksamhet, byggd så att riktig AI kan kopplas in senare.

### Utanför MVP (förberett, inte byggt)
Juridiskt bindande digital röstning, betalningsintegration, och kopplingar till Google/Microsoft, Stripe, Fortnox, Visma, Twilio, BankID, Drive/OneDrive. Entreprenörsvyn byggs som en begränsad ärendelista i steg 3.

## Teknisk del

Roller: `super_admin`, `org_admin`, `property_manager`, `board_member`, `staff`, `contractor`, `resident` — i egen `user_roles`-tabell, aldrig på profilen.

Tabeller: `organizations`, `properties`, `buildings`, `units`, `profiles`, `user_roles`, `residencies` (boende ↔ lägenhet, ägd eller hyrd), `maintenance_requests`, `maintenance_events`, `maintenance_comments`, `resources`, `resource_slots`/`bookings`, `announcements` + målgruppsregler, `documents`, `meetings` + `meeting_attendance`, `payments`, `contractors`, `maintenance_projects`, `messages`, `notifications`.

Multi-tenancy: varje rad bär `organization_id`; radnivåsäkerhet via en `has_role`-funktion och en `is_org_member`-funktion, så data aldrig kan läcka mellan organisationer. Boende ser bara sin egen lägenhet och information riktad till den.

Frontend: TanStack Start-rutter delade i `/app` (boende) och `/admin`, delade UI-komponenter, all data via serverfunktioner med rollkontroll.
