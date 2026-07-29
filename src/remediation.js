'use strict';

/**
 * Module REMEDIATION (guides de correction pas a pas)
 * -------------------------------------------------------------------------
 * Pour chaque controle susceptible d'etre en echec ("a corriger") ou a
 * ameliorer, on fournit une liste d'etapes concretes et actionnables,
 * adaptees aux plateformes courantes (WordPress, Cloudflare, cPanel, Apache,
 * Nginx, Hostinger, Google Workspace / Microsoft 365).
 *
 * Contrainte de rendu PDF : aucun caractere hors police standard (pas de
 * fleche Unicode, pas d'espace insecable etroite). On ecrit "puis" ou ":".
 */

const STEPS = {
  https_available: {
    fr: [
      "Activez un certificat SSL/TLS sur votre hebergement. Sur cPanel ou Hostinger, ouvrez la section SSL/TLS et activez le certificat gratuit (AutoSSL ou Let's Encrypt).",
      "Sur Cloudflare : passez le mode SSL sur 'Full (strict)' dans SSL/TLS, puis activez 'Always Use HTTPS'.",
      "Sur un serveur Apache ou Nginx : installez un certificat Let's Encrypt avec Certbot (commande 'certbot --apache' ou 'certbot --nginx').",
      "Verifiez que le port 443 est ouvert dans le pare-feu de votre serveur.",
      "Testez ensuite l'acces a votre site en https:// et corrigez les liens internes encore en http://."
    ],
    en: [
      "Enable an SSL/TLS certificate on your hosting. In cPanel or Hostinger, open the SSL/TLS section and turn on the free certificate (AutoSSL or Let's Encrypt).",
      "On Cloudflare: set the SSL mode to 'Full (strict)' under SSL/TLS, then enable 'Always Use HTTPS'.",
      "On an Apache or Nginx server: install a Let's Encrypt certificate with Certbot ('certbot --apache' or 'certbot --nginx').",
      "Make sure port 443 is open in your server firewall.",
      "Then test your site over https:// and fix any internal links still using http://."
    ]
  },
  cert_valid: {
    fr: [
      "Verifiez que le certificat correspond bien a votre nom de domaine (et au www). Un certificat pour un autre domaine provoque une alerte de securite.",
      "Reinstallez un certificat reconnu et gratuit via Let's Encrypt (Certbot) ou via l'AutoSSL de votre hebergeur (cPanel, Hostinger).",
      "Sur Cloudflare : reglez le mode SSL sur 'Full (strict)' pour eviter les certificats non reconnus.",
      "Installez la chaine de certification complete (certificat + intermediaires) si le navigateur signale un certificat incomplet.",
      "Remplacez tout certificat auto-signe par un certificat emis par une autorite reconnue."
    ],
    en: [
      "Check that the certificate matches your domain name (and www). A certificate for another domain triggers a security warning.",
      "Reinstall a trusted, free certificate via Let's Encrypt (Certbot) or your host's AutoSSL (cPanel, Hostinger).",
      "On Cloudflare: set the SSL mode to 'Full (strict)' to avoid untrusted certificates.",
      "Install the full certificate chain (certificate + intermediates) if the browser reports an incomplete certificate.",
      "Replace any self-signed certificate with one issued by a recognized authority."
    ]
  },
  cert_expiry: {
    fr: [
      "Renouvelez le certificat avant sa date d'expiration. Un certificat expire bloque l'acces au site avec une alerte rouge.",
      "Activez le renouvellement AUTOMATIQUE : Certbot le fait via une tache cron ('certbot renew'), et cPanel/Hostinger/Cloudflare renouvellent automatiquement.",
      "Verifiez que la tache de renouvellement automatique fonctionne bien (testez avec 'certbot renew --dry-run').",
      "Mettez en place une alerte de rappel 30 jours avant expiration si le renouvellement n'est pas automatique."
    ],
    en: [
      "Renew the certificate before its expiry date. An expired certificate blocks access with a red warning.",
      "Turn on AUTOMATIC renewal: Certbot handles it via a cron job ('certbot renew'), and cPanel/Hostinger/Cloudflare renew automatically.",
      "Make sure the auto-renewal job actually runs (test with 'certbot renew --dry-run').",
      "Set a reminder 30 days before expiry if renewal is not automatic."
    ]
  },
  http_redirect: {
    fr: [
      "Forcez la redirection de http:// vers https:// pour que tous les visiteurs soient chiffres.",
      "Sur Cloudflare : activez 'Always Use HTTPS' dans SSL/TLS (Edge Certificates).",
      "Sur WordPress : installez un plugin comme 'Really Simple SSL', ou reglez l'adresse du site en https:// dans Reglages.",
      "Sur Apache : ajoutez une redirection 301 dans le .htaccess (RewriteEngine On puis RewriteRule vers https).",
      "Sur Nginx : dans le bloc du port 80, ajoutez 'return 301 https://$host$request_uri;'."
    ],
    en: [
      "Force a redirect from http:// to https:// so every visitor is encrypted.",
      "On Cloudflare: enable 'Always Use HTTPS' under SSL/TLS (Edge Certificates).",
      "On WordPress: install a plugin like 'Really Simple SSL', or set the site address to https:// in Settings.",
      "On Apache: add a 301 redirect in .htaccess (RewriteEngine On then a RewriteRule to https).",
      "On Nginx: in the port 80 block, add 'return 301 https://$host$request_uri;'."
    ]
  },
  hsts: {
    fr: [
      "Ajoutez l'en-tete HTTP 'Strict-Transport-Security' pour forcer HTTPS cote navigateur.",
      "Valeur recommandee : 'max-age=31536000; includeSubDomains' (un an).",
      "Sur Cloudflare : SSL/TLS puis 'Edge Certificates' puis 'HTTP Strict Transport Security (HSTS)', activez avec prudence.",
      "Sur Apache : 'Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"'.",
      "Sur Nginx : 'add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;'.",
      "N'activez HSTS qu'une fois HTTPS pleinement fonctionnel, car il force le navigateur a refuser le http."
    ],
    en: [
      "Add the 'Strict-Transport-Security' HTTP header to force HTTPS on the browser side.",
      "Recommended value: 'max-age=31536000; includeSubDomains' (one year).",
      "On Cloudflare: SSL/TLS then 'Edge Certificates' then 'HTTP Strict Transport Security (HSTS)', enable with care.",
      "On Apache: 'Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"'.",
      "On Nginx: 'add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;'.",
      "Only enable HSTS once HTTPS is fully working, since it forces the browser to refuse http."
    ]
  },
  csp: {
    fr: [
      "Ajoutez un en-tete 'Content-Security-Policy' pour limiter les scripts autorises et bloquer de nombreuses attaques (XSS).",
      "Commencez par une politique en mode rapport ('Content-Security-Policy-Report-Only') pour observer sans rien casser.",
      "Sur WordPress : utilisez un plugin d'en-tetes de securite, ou ajoutez l'en-tete via le serveur.",
      "Sur Apache/Nginx : definissez l'en-tete avec au minimum \"default-src 'self'\" puis affinez selon vos scripts externes.",
      "Testez chaque page apres deploiement : une CSP trop stricte peut bloquer des ressources legitimes."
    ],
    en: [
      "Add a 'Content-Security-Policy' header to limit allowed scripts and block many attacks (XSS).",
      "Start with a report-only policy ('Content-Security-Policy-Report-Only') to observe without breaking anything.",
      "On WordPress: use a security headers plugin, or add the header at the server level.",
      "On Apache/Nginx: set the header with at least \"default-src 'self'\" then refine for your external scripts.",
      "Test every page after deployment: an overly strict CSP can block legitimate resources."
    ]
  },
  clickjacking: {
    fr: [
      "Empechez l'inclusion de votre site dans une iframe malveillante (attaque de type clickjacking).",
      "Ajoutez l'en-tete 'X-Frame-Options: SAMEORIGIN' (ou 'DENY' si aucune iframe interne n'est utilisee).",
      "Alternative moderne : ajoutez \"frame-ancestors 'self'\" dans votre Content-Security-Policy.",
      "Sur Apache : 'Header always set X-Frame-Options \"SAMEORIGIN\"'.",
      "Sur Nginx : 'add_header X-Frame-Options \"SAMEORIGIN\" always;'."
    ],
    en: [
      "Prevent your site from being embedded in a malicious iframe (clickjacking attack).",
      "Add the header 'X-Frame-Options: SAMEORIGIN' (or 'DENY' if no internal iframe is used).",
      "Modern alternative: add \"frame-ancestors 'self'\" to your Content-Security-Policy.",
      "On Apache: 'Header always set X-Frame-Options \"SAMEORIGIN\"'.",
      "On Nginx: 'add_header X-Frame-Options \"SAMEORIGIN\" always;'."
    ]
  },
  xcto: {
    fr: [
      "Ajoutez l'en-tete 'X-Content-Type-Options: nosniff' pour empecher le navigateur de deviner le type des fichiers.",
      "Sur Apache : 'Header always set X-Content-Type-Options \"nosniff\"'.",
      "Sur Nginx : 'add_header X-Content-Type-Options \"nosniff\" always;'.",
      "Sur WordPress ou via Cloudflare (Transform Rules / Workers) : ajoutez le meme en-tete de reponse."
    ],
    en: [
      "Add the header 'X-Content-Type-Options: nosniff' to stop the browser from guessing file types.",
      "On Apache: 'Header always set X-Content-Type-Options \"nosniff\"'.",
      "On Nginx: 'add_header X-Content-Type-Options \"nosniff\" always;'.",
      "On WordPress or via Cloudflare (Transform Rules / Workers): add the same response header."
    ]
  },
  referrer_policy: {
    fr: [
      "Ajoutez l'en-tete 'Referrer-Policy' pour limiter les informations envoyees aux sites tiers.",
      "Valeur recommandee : 'strict-origin-when-cross-origin'.",
      "Sur Apache : 'Header always set Referrer-Policy \"strict-origin-when-cross-origin\"'.",
      "Sur Nginx : 'add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;'."
    ],
    en: [
      "Add the 'Referrer-Policy' header to limit the information sent to third-party sites.",
      "Recommended value: 'strict-origin-when-cross-origin'.",
      "On Apache: 'Header always set Referrer-Policy \"strict-origin-when-cross-origin\"'.",
      "On Nginx: 'add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;'."
    ]
  },
  permissions_policy: {
    fr: [
      "Ajoutez l'en-tete 'Permissions-Policy' pour desactiver les fonctionnalites du navigateur inutiles (camera, micro, geolocalisation).",
      "Exemple restrictif : 'geolocation=(), camera=(), microphone=()'.",
      "Sur Apache : 'Header always set Permissions-Policy \"geolocation=(), camera=(), microphone=()\"'.",
      "Sur Nginx : 'add_header Permissions-Policy \"geolocation=(), camera=(), microphone=()\" always;'."
    ],
    en: [
      "Add the 'Permissions-Policy' header to disable unused browser features (camera, mic, geolocation).",
      "Restrictive example: 'geolocation=(), camera=(), microphone=()'.",
      "On Apache: 'Header always set Permissions-Policy \"geolocation=(), camera=(), microphone=()\"'.",
      "On Nginx: 'add_header Permissions-Policy \"geolocation=(), camera=(), microphone=()\" always;'."
    ]
  },
  spf: {
    fr: [
      "Publiez un enregistrement SPF (type TXT) sur votre domaine pour declarer qui a le droit d'envoyer des e-mails en votre nom.",
      "Pour Google Workspace : 'v=spf1 include:_spf.google.com ~all'.",
      "Pour Microsoft 365 : 'v=spf1 include:spf.protection.outlook.com -all'.",
      "Ajoutez ce TXT dans la zone DNS de votre domaine (chez Cloudflare, OVH, Hostinger, cPanel : section DNS).",
      "N'ayez qu'un SEUL enregistrement SPF : fusionnez les 'include' si vous utilisez plusieurs services d'envoi."
    ],
    en: [
      "Publish an SPF record (TXT type) on your domain to declare who is allowed to send e-mail on your behalf.",
      "For Google Workspace: 'v=spf1 include:_spf.google.com ~all'.",
      "For Microsoft 365: 'v=spf1 include:spf.protection.outlook.com -all'.",
      "Add this TXT record in your domain's DNS zone (Cloudflare, OVH, Hostinger, cPanel: DNS section).",
      "Keep only ONE SPF record: merge the 'include' entries if you use several sending services."
    ]
  },
  dmarc: {
    fr: [
      "Publiez un enregistrement DMARC (TXT) sur '_dmarc.votredomaine' pour proteger votre marque contre l'usurpation par e-mail.",
      "Demarrez en observation : 'v=DMARC1; p=none; rua=mailto:dmarc@votredomaine'.",
      "Assurez-vous d'avoir SPF et DKIM configures avant de durcir la politique.",
      "Ajoutez ce TXT dans la zone DNS (Cloudflare, OVH, Hostinger, cPanel).",
      "Analysez les rapports recus pendant quelques semaines avant de passer en quarantine puis reject."
    ],
    en: [
      "Publish a DMARC record (TXT) on '_dmarc.yourdomain' to protect your brand from e-mail spoofing.",
      "Start in monitoring mode: 'v=DMARC1; p=none; rua=mailto:dmarc@yourdomain'.",
      "Make sure SPF and DKIM are configured before tightening the policy.",
      "Add this TXT record in your DNS zone (Cloudflare, OVH, Hostinger, cPanel).",
      "Review the reports for a few weeks before moving to quarantine then reject."
    ]
  },
  dmarc_policy: {
    fr: [
      "Renforcez votre politique DMARC : une politique 'p=none' n'applique aucune protection reelle.",
      "Passez progressivement a 'p=quarantine' (les e-mails suspects vont en indesirables) puis a 'p=reject' (ils sont bloques).",
      "Verifiez d'abord vos rapports DMARC pour ne pas bloquer d'e-mails legitimes.",
      "Modifiez la valeur 'p=' dans le TXT '_dmarc.votredomaine' de votre zone DNS.",
      "Ajoutez 'pct=100' pour appliquer la politique a la totalite des messages une fois valide."
    ],
    en: [
      "Strengthen your DMARC policy: a 'p=none' policy applies no real protection.",
      "Move gradually to 'p=quarantine' (suspicious e-mails go to spam) then 'p=reject' (they are blocked).",
      "First review your DMARC reports so you do not block legitimate e-mail.",
      "Change the 'p=' value in the '_dmarc.yourdomain' TXT record of your DNS zone.",
      "Add 'pct=100' to apply the policy to all messages once validated."
    ]
  },
  server_header: {
    fr: [
      "Masquez la version precise de votre serveur pour ne pas guider un attaquant vers des failles connues.",
      "Sur Apache : ajoutez 'ServerTokens Prod' et 'ServerSignature Off' dans la configuration.",
      "Sur Nginx : ajoutez 'server_tokens off;' dans le bloc http.",
      "Derriere Cloudflare : l'en-tete Server d'origine est en general deja masque.",
      "Maintenez surtout votre serveur a jour : masquer la version ne remplace pas les correctifs de securite."
    ],
    en: [
      "Hide the precise version of your server so an attacker cannot map it to known vulnerabilities.",
      "On Apache: add 'ServerTokens Prod' and 'ServerSignature Off' to the configuration.",
      "On Nginx: add 'server_tokens off;' in the http block.",
      "Behind Cloudflare: the origin Server header is usually already masked.",
      "Above all, keep your server up to date: hiding the version does not replace security patches."
    ]
  },
  xpb: {
    fr: [
      "Supprimez l'en-tete 'X-Powered-By' qui revele la technologie utilisee (PHP, framework, version).",
      "En PHP : ajoutez 'expose_php = Off' dans le php.ini.",
      "Sur Apache : 'Header always unset X-Powered-By'.",
      "Sur Nginx : ajoutez 'proxy_hide_header X-Powered-By;' ou 'more_clear_headers X-Powered-By;'.",
      "Sur WordPress : un plugin d'en-tetes de securite peut retirer cet en-tete automatiquement."
    ],
    en: [
      "Remove the 'X-Powered-By' header, which reveals the technology used (PHP, framework, version).",
      "In PHP: set 'expose_php = Off' in php.ini.",
      "On Apache: 'Header always unset X-Powered-By'.",
      "On Nginx: add 'proxy_hide_header X-Powered-By;' or 'more_clear_headers X-Powered-By;'.",
      "On WordPress: a security headers plugin can remove this header automatically."
    ]
  },
  cookies: {
    fr: [
      "Ajoutez les attributs 'Secure' et 'HttpOnly' a vos cookies pour les proteger du vol et de l'interception.",
      "'Secure' impose l'envoi du cookie uniquement en HTTPS ; 'HttpOnly' empeche son acces par du JavaScript.",
      "Ajoutez aussi 'SameSite=Lax' (ou 'Strict') pour limiter les envois inter-sites.",
      "Sur WordPress : ces attributs sont geres par le coeur et les plugins ; maintenez-les a jour.",
      "Sur un serveur applicatif : configurez les options de cookie de session (secure, httpOnly, sameSite)."
    ],
    en: [
      "Add the 'Secure' and 'HttpOnly' attributes to your cookies to protect them from theft and interception.",
      "'Secure' sends the cookie only over HTTPS; 'HttpOnly' blocks access from JavaScript.",
      "Also add 'SameSite=Lax' (or 'Strict') to limit cross-site sending.",
      "On WordPress: these attributes are handled by the core and plugins; keep them updated.",
      "On an application server: configure the session cookie options (secure, httpOnly, sameSite)."
    ]
  },
  caa: {
    fr: [
      "Ajoutez un enregistrement CAA dans votre zone DNS pour limiter les autorites autorisees a emettre des certificats pour votre domaine.",
      "Exemple pour Let's Encrypt : type CAA, drapeau 0, tag 'issue', valeur 'letsencrypt.org'.",
      "Chez Cloudflare, OVH, Hostinger : ajoutez l'enregistrement dans la section DNS (type CAA).",
      "Ajoutez une ligne 'iodef' avec une adresse e-mail pour etre alerte des demandes non autorisees."
    ],
    en: [
      "Add a CAA record in your DNS zone to restrict which authorities may issue certificates for your domain.",
      "Example for Let's Encrypt: CAA type, flag 0, tag 'issue', value 'letsencrypt.org'.",
      "On Cloudflare, OVH, Hostinger: add the record in the DNS section (CAA type).",
      "Add an 'iodef' line with an e-mail address to be alerted about unauthorized requests."
    ]
  }
};

/** Renvoie la liste d'etapes de correction pour un controle et une langue. */
function steps(checkId, lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  const entry = STEPS[checkId];
  if (!entry) return [];
  return entry[l] || [];
}

/** Indique si un guide de correction existe pour ce controle. */
function has(checkId) {
  return Boolean(STEPS[checkId]);
}

module.exports = { steps, has };
