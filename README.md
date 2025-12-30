# AURA • Studio Zen (PWA)

## Avvio rapido (locale)
1. Apri la cartella in **Visual Studio Code**
2. Usa una delle opzioni:
   - **VS Code Live Server** (estensione) → apri `index.html`
   - oppure `python -m http.server 5173` e vai su `http://localhost:5173`

> Nota: per il Service Worker è meglio servire via HTTP (non file://).

## Deploy su GitHub Pages
- Pubblica la repo e abilita **GitHub Pages** sulla branch (root).
- Apri l'URL di Pages: l'app è una SPA hash-based (funziona bene su Pages).

## Dati e privacy
- Tutto è in `localStorage`.
- Export: bottone ⤓ in alto.
- Import: Impostazioni → Import JSON.

## Mockup
- PNG: `assets/mockups/*.png` (10 schermate)
- HTML statici: `screens/*.html` (stesse schermate, utile come reference)

## Struttura
- `index.html` SPA
- `app.js` logica + routing
- `styles.css` UI
- `sw.js` offline cache
- `manifest.webmanifest` PWA
