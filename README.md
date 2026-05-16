# Beplantingsgids — Tuin

Praktische, visuele tuincheckl­ist per plantvak, gegenereerd uit het
beplantingsplan. Werkt als statische website (geschikt voor GitHub Pages)
en als printbare PDF.

## Inhoud

- `index.html`, `styles.css`, `app.js` — responsive site (mobiel/tablet)
- `data/plants.json` — gestructureerde plantgegevens per plantvak
- `data/credits.json` — bronlinks voor de plantenfoto's
- `assets/crops/` — uitsneden van de plattegrond per plantvak
- `assets/plants/` — plantenfoto's (Wikimedia Commons / Wikipedia)
- `beplanting_gids.pdf` — printbare versie

## Plantvakken

- **Ronde bak A** — planten 1-8 (+ Amelanchier lamarckii)
- **Ronde bak B** — planten 44-56 (+ Albizia julibrissin 'Boubri')
- **Ronde bak C** — planten 57-66 (+ Amelanchier lamarckii)
- **Border / plantenstrook** — planten 9-43 (+ 3× Quercus ilex leivorm)

## Lokaal draaien

```
python3 -m http.server 8765
```
Open daarna <http://127.0.0.1:8765/>.

## GitHub Pages

Schakel Pages in op `main` / root in de repo-settings. `.nojekyll` zorgt
ervoor dat Jekyll niets doet en alle bestanden 1-op-1 worden geserveerd.

## Functies

- Vinkjes blijven bewaard in `localStorage` (per browser/apparaat)
- Print-CSS voor papieren tuincheckl­ist
- Foto-credits per plant
- Aannames vermeld in de site-footer
