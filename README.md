# Numérisation Photo Argentique

Application PWA SvelteKit pour smartphone dédiée à la numérisation de photos argentiques.

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

## Build

```bash
npm run build
```

## Fonctionnalités

- Accès à la caméra du smartphone
- Formats de cadrage : 6x6, 6x7, 6x9, 135
- Grille de composition et guides de centrage
- Inversion des couleurs (négatifs) et mode noir & blanc
- Capture et téléchargement des photos

## PWA

L'application est configurée comme Progressive Web App et peut être installée sur smartphone pour une utilisation hors ligne.

### Icônes PWA

Pour que l'application fonctionne complètement en PWA, vous devez créer les icônes suivantes dans le dossier `static/` :

- `pwa-192x192.png` - Icône 192x192 pixels
- `pwa-512x512.png` - Icône 512x512 pixels
- `apple-touch-icon.png` - Icône 180x180 pixels pour iOS
- `favicon.ico` - Favicon standard

Vous pouvez utiliser un outil en ligne comme [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) pour générer ces icônes à partir d'une image source.

## Utilisation

Activez la caméra, choisissez le format, utilisez la grille et les guides pour cadrer votre négatif ou diapositive, puis capturez et téléchargez l'image.
