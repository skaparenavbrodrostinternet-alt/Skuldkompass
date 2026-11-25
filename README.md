# Skuldkompass

Skuldkompass är ett svenskt lärprojekt med en interaktiv kalkylator som jämför snöboll, lavin, enbart minimibelopp och **Frihetsandelen**. Frihetsandelen följer lavinordningen och låter användaren välja hur stor procentandel av varje frigjort minimibelopp som ska gå vidare respektive användas till annat.

## Kör lokalt

Kräver Node.js 18 eller senare. I projektmappen:

```text
npm run dev
```

Öppna adressen som visas i terminalen. Projektet använder inga externa npm-paket.

## Publicera gratis med GitHub Pages

Webbplatsen kan publiceras utan terminal, betalning eller egen server. GitHub Pages visar HTML-, CSS- och JavaScript-filerna direkt från ett GitHub-repository. För gratis GitHub-konton måste repot vara offentligt.

### Första publiceringen, utan terminal

1. Skapa ett konto på [GitHub](https://github.com/) om du inte redan har ett. Ditt användarnamn blir en del av webbplatsens adress.
2. När du är inloggad väljer du **New repository**. Skriv `skuldkompass` som namn, välj **Public** och skapa repot tomt. Kryssa inte i rutorna som lägger till en README, licens eller `.gitignore`.
3. Öppna det nya repot och välj **Add file → Upload files**. Välj projektfilerna i den här mappen: `index.html`, `app.js`, `styles.css`, `README.md`, `package.json`, `server.mjs` och `.gitignore`. Ladda inte upp mappen `.git`.
4. Under **Commit changes** skriver du exempelvis `Lägg till Skuldkompass` och väljer att committa direkt till `main`. Klicka på **Commit changes**. Det sparar filerna i versionshistoriken på GitHub.
5. I repot öppnar du **Settings → Pages**. Under **Build and deployment** väljer du **Deploy from a branch**. Välj branchen `main`, mappen `/(root)` och klicka **Save**.
6. Vänta på att GitHub publicerar sidan. Länken visas i **Settings → Pages**. Den brukar se ut så här: `https://DITT-GITHUBNAMN.github.io/skuldkompass/`. Byt ut `DITT-GITHUBNAMN` mot ditt faktiska GitHub-användarnamn.
7. Öppna länken och kontrollera sidan på dator och mobil. Använd bara påhittade testuppgifter. Inmatade skulduppgifter nollställs när sidan laddas om.

### När du vill uppdatera sidan

Ladda upp den eller de ändrade filerna igen via **Add file → Upload files**. GitHub visar att filen redan finns; fortsätt med uppladdningen och committa ändringen till `main`. GitHub Pages publicerar sedan den nya versionen. GitHub sparar ändringarna som commits, så du får en versionshistorik även om du använder webbläsaren i stället för terminalen.

Repo och webbplats blir offentliga. Publicera aldrig riktiga personuppgifter, lösenord eller kunddata där. Kalkylatorn skickar inte de inmatade skuldvärdena, men webbhotellet kan behandla tekniska besöksuppgifter; [GitHub Pages loggar besökares IP-adresser av säkerhetsskäl](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). `server.mjs` behövs bara för lokal förhandsvisning och körs inte på GitHub Pages.

Följ [GitHubs introduktion till Pages](https://docs.github.com/en/pages/quickstart), [instruktionerna för uppladdning av filer](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) och [hur en branch publiceras](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Beräkningsmodell och gränser

- Ränta anges som årsränta och kalkylen lägger till saldo × årsränta / 12 varje månad.
- Ränta läggs till före månadsbetalningen. Minsta månadsbelopp behandlas som fasta och extra amortering läggs ovanpå dem.
- Snöboll prioriterar lägsta saldo. Lavin och Frihetsandelen prioriterar högsta ränta. Vid 0 % uttag följer Frihetsandelen samma beräkningsordning som lavinen.
- Resultaten är uppskattningar. Avgifter, ränteändringar, ändrade minimibelopp, betalningsdagar, sena betalningar och långivarens egna beräkningsregler kan ändra utfallet.
- Kalkylatorn bedömer inte inkomst, nödvändiga utgifter eller betalningsförmåga. Den skickar inga betalningar och ska inte användas som instruktion att ändra ett låneavtal eller hoppa över en räkning.
- Fondsparande visas endast som ett exempel på en möjlig användning av pengar. Det är inte ett investeringsråd eller en rekommendation att investera. Fonder kan öka och minska i värde, och det går att förlora hela eller delar av det insatta kapitalet. Se [Finansinspektionens information om fonder](https://www.fi.se/sv/for-konsumenter/spara/fakta-om-fonder/).
- Om ekonomin inte går ihop kan kommunens budget- och skuldrådgivning hjälpa till. Rådgivningen är kostnadsfri; se [Konsumentverkets information](https://www.konsumentverket.se/ekonomi/kommunal-budget-och-skuldradgivning/).
- Skulduppgifter hanteras i webbläsaren, skickas inte av kalkylatorn och sparas inte av projektet. De nollställs när sidan laddas om. Webbhotellet kan ändå behandla tekniska besöksuppgifter; [GitHub Pages loggar besökares IP-adresser av säkerhetsskäl](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
- Oberoende lärprojekt. Inte anslutet till eller godkänt av Dave Ramsey, DebtSnowball.com, någon långivare eller myndighet.

Varningar och avgränsningar minskar risken för missförstånd men garanterar inte ansvarsfrihet. Innehållet och hur kalkylatorn presenteras spelar också roll.

## Teknik

Vanilla HTML, CSS och JavaScript med en liten Node.js-server för lokal förhandsvisning. Projektet använder Git och har en `.gitignore` för vanliga lokala filer.
