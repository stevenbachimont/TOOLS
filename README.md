# Outils Photo Argentique

Application PWA SvelteKit pour smartphone regroupant 3 outils essentiels pour la photo argentique :

1. **Minuteur de développement** - Minuteur avec préréglages et mode personnalisé
2. **Posemètre** - Calculateur d'exposition avec différentes conditions de lumière
3. **Numérisation** - Outil de capture photo avec grille et guides

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

### Minuteur de développement
- Préréglages pour développement, arrêt, fixage, rinçage
- Minuteur personnalisé (minutes et secondes)
- Affichage visuel avec cercle de progression
- Notifications et alarmes sonores
- Vibration sur mobile

### Posemètre
- Calcul automatique de la valeur d'exposition (EV)
- Conditions de lumière prédéfinies
- Ajustement ISO, ouverture et vitesse d'obturation
- Affichage de combinaisons équivalentes

### Numérisation
- Accès à la caméra du smartphone
- Grille de composition (règle des tiers)
- Guides de centrage
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

1. **Minuteur** : Sélectionnez un préréglage ou créez un minuteur personnalisé. Le minuteur affiche un cercle de progression et émet une alarme à la fin.

2. **Posemètre** : Choisissez les conditions de lumière, ajustez l'ISO, l'ouverture et la vitesse d'obturation. L'application calcule automatiquement la valeur d'exposition et propose des combinaisons équivalentes.

3. **Numérisation** : Activez la caméra, utilisez la grille et les guides pour cadrer votre photo argentique, puis capturez et téléchargez l'image.

# TOOLS
