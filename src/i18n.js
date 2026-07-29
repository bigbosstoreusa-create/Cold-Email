'use strict';

/**
 * Module I18N (traductions + fonction describe)
 * -------------------------------------------------------------------------
 * Coeur de la localisation. La fonction describe() prend un resultat BRUT
 * neutre (issu du scanner) et un contexte (langue, secteur, devise, ton,
 * marque, couleur, modele de rapport) et produit un MODELE entierement
 * localise, identique quel que soit le rendu (ecran, PDF, HTML, texte).
 *
 * On peut ainsi re-traduire un scan deja realise (FR <-> EN) SANS relancer
 * l'analyse reseau : il suffit de rappeler describe() avec une autre langue.
 *
 * Aucun caractere hors police standard (pas de fleche Unicode) : le meme
 * texte sert au PDF (PDFKit / Helvetica).
 */

const sectors = require('./sectors');
const remediation = require('./remediation');
const risk = require('./risk');
const outreach = require('./outreach');

const L = (lang) => (lang === 'en' ? 'en' : 'fr');
const pick = (lang, fr, en) => (L(lang) === 'en' ? en : fr);

// --- Libelles de base ------------------------------------------------------

const CATEGORY_LABELS = {
  encryption: { fr: 'Chiffrement (SSL/TLS)', en: 'Encryption (SSL/TLS)' },
  headers: { fr: 'En-tetes de securite HTTP', en: 'HTTP security headers' },
  email: { fr: 'Securite e-mail (anti-usurpation)', en: 'E-mail security (anti-spoofing)' },
  disclosure: { fr: "Divulgation d'information", en: 'Information disclosure' },
  dns: { fr: 'DNS / Infrastructure', en: 'DNS / Infrastructure' }
};
const CATEGORY_ORDER = ['encryption', 'headers', 'email', 'disclosure', 'dns'];

const STATUS_LABELS = {
  pass: { fr: 'Conforme', en: 'Compliant' },
  warn: { fr: 'A ameliorer', en: 'To improve' },
  fail: { fr: 'A corriger', en: 'To fix' },
  info: { fr: 'Information', en: 'Information' }
};
const STATUS_COLORS = { pass: '#1FA971', warn: '#E0A410', fail: '#D64545', info: '#8A8A93' };

const GRADE = {
  A: { label: { fr: 'Excellent', en: 'Excellent' }, color: '#1FA971' },
  B: { label: { fr: 'Bon', en: 'Good' }, color: '#5FA82A' },
  C: { label: { fr: 'Moyen', en: 'Average' }, color: '#E0A410' },
  D: { label: { fr: 'Faible', en: 'Weak' }, color: '#E4761B' },
  E: { label: { fr: 'Critique', en: 'Critical' }, color: '#D64545' }
};
const GRADE_DESCRIPTION = {
  A: { fr: 'Securite exemplaire, continuez ainsi.', en: 'Exemplary security, keep it up.' },
  B: { fr: 'Bon niveau, quelques ameliorations possibles.', en: 'Good level, a few improvements possible.' },
  C: { fr: 'Niveau moyen, des corrections sont recommandees.', en: 'Average level, fixes are recommended.' },
  D: { fr: 'Niveau faible, corrections importantes a prevoir.', en: 'Weak level, important fixes needed.' },
  E: { fr: 'Niveau critique, action immediate necessaire.', en: 'Critical level, immediate action required.' }
};

// --- Titres et recommandations des controles -------------------------------

const TITLES = {
  https_available: { fr: 'HTTPS disponible', en: 'HTTPS available' },
  cert_valid: { fr: 'Certificat SSL valide et reconnu', en: 'Valid and trusted SSL certificate' },
  cert_expiry: { fr: "Date d'expiration du certificat", en: 'Certificate expiry date' },
  http_redirect: { fr: 'Redirection HTTP vers HTTPS', en: 'HTTP to HTTPS redirect' },
  hsts: { fr: 'HSTS (Strict-Transport-Security)', en: 'HSTS (Strict-Transport-Security)' },
  csp: { fr: 'Content-Security-Policy', en: 'Content-Security-Policy' },
  clickjacking: { fr: 'Anti-clickjacking', en: 'Anti-clickjacking' },
  xcto: { fr: 'X-Content-Type-Options (nosniff)', en: 'X-Content-Type-Options (nosniff)' },
  referrer_policy: { fr: 'Referrer-Policy', en: 'Referrer-Policy' },
  permissions_policy: { fr: 'Permissions-Policy', en: 'Permissions-Policy' },
  spf: { fr: 'SPF (autorisation d\'envoi)', en: 'SPF (send authorization)' },
  dmarc: { fr: 'DMARC (anti-usurpation)', en: 'DMARC (anti-spoofing)' },
  dmarc_policy: { fr: 'Politique DMARC appliquee', en: 'Enforced DMARC policy' },
  mx: { fr: 'Serveurs de messagerie (MX)', en: 'Mail servers (MX)' },
  server_header: { fr: 'Version du serveur (en-tete Server)', en: 'Server version (Server header)' },
  xpb: { fr: 'X-Powered-By', en: 'X-Powered-By' },
  cookies: { fr: 'Cookies Secure / HttpOnly', en: 'Secure / HttpOnly cookies' },
  caa: { fr: 'Enregistrement CAA', en: 'CAA record' }
};

const RECOMMEND = {
  https_available: { fr: 'Activez HTTPS avec un certificat SSL/TLS valide.', en: 'Enable HTTPS with a valid SSL/TLS certificate.' },
  cert_valid: { fr: 'Installez un certificat reconnu correspondant a votre domaine.', en: 'Install a trusted certificate matching your domain.' },
  cert_expiry: { fr: 'Renouvelez le certificat et activez le renouvellement automatique.', en: 'Renew the certificate and enable auto-renewal.' },
  http_redirect: { fr: 'Forcez la redirection de HTTP vers HTTPS.', en: 'Force a redirect from HTTP to HTTPS.' },
  hsts: { fr: "Ajoutez l'en-tete Strict-Transport-Security.", en: 'Add the Strict-Transport-Security header.' },
  csp: { fr: 'Ajoutez une Content-Security-Policy.', en: 'Add a Content-Security-Policy.' },
  clickjacking: { fr: 'Ajoutez X-Frame-Options ou frame-ancestors.', en: 'Add X-Frame-Options or frame-ancestors.' },
  xcto: { fr: 'Ajoutez X-Content-Type-Options: nosniff.', en: 'Add X-Content-Type-Options: nosniff.' },
  referrer_policy: { fr: 'Ajoutez une Referrer-Policy.', en: 'Add a Referrer-Policy.' },
  permissions_policy: { fr: 'Ajoutez une Permissions-Policy.', en: 'Add a Permissions-Policy.' },
  spf: { fr: 'Publiez un enregistrement SPF.', en: 'Publish an SPF record.' },
  dmarc: { fr: 'Publiez un enregistrement DMARC.', en: 'Publish a DMARC record.' },
  dmarc_policy: { fr: 'Durcissez la politique DMARC (quarantine puis reject).', en: 'Tighten the DMARC policy (quarantine then reject).' },
  server_header: { fr: 'Masquez la version du serveur.', en: 'Hide the server version.' },
  xpb: { fr: "Supprimez l'en-tete X-Powered-By.", en: 'Remove the X-Powered-By header.' },
  cookies: { fr: 'Ajoutez les attributs Secure et HttpOnly aux cookies.', en: 'Add the Secure and HttpOnly attributes to cookies.' },
  caa: { fr: 'Ajoutez un enregistrement CAA.', en: 'Add a CAA record.' }
};

// --- Messages et preuves techniques par controle ---------------------------
// Chaque fonction renvoie { message, evidence } localises selon le statut.

const HEADERS_UNAVAILABLE = {
  fr: 'En-tetes HTTP non recuperables : le site semble injoignable.',
  en: 'HTTP headers unavailable: the site appears unreachable.'
};

const TEXT = {
  https_available(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, 'Votre site est accessible en HTTPS, les echanges sont chiffres.', 'Your site is reachable over HTTPS, exchanges are encrypted.'),
        evidence: pick(lang, `Connexion HTTPS etablie${ev.protocol ? ` (${ev.protocol})` : ''}.`, `HTTPS connection established${ev.protocol ? ` (${ev.protocol})` : ''}.`)
      };
    }
    return {
      message: pick(lang, "Aucune connexion HTTPS n'a pu etre etablie : les visiteurs ne sont pas proteges.", 'No HTTPS connection could be established: visitors are not protected.'),
      evidence: pick(lang, `Echec de la connexion HTTPS (${ev.error || 'injoignable'}).`, `HTTPS connection failed (${ev.error || 'unreachable'}).`)
    };
  },
  cert_valid(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, 'Le certificat est reconnu par les navigateurs, aucune alerte affichee.', 'The certificate is trusted by browsers, no warning shown.'),
        evidence: pick(lang, `Certificat reconnu${ev.issuer ? `, emis par ${ev.issuer}` : ''}.`, `Trusted certificate${ev.issuer ? `, issued by ${ev.issuer}` : ''}.`)
      };
    }
    if (ev.reachable === false) {
      return {
        message: pick(lang, "Impossible de verifier le certificat : le site est injoignable en HTTPS.", 'Cannot verify the certificate: the site is unreachable over HTTPS.'),
        evidence: pick(lang, 'Aucun certificat recupere.', 'No certificate retrieved.')
      };
    }
    return {
      message: pick(lang, 'Le certificat provoque une alerte de securite dans le navigateur.', 'The certificate triggers a security warning in the browser.'),
      evidence: pick(lang, `Certificat non reconnu : ${ev.reason || 'non autorise'}.`, `Untrusted certificate: ${ev.reason || 'unauthorized'}.`)
    };
  },
  cert_expiry(status, ev, lang) {
    if (ev.available === false) {
      return {
        message: pick(lang, "Aucune date d'expiration lisible (pas de certificat).", 'No readable expiry date (no certificate).'),
        evidence: pick(lang, 'Certificat indisponible.', 'Certificate unavailable.')
      };
    }
    const d = ev.daysLeft;
    if (status === 'pass') {
      return {
        message: pick(lang, `Le certificat est valide encore ${d} jour(s).`, `The certificate is valid for ${d} more day(s).`),
        evidence: pick(lang, `Valide jusqu'au ${ev.validTo}.`, `Valid until ${ev.validTo}.`)
      };
    }
    if (typeof d === 'number' && d < 0) {
      return {
        message: pick(lang, 'Le certificat est EXPIRE : les visiteurs voient une alerte rouge.', 'The certificate is EXPIRED: visitors see a red warning.'),
        evidence: pick(lang, `Expire depuis ${Math.abs(d)} jour(s) (${ev.validTo}).`, `Expired ${Math.abs(d)} day(s) ago (${ev.validTo}).`)
      };
    }
    return {
      message: pick(lang, `Le certificat expire bientot (${d} jour(s)) : anticipez le renouvellement.`, `The certificate expires soon (${d} day(s)): plan the renewal.`),
      evidence: pick(lang, `Valide jusqu'au ${ev.validTo}.`, `Valid until ${ev.validTo}.`)
    };
  },
  http_redirect(status, ev, lang) {
    if (ev.httpsAvailable === false) {
      return {
        message: pick(lang, "Le site n'est pas disponible en HTTPS, la redirection ne peut pas etre verifiee.", 'The site is not available over HTTPS, the redirect cannot be verified.'),
        evidence: pick(lang, 'HTTPS indisponible.', 'HTTPS unavailable.')
      };
    }
    if (status === 'pass' && ev.port80 === 'closed') {
      return {
        message: pick(lang, "Aucun service HTTP en clair n'est expose (port 80 ferme).", 'No plaintext HTTP service is exposed (port 80 closed).'),
        evidence: pick(lang, 'Port 80 ferme.', 'Port 80 closed.')
      };
    }
    if (status === 'pass') {
      return {
        message: pick(lang, 'Les visiteurs en HTTP sont automatiquement rediriges vers HTTPS.', 'HTTP visitors are automatically redirected to HTTPS.'),
        evidence: pick(lang, `Redirection ${ev.statusCode} vers HTTPS.`, `Redirect ${ev.statusCode} to HTTPS.`)
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, 'Une redirection existe mais ne pointe pas vers HTTPS.', 'A redirect exists but does not point to HTTPS.'),
        evidence: pick(lang, `Redirection ${ev.statusCode}${ev.location ? ` vers ${ev.location}` : ''}.`, `Redirect ${ev.statusCode}${ev.location ? ` to ${ev.location}` : ''}.`)
      };
    }
    return {
      message: pick(lang, 'Le site repond en HTTP sans rediriger vers HTTPS : trafic non chiffre possible.', 'The site answers over HTTP without redirecting to HTTPS: unencrypted traffic is possible.'),
      evidence: pick(lang, `Reponse HTTP ${ev.statusCode} sans redirection.`, `HTTP ${ev.statusCode} response without redirect.`)
    };
  },
  hsts(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, 'Le navigateur est force en HTTPS pour vos visiteurs.', 'Browsers are forced to HTTPS for your visitors.'),
        evidence: pick(lang, `Strict-Transport-Security present (max-age=${ev.maxAge}).`, `Strict-Transport-Security present (max-age=${ev.maxAge}).`)
      };
    }
    if (ev.present === false) {
      return {
        message: pick(lang, "L'en-tete HSTS est absent : le premier acces peut rester en HTTP.", 'The HSTS header is missing: the first visit may stay on HTTP.'),
        evidence: pick(lang, 'Strict-Transport-Security absent.', 'Strict-Transport-Security missing.')
      };
    }
    return {
      message: pick(lang, "La duree de l'en-tete HSTS est trop courte.", 'The HSTS header duration is too short.'),
      evidence: pick(lang, `max-age=${ev.maxAge} (recommande: 31536000).`, `max-age=${ev.maxAge} (recommended: 31536000).`)
    };
  },
  csp(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, 'Une politique de securite du contenu limite les scripts non autorises.', 'A content security policy limits unauthorized scripts.'),
        evidence: pick(lang, 'Content-Security-Policy present.', 'Content-Security-Policy present.')
      };
    }
    if (ev.reportOnly) {
      return {
        message: pick(lang, 'La CSP est en mode rapport uniquement : elle ne bloque encore rien.', 'The CSP is report-only: it does not block anything yet.'),
        evidence: pick(lang, 'Content-Security-Policy-Report-Only present.', 'Content-Security-Policy-Report-Only present.')
      };
    }
    return {
      message: pick(lang, "Aucune Content-Security-Policy : protection reduite contre l'injection de scripts (XSS).", 'No Content-Security-Policy: reduced protection against script injection (XSS).'),
      evidence: pick(lang, 'Content-Security-Policy absent.', 'Content-Security-Policy missing.')
    };
  },
  clickjacking(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, "Votre site ne peut pas etre pieg dans une iframe malveillante.", 'Your site cannot be trapped in a malicious iframe.'),
        evidence: pick(lang, `Protection presente${ev.xFrameOptions ? ` (X-Frame-Options: ${ev.xFrameOptions})` : ' (frame-ancestors)'}.`, `Protection present${ev.xFrameOptions ? ` (X-Frame-Options: ${ev.xFrameOptions})` : ' (frame-ancestors)'}.`)
      };
    }
    return {
      message: pick(lang, 'Aucune protection anti-clickjacking : le site peut etre integre dans une page piegee.', 'No anti-clickjacking protection: the site can be embedded in a trap page.'),
      evidence: pick(lang, 'X-Frame-Options et frame-ancestors absents.', 'X-Frame-Options and frame-ancestors missing.')
    };
  },
  xcto(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, 'Le navigateur ne devine plus le type des fichiers (moins de risques).', 'The browser no longer guesses file types (fewer risks).'),
        evidence: 'X-Content-Type-Options: nosniff.'
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, 'La valeur de X-Content-Type-Options est inattendue.', 'The X-Content-Type-Options value is unexpected.'),
        evidence: `X-Content-Type-Options: ${ev.value}.`
      };
    }
    return {
      message: pick(lang, "L'en-tete X-Content-Type-Options est absent.", 'The X-Content-Type-Options header is missing.'),
      evidence: pick(lang, 'X-Content-Type-Options absent.', 'X-Content-Type-Options missing.')
    };
  },
  referrer_policy(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, 'Les informations envoyees aux sites tiers sont limitees.', 'Information sent to third-party sites is limited.'),
        evidence: `Referrer-Policy: ${ev.value}.`
      };
    }
    return {
      message: pick(lang, "L'en-tete Referrer-Policy est absent.", 'The Referrer-Policy header is missing.'),
      evidence: pick(lang, 'Referrer-Policy absent.', 'Referrer-Policy missing.')
    };
  },
  permissions_policy(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, 'Les fonctionnalites sensibles du navigateur (camera, micro) sont encadrees.', 'Sensitive browser features (camera, mic) are restricted.'),
        evidence: pick(lang, 'Permissions-Policy present.', 'Permissions-Policy present.')
      };
    }
    return {
      message: pick(lang, "L'en-tete Permissions-Policy est absent.", 'The Permissions-Policy header is missing.'),
      evidence: pick(lang, 'Permissions-Policy absent.', 'Permissions-Policy missing.')
    };
  },
  spf(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, "Vous declarez qui peut envoyer des e-mails en votre nom : usurpation plus difficile.", 'You declare who may send e-mail on your behalf: spoofing is harder.'),
        evidence: pick(lang, `SPF present : ${ev.record}`, `SPF present: ${ev.record}`)
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, 'Plusieurs enregistrements SPF sont presents : a fusionner en un seul.', 'Several SPF records are present: they must be merged into one.'),
        evidence: pick(lang, `${(ev.records || []).length} enregistrements SPF.`, `${(ev.records || []).length} SPF records.`)
      };
    }
    return {
      message: pick(lang, "Aucun SPF : n'importe qui peut usurper votre domaine dans des e-mails.", 'No SPF: anyone can spoof your domain in e-mails.'),
      evidence: pick(lang, 'Aucun enregistrement SPF.', 'No SPF record.')
    };
  },
  dmarc(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, "Une politique DMARC protege votre marque contre l'usurpation par e-mail.", 'A DMARC policy protects your brand against e-mail spoofing.'),
        evidence: pick(lang, `DMARC present : ${ev.record}`, `DMARC present: ${ev.record}`)
      };
    }
    return {
      message: pick(lang, "Aucun DMARC : votre domaine peut etre usurpe pour du phishing.", 'No DMARC: your domain can be spoofed for phishing.'),
      evidence: pick(lang, 'Aucun enregistrement DMARC.', 'No DMARC record.')
    };
  },
  dmarc_policy(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, 'La politique DMARC est en rejet : les e-mails usurpes sont bloques.', 'The DMARC policy is in reject mode: spoofed e-mails are blocked.'),
        evidence: 'p=reject.'
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, 'La politique DMARC est en quarantaine : protection partielle.', 'The DMARC policy is in quarantine mode: partial protection.'),
        evidence: 'p=quarantine.'
      };
    }
    if (ev.policy === 'none') {
      return {
        message: pick(lang, "La politique DMARC est en observation (p=none) : aucune protection appliquee.", 'The DMARC policy is in monitoring mode (p=none): no protection enforced.'),
        evidence: 'p=none.'
      };
    }
    return {
      message: pick(lang, "Aucune politique DMARC applicable (pas de DMARC).", 'No enforceable DMARC policy (no DMARC).'),
      evidence: pick(lang, 'DMARC absent.', 'DMARC missing.')
    };
  },
  mx(status, ev, lang) {
    if (ev.count > 0) {
      return {
        message: pick(lang, 'Des serveurs de messagerie sont configures pour ce domaine.', 'Mail servers are configured for this domain.'),
        evidence: pick(lang, `Serveurs MX : ${(ev.servers || []).join(', ')}.`, `MX servers: ${(ev.servers || []).join(', ')}.`)
      };
    }
    return {
      message: pick(lang, "Aucun serveur de messagerie (le domaine ne recoit pas d'e-mails).", 'No mail server (the domain does not receive e-mail).'),
      evidence: pick(lang, 'Aucun enregistrement MX.', 'No MX record.')
    };
  },
  server_header(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, "Le serveur ne divulgue pas d'information de version.", 'The server does not disclose version information.'),
        evidence: pick(lang, 'En-tete Server absent.', 'Server header absent.')
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, 'Le serveur divulgue sa version : cela facilite le ciblage de failles connues.', 'The server discloses its version: this helps attackers target known flaws.'),
        evidence: `Server: ${ev.value}.`
      };
    }
    return {
      message: pick(lang, 'Le serveur annonce son nom sans numero de version.', 'The server announces its name without a version number.'),
      evidence: `Server: ${ev.value}.`
    };
  },
  xpb(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (status === 'pass') {
      return {
        message: pick(lang, "Aucune technologie n'est divulguee via X-Powered-By.", 'No technology is disclosed via X-Powered-By.'),
        evidence: pick(lang, 'X-Powered-By absent.', 'X-Powered-By absent.')
      };
    }
    return {
      message: pick(lang, 'Le site divulgue sa technologie (X-Powered-By) : information utile a un attaquant.', 'The site discloses its technology (X-Powered-By): useful information for an attacker.'),
      evidence: `X-Powered-By: ${ev.value}.`
    };
  },
  cookies(status, ev, lang) {
    if (ev.headersAvailable === false) return { message: HEADERS_UNAVAILABLE[L(lang)], evidence: '' };
    if (ev.count === 0) {
      return {
        message: pick(lang, "Aucun cookie n'est depose sur la page d'accueil.", 'No cookie is set on the home page.'),
        evidence: pick(lang, 'Aucun cookie.', 'No cookie.')
      };
    }
    if (status === 'pass') {
      return {
        message: pick(lang, 'Les cookies sont proteges (Secure et HttpOnly).', 'Cookies are protected (Secure and HttpOnly).'),
        evidence: pick(lang, `${ev.count} cookie(s), attributs corrects.`, `${ev.count} cookie(s), correct attributes.`)
      };
    }
    if (status === 'warn') {
      return {
        message: pick(lang, "Certains cookies n'ont pas l'attribut HttpOnly (accessibles par JavaScript).", 'Some cookies lack the HttpOnly attribute (accessible from JavaScript).'),
        evidence: pick(lang, 'Attribut HttpOnly manquant.', 'HttpOnly attribute missing.')
      };
    }
    return {
      message: pick(lang, "Certains cookies n'ont pas l'attribut Secure : ils peuvent circuler en clair.", 'Some cookies lack the Secure attribute: they can travel unencrypted.'),
      evidence: pick(lang, 'Attribut Secure manquant.', 'Secure attribute missing.')
    };
  },
  caa(status, ev, lang) {
    if (status === 'pass') {
      return {
        message: pick(lang, "Vous limitez les autorites autorisees a emettre des certificats pour votre domaine.", 'You restrict which authorities may issue certificates for your domain.'),
        evidence: pick(lang, `CAA present : ${(ev.issuers || []).join(', ')}.`, `CAA present: ${(ev.issuers || []).join(', ')}.`)
      };
    }
    return {
      message: pick(lang, "Aucun enregistrement CAA : n'importe quelle autorite peut emettre un certificat pour votre domaine.", 'No CAA record: any authority can issue a certificate for your domain.'),
      evidence: pick(lang, 'Aucun enregistrement CAA.', 'No CAA record.')
    };
  }
};

// --- Textes de section (rapport) ------------------------------------------

const UI = {
  reportTitle: { fr: "Rapport d'audit de securite", en: 'Security audit report' },
  domain: { fr: 'Domaine', en: 'Domain' },
  sector: { fr: 'Secteur', en: 'Sector' },
  date: { fr: 'Date', en: 'Date' },
  depth: { fr: "Profondeur d'audit", en: 'Audit depth' },
  score: { fr: 'Score de securite', en: 'Security score' },
  grade: { fr: 'Note', en: 'Grade' },
  outOf100: { fr: 'sur 100', en: 'out of 100' },
  toFix: { fr: 'A corriger', en: 'To fix' },
  toImprove: { fr: 'A ameliorer', en: 'To improve' },
  compliant: { fr: 'Conformes', en: 'Compliant' },
  exposureTitle: { fr: 'Exposition financiere estimee', en: 'Estimated financial exposure' },
  exposureDisclaimer: { fr: 'Estimation indicative, a titre de sensibilisation.', en: 'Indicative estimate, for awareness purposes.' },
  sectorNoteTitle: { fr: 'Enjeux de votre secteur', en: 'Stakes in your sector' },
  summaryTitle: { fr: 'Synthese par categorie', en: 'Summary by category' },
  priorityTitle: { fr: 'Actions prioritaires', en: 'Priority actions' },
  detailTitle: { fr: 'Detail des controles', en: 'Detailed checks' },
  remediationTitle: { fr: 'Guide de correction pas a pas', en: 'Step-by-step remediation guide' },
  methodologyTitle: { fr: 'Methodologie et rappel legal', en: 'Methodology and legal notice' },
  evidence: { fr: 'Preuve technique', en: 'Technical evidence' },
  recommendation: { fr: 'Recommandation', en: 'Recommendation' },
  howToFix: { fr: 'Comment corriger', en: 'How to fix' },
  steps: { fr: 'etapes', en: 'steps' },
  page: { fr: 'Page', en: 'Page' },
  category: { fr: 'Categorie', en: 'Category' },
  status: { fr: 'Statut', en: 'Status' },
  noIssues: { fr: 'Aucune faille detectee, felicitations.', en: 'No issue detected, congratulations.' },
  priority: { fr: 'Priorite', en: 'Priority' },
  generatedBy: { fr: 'Rapport genere par', en: 'Report generated by' }
};

const METHODOLOGY = {
  fr: "Cet audit est realise a distance, de maniere passive et non intrusive. Il s'appuie uniquement sur des informations publiques : la poignee de main TLS (certificat), les en-tetes HTTP renvoyes par le serveur et les enregistrements DNS publics (SPF, DMARC, MX, CAA). Aucun test d'intrusion, aucune tentative d'exploitation ni d'acces non autorise n'est effectue. Les resultats refletent l'etat observe au moment du scan et peuvent evoluer.",
  en: 'This audit is performed remotely, passively and non-intrusively. It relies only on public information: the TLS handshake (certificate), the HTTP headers returned by the server and public DNS records (SPF, DMARC, MX, CAA). No penetration testing, no exploitation attempt and no unauthorized access is performed. The results reflect the state observed at scan time and may change.'
};
const LEGAL = {
  fr: (brand) => `Ce rapport est fourni a titre informatif et de sensibilisation. Les montants d'exposition financiere sont des estimations indicatives et ne constituent ni un devis, ni une garantie, ni un conseil juridique. N'auditez que des domaines qui vous appartiennent ou pour lesquels vous disposez d'une autorisation. ${brand} ne saurait etre tenu responsable de l'usage fait de ce rapport.`,
  en: (brand) => `This report is provided for information and awareness purposes. The financial exposure amounts are indicative estimates and constitute neither a quote, a warranty, nor legal advice. Only audit domains that you own or for which you have authorization. ${brand} cannot be held responsible for the use made of this report.`
};

// --- Fonction describe -----------------------------------------------------

/** Renvoie le libelle traduit d'une cle UI. */
function t(key, lang) {
  const entry = UI[key];
  if (!entry) return key;
  return entry[L(lang)];
}

/** Formate une date ISO en date lisible localisee. */
function formatDate(iso, lang) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const monthsFr = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = d.getDate();
  const month = (L(lang) === 'en' ? monthsEn : monthsFr)[d.getMonth()];
  const year = d.getFullYear();
  return L(lang) === 'en' ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

const DEPTH_LABELS = {
  quick: { fr: 'Rapide', en: 'Quick' },
  standard: { fr: 'Standard', en: 'Standard' },
  deep: { fr: 'Approfondi', en: 'Deep' }
};

/**
 * Transforme un resultat BRUT en modele entierement localise.
 * @param {object} raw resultat du scanner
 * @param {object} ctx { lang, sector, currency, template, tone, brand, accent }
 */
function describe(raw, ctx = {}) {
  const lang = L(ctx.lang);
  const brand = (ctx.brand && String(ctx.brand).trim()) || 'CyberAudit';
  const accent = ctx.accent || '#F26419';
  const sectorId = ctx.sector || 'general';
  const currency = ctx.currency || 'EUR';
  const template = ['client', 'technical', 'exec'].includes(ctx.template) ? ctx.template : 'client';
  const tone = ctx.tone || 'direct';

  // Localisation de chaque controle.
  const localizedChecks = (raw.checks || []).map((c) => {
    const textFn = TEXT[c.id] || (() => ({ message: '', evidence: '' }));
    const parts = textFn(c.status, c.evidence || {}, lang) || {};
    const isPass = c.status === 'pass';
    const isInfo = c.status === 'info';
    return {
      id: c.id,
      category: c.category,
      categoryLabel: CATEGORY_LABELS[c.category] ? CATEGORY_LABELS[c.category][lang] : c.category,
      title: TITLES[c.id] ? TITLES[c.id][lang] : c.id,
      status: c.status,
      statusLabel: STATUS_LABELS[c.status][lang],
      statusColor: STATUS_COLORS[c.status],
      weight: c.weight,
      message: parts.message || '',
      evidence: parts.evidence || '',
      recommendation: !isPass && !isInfo && RECOMMEND[c.id] ? RECOMMEND[c.id][lang] : '',
      remediation: !isPass && !isInfo ? remediation.steps(c.id, lang) : []
    };
  });

  // Regroupement par categorie (ordre fixe).
  const categories = CATEGORY_ORDER
    .map((key) => ({
      key,
      label: CATEGORY_LABELS[key][lang],
      checks: localizedChecks.filter((c) => c.category === key)
    }))
    .filter((cat) => cat.checks.length > 0);

  // Actions prioritaires : failles triees (a corriger avant a ameliorer, puis poids).
  const severityRank = { fail: 2, warn: 1 };
  const issues = localizedChecks
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .sort((a, b) => (severityRank[b.status] - severityRank[a.status]) || (b.weight - a.weight));

  const priorityActions = issues.slice(0, 6).map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    statusLabel: c.statusLabel,
    statusColor: c.statusColor,
    recommendation: c.recommendation
  }));

  // Guide de correction complet (toutes les failles triees), pour le PDF.
  const remediationGuide = issues.map((c, i) => ({
    rank: i + 1,
    id: c.id,
    title: c.title,
    status: c.status,
    statusLabel: c.statusLabel,
    statusColor: c.statusColor,
    recommendation: c.recommendation,
    steps: c.remediation
  }));

  // Exposition financiere estimee.
  const exposure = risk.estimate(raw, sectorId, currency);
  const exposureLabel = {
    title: t('exposureTitle', lang),
    disclaimer: t('exposureDisclaimer', lang)
  };

  // Note lettre.
  const gradeKey = raw.gradeKey || 'E';
  const grade = GRADE[gradeKey] || GRADE.E;

  // Message de prospection (regenere a chaque langue).
  const outreachMsg = outreach.message({
    lang,
    tone,
    brand,
    domain: raw.domain,
    sectorLabel: sectors.label(sectorId, lang),
    score: raw.score,
    gradeLabel: grade.label[lang],
    failCount: raw.counts.fail,
    warnCount: raw.counts.warn,
    topIssues: priorityActions.map((a) => a.title),
    exposureRange: exposure.rangeFormatted,
    hasRisk: exposure.hasRisk
  });

  return {
    version: 1,
    lang,
    generatedAt: raw.scannedAt,
    generatedAtLabel: formatDate(raw.scannedAt, lang),
    brand,
    accent,
    template,
    currency,
    tone,
    domain: raw.domain,
    host: raw.host,
    webHost: raw.webHost,
    reachable: raw.reachable,
    depth: raw.depth,
    depthLabel: DEPTH_LABELS[raw.depth] ? DEPTH_LABELS[raw.depth][lang] : raw.depth,
    score: raw.score,
    gradeKey,
    gradeLabel: grade.label[lang],
    gradeColor: grade.color,
    gradeDescription: (GRADE_DESCRIPTION[gradeKey] || GRADE_DESCRIPTION.E)[lang],
    counts: raw.counts,
    countsLabel: {
      fail: t('toFix', lang),
      warn: t('toImprove', lang),
      pass: t('compliant', lang)
    },
    sector: {
      id: sectorId,
      label: sectors.label(sectorId, lang),
      note: sectors.note(sectorId, lang),
      coefficient: sectors.coefficient(sectorId)
    },
    exposure: { ...exposure, ...exposureLabel },
    categories,
    priorityActions,
    remediationGuide,
    outreach: outreachMsg,
    methodology: METHODOLOGY[lang],
    legal: LEGAL[lang](brand),
    ui: Object.keys(UI).reduce((acc, k) => { acc[k] = UI[k][lang]; return acc; }, {}),
    statusLabels: {
      pass: STATUS_LABELS.pass[lang],
      warn: STATUS_LABELS.warn[lang],
      fail: STATUS_LABELS.fail[lang],
      info: STATUS_LABELS.info[lang]
    }
  };
}

module.exports = {
  describe,
  t,
  formatDate,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  GRADE,
  DEPTH_LABELS,
  TITLES
};
