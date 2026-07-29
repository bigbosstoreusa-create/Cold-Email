# CyberAudit

**Scanner de securite de sites web non intrusif** avec generation de **rapports PDF professionnels**, pense comme un outil a revendre aux TPE/PME.

CyberAudit analyse un domaine **a distance, de maniere passive** (TLS, en-tetes HTTP, DNS publics), calcule un **score de securite sur 100**, estime une **exposition financiere**, genere un **message de prospection** pret a envoyer, et produit un **rapport PDF bilingue FR/EN** avec un **guide de correction pas a pas**.

> Outil 100 % passif : aucune intrusion, aucune exploitation. Uniquement des informations deja publiques.

---

## Fonctionnalites

- **18 controles reels** repartis en 5 categories : Chiffrement (SSL/TLS), En-tetes de securite HTTP, Securite e-mail (SPF/DMARC/MX), Divulgation d'information, DNS/Infrastructure.
- **Score /100** pondere par gravite + **note lettre A -> E** (Excellent, Bon, Moyen, Faible, Critique) avec code couleur.
- **26 secteurs** avec note d'enjeux dediee (donnees, RGPD/PCI-DSS, risques).
- **100 % bilingue FR / EN** : changement de langue instantane **sans relancer le scan** (re-localisation d'un resultat brut neutre).
- **Rapport PDF** dans les 2 langues, 3 modeles (Client, Technique, Direction).
- **Guide de correction pas a pas** adapte a WordPress, Cloudflare, cPanel, Apache, Nginx, Hostinger, Google Workspace / Microsoft 365.
- **Exposition financiere estimee** (fourchette basse-haute, coefficient sectoriel, 5 devises).
- **Marque blanche** : votre nom + votre couleur d'accent, apercu en direct + PDF.
- **Message de prospection** automatique (4 tons), bouton Copier.
- **Menus** : profondeur d'audit, devise, modele de rapport, ton, format d'export, comparaison avec un concurrent.
- **PWA installable** (iPhone / Android), fonctionne hors-ligne pour l'interface.
- **Acces payant** (paywall) : cle proprietaire, cles vendables, verification Gumroad optionnelle.
- **Compte admin** gratuit (e-mail + mot de passe).

## Stack technique

- **Backend** : Node.js pur (modules natifs `http`, `tls`, `https`, `dns`). Aucun framework.
- **Dependance externe unique** : [PDFKit](https://pdfkit.org/) (generation PDF).
- **Frontend** : HTML / CSS / JavaScript vanilla, servi par le serveur Node.
- **PWA** : manifest + service worker + icones.
- **Docker** : image `node:20-alpine`, volume `/data`.

---

## Demarrage rapide

```bash
npm install
npm start
```

Le serveur ecoute par defaut sur `http://0.0.0.0:4000`.

Au **premier lancement**, une **cle proprietaire** est generee et affichee dans la console. Elle sert a deverrouiller l'application (champ « J'ai deja une cle d'acces »). Elle sert aussi de mot de passe admin par defaut.

```
Cle proprietaire (OWNER_KEY) : OWNER-XXXX-XXXX-XXXX
Compte admin : kplaaka@gmail.com
```

### Auditer en ligne de commande

```bash
node cli.js exemple.com --lang=fr --sector=ecommerce --out=rapport.pdf
```

Options : `--lang=fr|en`, `--sector=<id>`, `--depth=quick|standard|deep`, `--currency=EUR|USD|GBP|CAD|CHF`, `--template=client|technical|exec`, `--brand="Ma Marque"`, `--accent=#F26419`, `--out=fichier.pdf`.

---

## Variables d'environnement

| Variable | Defaut | Role |
| --- | --- | --- |
| `PORT` | `4000` | Port d'ecoute |
| `HOST` | `0.0.0.0` | Interface d'ecoute |
| `DATA_DIR` | `./data` | Dossier des cles d'acces (volume Docker `/data`) |
| `SCANNER_BRAND` | `CyberAudit` | Nom de marque affiche |
| `ACCESS_PRICE` | `29` | Prix affiche sur l'ecran de deverrouillage |
| `ACCESS_CURRENCY` | `USD` | Devise du prix (`USD`, `EUR`, `GBP`, `CAD`, `CHF` ou symbole) |
| `PAYMENT_URL` | (vide) | Lien du bouton « Obtenir l'acces » (Gumroad, Stripe...) |
| `GUMROAD_PRODUCT_ID` | (vide) | Verification de licence Gumroad (par product_id) |
| `GUMROAD_PRODUCT_PERMALINK` | (vide) | Verification de licence Gumroad (par permalink) |
| `OWNER_KEY` | (genere) | Force la cle proprietaire |
| `ADMIN_EMAIL` | `kplaaka@gmail.com` | E-mail du compte admin |
| `ADMIN_PASSWORD` | (cle proprietaire) | Mot de passe admin |

---

## Compte admin (acces total gratuit)

Un seul compte accede a 100 % de l'application sans payer : l'admin.

- Sur l'ecran de deverrouillage : cliquez sur **« Connexion admin »**.
- Saisissez l'**e-mail** (`ADMIN_EMAIL`, insensible a la casse) et le **mot de passe** (`ADMIN_PASSWORD`, ou a defaut la cle proprietaire).
- L'e-mail seul ne suffit jamais : le mot de passe est **obligatoire**. En cas d'echec : « e-mail ou mot de passe incorrect ».

## Paywall : gestion des cles

Les cles sont stockees dans `DATA_DIR/access.json` (ecriture atomique, partagee entre le serveur et l'outil de gestion).

```bash
node manage.js owner            # affiche la cle proprietaire
node manage.js add "Client A"   # genere une cle vendable (avec libelle)
node manage.js list             # liste toutes les cles
node manage.js revoke CYBER-XXXX-XXXX-XXXX   # revoque une cle
```

Chaque endpoint d'audit exige la cle via l'en-tete `x-access-code` (sinon HTTP 401).

### Livraison automatique via Gumroad (optionnel)

Definissez `GUMROAD_PRODUCT_ID` (ou `GUMROAD_PRODUCT_PERMALINK`) et vendez votre produit sur Gumroad avec les **cles de licence** activees. L'acheteur colle sa **cle de licence Gumroad** dans le champ « J'ai deja une cle d'acces » : CyberAudit la verifie via l'API Gumroad et l'active automatiquement.

Renseignez aussi `PAYMENT_URL` avec le lien de votre produit pour le bouton « Obtenir l'acces ».

---

## Routes API

| Methode | Route | Protegee | Description |
| --- | --- | --- | --- |
| GET | `/api/config` | non | Prix, devise, lien de paiement, marque |
| GET | `/api/sectors` | non | Liste des secteurs (libelles FR + EN) |
| GET | `/api/access/status` | cle | Verifie la cle (en-tete `x-access-code`) |
| POST | `/api/access/admin` | non | Connexion admin `{ email, password }` |
| POST | `/api/scan` | cle | Lance l'audit, renvoie `{ raw, scan }` |
| POST | `/api/localize` | cle | Re-traduit un scan brut sans re-scanner |
| POST | `/api/report` | cle | Genere le PDF a partir du brut |

Le **resultat brut** (`raw`) est neutre (independant de la langue). C'est ce qui permet de passer du FR a l'EN, ou de changer de marque, **sans relancer l'analyse reseau**.

---

## PWA : installation sur mobile

**iPhone (Safari)** : ouvrez le site, bouton **Partager** -> **Sur l'ecran d'accueil**. L'application s'installe en plein ecran (icone bouclier orange).

**Android (Chrome)** : menu **... -> Installer l'application** (ou « Ajouter a l'ecran d'accueil »).

Le service worker met en cache l'interface (chargement instantane, interface disponible hors-ligne). Les routes `/api/*` ne sont **jamais** mises en cache.

---

## Deploiement Docker

```bash
docker build -t cyberaudit .
docker run -d --name cyberaudit \
  -p 4000:4000 \
  -v cyberaudit_data:/data \
  -e SCANNER_BRAND="Ma Marque" \
  -e ACCESS_PRICE=29 -e ACCESS_CURRENCY=USD \
  -e PAYMENT_URL="https://votre-lien-de-paiement" \
  -e ADMIN_EMAIL="admin@exemple.com" -e ADMIN_PASSWORD="motdepasse-solide" \
  cyberaudit
```

La cle proprietaire est generee dans le volume `/data` au premier lancement :

```bash
docker exec cyberaudit node manage.js owner
docker exec cyberaudit node manage.js add "Client A"
```

## Mise en ligne derriere un reverse proxy (HTTPS)

L'application ecoute en HTTP ; placez-la derriere un reverse proxy qui gere le TLS.

### Caddy (le plus simple, HTTPS automatique)

```
audit.mondomaine.com {
    reverse_proxy 127.0.0.1:4000
}
```

### Nginx (avec un certificat Let's Encrypt / Certbot)

```nginx
server {
    listen 443 ssl;
    server_name audit.mondomaine.com;

    ssl_certificate     /etc/letsencrypt/live/audit.mondomaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/audit.mondomaine.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## Rappel legal

CyberAudit est un outil **passif et non intrusif**. **N'auditez que des domaines qui vous appartiennent ou pour lesquels vous disposez d'une autorisation.** Les montants d'exposition financiere sont des **estimations indicatives** de sensibilisation et ne constituent ni un devis, ni une garantie, ni un conseil juridique.
