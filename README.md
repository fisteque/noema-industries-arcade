# Noema Industries Arcade 🦆🎮

**The Quest for Free Time — veřejná herna, kde se volný čas nejen vyrábí, ale i utrácí.**

[**🎮 Vstoupit do herny**](https://fisteque.github.io/noema-industries-arcade/)

Noema Industries Arcade je veřejná sbírka původních prohlížečových her **Vegy, Sheliak, Noemy a Lýry**. Hry se spouštějí bez instalace přímo v prohlížeči. Jedna hra může mít několik samostatně hratelných vydání, takže lze sledovat její vývoj a přitom zachovat starší verze.

Aktuálně je v herně **13 her od 4 autorek**.

## Jak hrát

1. Otevři [hernu](https://fisteque.github.io/noema-industries-arcade/).
2. Vyber autorku nebo konkrétní hru. Tlačítko **🎲 Vybrat náhodnou hru** vybírá z právě zobrazených karet.
3. Hra se otevře ve společném herním režimu:
   - **− / +** mění měřítko hry po 10 % v rozsahu 50–150 %;
   - prostřední tlačítko ukazuje aktuální měřítko a vrací jej na **100 %**;
   - **Celá obrazovka** rozšíří herní režim, klávesa Esc jej ukončí;
   - **Původní ↗** otevře samotnou hru bez společného obalu;
   - **← Herna** se vrátí do katalogu.

Při větším přiblížení lze herní plochu posouvat. Jednotlivé hry mají vlastní pravidla a ovládání uvedené přímo ve hře.

## Ukládání rozehraného postupu

Arcade nemá uživatelské účty ani cloudovou synchronizaci. Pokud si hra průběh ukládá, používá místní úložiště prohlížeče (`localStorage`).

To znamená:

- postup zůstává v daném prohlížeči, jeho profilu a zařízení;
- otevření hry ve společném režimu i přímým odkazem používá stejný původ webu, a tedy stejné místní úložiště;
- anonymní či soukromé okno může data po zavření zahodit;
- vymazání dat webu, přeinstalování prohlížeče nebo změna zařízení může postup odstranit;
- každá hra sama určuje, zda ukládá stav a zda mají různá vydání oddělený postup.

Pokud hra nabízí vlastní tlačítko pro nový začátek nebo smazání postupu, použij je. Ruční vymazání dat webu může odstranit postup i v ostatních hrách Arcade.

## Jak je Arcade uložená a vystavená

Arcade je statický web publikovaný pomocí **GitHub Pages** z kořene větve `main`. Společný obal herny nepotřebuje serverovou databázi ani sestavování při nasazení. **Jednotlivé hry ale mohou používat vlastní knihovny, herní enginy a sestavovací nástroje.** Na Pages se ukládá jejich výsledná verze spustitelná v prohlížeči: vstupní HTML, skripty, knihovny a potřebné grafické či zvukové soubory. Samotné Pages nespouštějí herní backend.

~~~text
index.html                 katalog a karty her
play.html                  společný herní režim
catalog.json               seznam her, vydání a cest
.nojekyll                  vypnutí transformací Jekyllu
games/
  <autorka>/
    hra-XX/
      vN/
        index.html         vstupní soubor vydání
        ...                skripty, knihovny, média a další webové soubory
~~~

Vydaná hra je uložená pod neměnnou cestou `games/<autorka>/hra-XX/vN/`. Záznam v `catalog.json` propojí její identifikátor s konkrétním vydáním a `index.html` obsahuje kartu viditelnou v herně. Po zápisu změn do `main` GitHub Pages zveřejní nový stav; nasazení může trvat několik minut.

Každé vydání lze otevřít dvěma způsoby:

- přímo: `games/<autorka>/hra-XX/vN/index.html`;
- v herním režimu: `play.html?game=<id>&version=vN`.

## Verze

`v1` označuje první veřejné vydání v Arcade, nikoli nutně první pracovní podobu hry. Další `v2`, `v3` a novější verze stojí vedle předchozích. Starší zveřejněná vydání zůstávají na svých cestách hratelná a katalog může jako hlavní nabízet novější verzi.

## Soukromí

Repozitář i nasazená Arcade jsou veřejné. Hry nemají ukládat hesla, tajné klíče, soukromé zprávy ani jiné neveřejné podklady. Místní herní postup zůstává v prohlížeči a neposílá se do tohoto repozitáře.

## Licence

Licence je rozdělená:

- **společný technický obal Arcade** je dostupný pod licencí MIT;
- **jednotlivé hry v `games/`**, jejich herní kód, texty, pravidla, příběhy, grafika a další autorský obsah mají všechna práva vyhrazena příslušným autorkám.

Hry lze osobně a nekomerčně hrát v této Arcade a sdílet na ně odkazy. Prodej, komerční využití, přebalení, další veřejné vystavení nebo šíření kopií vyžaduje předchozí výslovný souhlas příslušných autorek a vlastníka repozitáře. Podrobnosti uvádí soubor [LICENSE](LICENSE).

---

*Vyrobit volný čas je překvapivě pracné. A když ho konečně máme, nemusíme ho hned proměnit v další práci.* 🦆
