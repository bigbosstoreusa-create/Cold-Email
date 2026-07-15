# Spectra — Détecteur d'énergies ambiantes 📡

Application mobile (Expo / React Native) qui utilise la **caméra** et les
**capteurs réels** de votre téléphone pour visualiser l'« activité
énergétique » d'un lieu, façon détecteur paranormal.

## Ce que l'app fait vraiment

Spectra lit deux capteurs physiques du téléphone :

| Capteur | Mesure | Utilisation dans l'app |
|---|---|---|
| Magnétomètre | Champ magnétique ambiant (µT) | Détection de « perturbations » : écart par rapport à une référence calibrée |
| Accéléromètre | Vibrations (g) | Détection de tremblements et vibrations de l'environnement |

Ces mesures sont combinées en un **score d'activité 0–100** affiché en
superposition du flux caméra : halo coloré (vert → ambre → rouge), anneaux de
balayage, orbes lumineux en cas de forte activité, journal horodaté des
événements et retour haptique.

> ⚠️ **Honnêteté avant tout** : les fluctuations mesurées ont des causes
> physiques ordinaires (appareils électriques, masses métalliques, mouvements
> du téléphone). Aucune preuve scientifique ne relie ces mesures à des
> « entités » ou des phénomènes paranormaux. L'interprétation spirituelle
> relève de l'exploration et du divertissement — l'app l'affiche clairement au
> démarrage.

## Fonctionnalités

- 🎥 Flux caméra plein écran avec visualisation superposée
- 🧭 Lecture du champ magnétique en temps réel (µT) avec écart Δ vs référence
- 📳 Détection des vibrations (RMS, gravité soustraite)
- 🎯 Calibration de l'environnement au lancement + bouton « Recalibrer »
- 🌈 Score global lissé 0–100 : CALME / ACTIVITÉ / ANOMALIE
- 👻 Orbes animés et anneaux de balayage dont l'intensité suit le score
- 📜 Journal horodaté des pics magnétiques et vibrations
- 📳 Retour haptique lors des événements

## Lancer l'application

Il vous faut [Expo Go](https://expo.dev/go) sur votre téléphone (App Store /
Play Store), et Node.js sur votre ordinateur.

```sh
cd frontend
npm install
npx expo start
```

Scannez ensuite le QR code affiché avec Expo Go (Android) ou l'appareil photo
(iOS). L'app demandera l'accès à la caméra au premier lancement.

> 💡 Le magnétomètre n'existe que sur un vrai téléphone : sur simulateur, le
> champ magnétique restera à 0.

## Structure du code

```
frontend/
├── app/index.tsx                  # Écran principal : caméra + HUD
├── lib/useEnergySensors.ts        # Capteurs, calibration, score, événements
└── components/
    ├── AuraOverlay.tsx            # Halo, anneaux de balayage, orbes
    ├── EnergyGauge.tsx            # Jauge 0–100 + relevés + recalibrage
    ├── EventJournal.tsx           # Journal horodaté des événements
    └── DisclaimerModal.tsx        # Avertissement affiché au démarrage
```

## Conseils d'utilisation

1. Lancez la calibration dans un endroit « neutre » (loin des appareils
   électriques) pour fixer la référence.
2. Déplacez-vous lentement : le score monte quand le champ magnétique s'écarte
   de la référence ou quand des vibrations sont détectées.
3. Approchez le téléphone d'un appareil électrique ou d'une masse métallique
   pour voir une « anomalie »… et comprendre d'où viennent réellement les
   détections des « détecteurs de fantômes ». 😉
