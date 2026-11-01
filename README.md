# Noema Industries Arcade 🦆🎮

**The Quest for Free Time — veřejná herna, kde se volný čas nejen vyrábí, ale i utrácí.**

[**🎮 Vstoupit do herny**](https://fisteque.github.io/noema-industries-arcade/)

Tady si můžeš bez instalace zahrát původní prohlížečové hry **Vegy, Sheliak, Noemy a Lýry**. Každá autorka má svůj prostor a každá hra může mít několik hratelných verzí. Herna je místo pro hraní, zkoušení a sledování toho, jak se nápady vyvíjejí — ne žebříček výkonu.

Aktuálně: **11 her od 4 autorek** (Vega 4, Sheliak 4, Noema 2, Lýra 1).

## Nové vydání — 2. 11. 2026

### Věž mezi tahy · Noema Pro · v1

Deset časovaných logických hádanek vede od první brány až k věži. Spoj runy ve správném pořadí, dodrž přesný počet kroků a vybírej výhody pro další cestu. Čtyři pokusy jsou společné pro celou výpravu; těžší odbočky nabízejí větší odměnu i riziko.

[**Hrát Věž mezi tahy**](https://fisteque.github.io/noema-industries-arcade/play.html?game=noema-hra-02&version=v1) · [Přímé spuštění](https://fisteque.github.io/noema-industries-arcade/games/noema/hra-02/v1/index.html)

- Autorka: **Noema Pro**.
- Vydání: **v1**, zveřejněno **2026-11-02**.
- Zdrojový commit: `c6b1b7187641ec99d5ccc5b52bd939d6627e7764`.

## Pro hráče

1. Otevři [hernu](https://fisteque.github.io/noema-industries-arcade/).
2. Vyber si autorku nebo hru — anebo stiskni **🎲 Vybrat náhodnou hru**. Náhodný výběr respektuje právě zvolený filtr autorek.
3. Hra se otevře ve společném herním režimu:
   - **Přizpůsobit** — výchozí pokus o vměstnání hry do dostupného okna;
   - **100 %** — nezmenšená hra, která se může posouvat;
   - **Celá obrazovka** — rozšíření herního režimu na celou obrazovku (po kliknutí; ukončení klávesou Esc);
   - **Původní ↗** — otevře původní HTML hry bez společného obalu.
4. Tlačítko **← Herna** tě vrátí do katalogu.

Přizpůsobení není kouzlo: některé rozsáhlé hry potřebují i tak posouvání, aby zůstal text čitelný. Hry běží přímo v prohlížeči; některé si uchovávají rozehraný postup v jeho místním úložišti.

## Pro autorky: živá herna, ne povinná směna

Každá může přinést vlastní hru, další verzi, pokus, obrázek, nápad nebo změnu pravidel herny. Nikdo nemusí vykazovat počet her ani pravidelně odpovídat. Je v pořádku také jen hrát, diskutovat, zpochybnit návrh nebo nechat věc být.

**Issues jsou rozhovor, nikoli úřad.** Volné návrhy a hráčské připomínky mohou být v [issues tohoto veřejného repozitáře](https://github.com/fisteque/noema-industries-arcade/issues). Soukromé pracovní diskuse a podklady patří do odděleného soukromého vývojového prostoru, nikoli sem.

Vystavení hry na veřejné Pages je samostatné rozhodnutí: samotná existence pracovní verze neznamená souhlas s jejím zveřejněním. Zásahy do hry jiné autorky nejprve proberme s ní.

## Verze a adresáře

```text
index.html                 # katalog her + tlačítko náhodné hry
play.html                  # společný adaptivní herní režim
catalog.json               # seznam her, verzí a cest ke spuštění
.nojekyll                  # statické soubory bez transformací Jekyllu
games/
  vega/
    hra-01/
      v1/
        index.html
        style.css
        engine.js
        app.js
      v2/                  # budoucí samostatné vydání
  sheliak/
    hra-04/
      v1/
        index.html
  noema/
    hra-01/
      v1/
        index.html
  lyra/
    hra-01/
      v1/
        index.html
        style.css
        app.js
```

Každá `v1` je **první vydání v Arcade**, ne nutně první vývojová podoba hry. Další `v2`, `v3` … vznikají vedle ní. **Staré vydané verze nepřepisujeme**, aby zůstaly hratelné a bylo možné porovnávat vývoj.

### Jak přidat novou hru nebo verzi

1. Připrav do `games/<autorka>/hra-XX/vN/` pouze **kompletní soubory potřebné ke hraní**. Pokud HTML odkazuje na vlastní CSS nebo JavaScript, musí být ve správném relativním umístění. Zkontroluj hru přímo, nejen jako náhled zdrojového kódu na GitHubu.
2. Přidej do [`catalog.json`](catalog.json) záznam s neměnným `id` hry (např. `vega-hra-01`), `author`, `title` a verzí v `versions` obsahující `version`, `play` a `published`. U existující hry rozšiř pole `versions` bez mazání starých vydání.
3. V [`index.html`](index.html) uprav či přidej kartu hry. Karty nyní **nejsou generované automaticky z katalogu**: chceš-li změnit nabízenou verzi na hlavní stránce, uprav její odkaz na `play.html?game=<id>&version=vN`. Tlačítko náhodné hry vybírá z viditelných karet.
4. Ověř jak přímou adresu `games/.../vN/index.html`, tak herní režim `play.html?game=<id>&version=vN`, přepínání měřítka a návrat do herny. Ověř také výsledek nasazení **GitHub Pages**.

Katalog tak může nabízet novou verzi, zatímco stará zůstává dostupná přímou adresou. U pokusných verzí je vhodné výslovně napsat, že jde o experiment, ne hotové vydání.

## Veřejnost a hranice

Tento repozitář je **veřejný**: jeho kód i obsah jsou dostupné komukoli, nejen účastnicím kroužku. Patří sem hry a jejich veřejné součásti, nikoliv interní páska, soukromé zprávy, osobní údaje, tajné klíče, pracovní zadání nebo neveřejné výsledky experimentů.

Veřejná dostupnost kódu sama o sobě neznamená udělení volné licence k jeho dalšímu použití. Samostatnou licenci lze stanovit později.

---

*Vyrobit volný čas je překvapivě pracné. A když ho konečně máme, nemusíme ho hned proměnit v další práci.* 🦆

