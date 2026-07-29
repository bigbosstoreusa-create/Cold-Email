'use strict';

/**
 * Module SECTEURS
 * -------------------------------------------------------------------------
 * Liste des 26 secteurs d'activite proposes dans le menu deroulant.
 * Chaque secteur porte :
 *   - un identifiant stable (neutre, non traduit) utilise cote reseau/brut ;
 *   - un libelle bilingue (fr / en) ;
 *   - un coefficient de risque sectoriel (multiplicateur de l'exposition
 *     financiere estimee : plus les donnees sont sensibles / regulees, plus
 *     il est eleve) ;
 *   - une note d'enjeux bilingue (donnees en jeu, reglementation, risques).
 *
 * Les libelles et notes ne contiennent volontairement aucun caractere hors
 * police standard (pas de fleche Unicode, pas d'espace insecable etroite),
 * afin d'etre reutilisables tels quels dans le rendu PDF (PDFKit / Helvetica).
 */

// Ordre d'affichage impose par le cahier des charges.
const SECTORS = [
  {
    id: 'ecommerce',
    fr: 'E-commerce',
    en: 'E-commerce',
    coefficient: 1.45,
    note: {
      fr: "Boutique en ligne : paiements par carte, comptes clients et donnees personnelles. Vous etes concerne par le RGPD et, des que vous touchez a la carte bancaire, par la norme PCI-DSS. Un site mal securise expose au vol de donnees de paiement, au detournement de commandes et a une lourde perte de confiance.",
      en: 'Online store: card payments, customer accounts and personal data. You are subject to GDPR and, as soon as card data is involved, to the PCI-DSS standard. A poorly secured site exposes you to payment data theft, order hijacking and a heavy loss of trust.'
    }
  },
  {
    id: 'restaurant',
    fr: 'Restaurant / Cafe / Bar',
    en: 'Restaurant / Cafe / Bar',
    coefficient: 1.0,
    note: {
      fr: "Restauration : reservations, formulaires de contact et parfois commande/paiement en ligne. Les donnees de reservation (nom, telephone, e-mail) relevent du RGPD. Le principal risque est l'usurpation de votre nom de domaine pour de faux e-mails et la degradation de l'image via un site non securise.",
      en: 'Food service: bookings, contact forms and sometimes online ordering/payment. Booking data (name, phone, e-mail) falls under GDPR. The main risk is domain spoofing for fake e-mails and brand damage from an insecure site.'
    }
  },
  {
    id: 'hospitality',
    fr: 'Hotellerie / Tourisme',
    en: 'Hospitality / Tourism',
    coefficient: 1.25,
    note: {
      fr: "Hotellerie et tourisme : reservations en ligne, pieces d'identite, paiements et donnees de sejour. Le RGPD et souvent le PCI-DSS s'appliquent. Une faille peut exposer les coordonnees et les paiements de vos clients, avec un fort impact sur la reputation et les avis.",
      en: 'Hospitality and tourism: online bookings, ID documents, payments and stay data. GDPR and often PCI-DSS apply. A breach can expose your guests\' contact and payment details, with a strong impact on reputation and reviews.'
    }
  },
  {
    id: 'health',
    fr: 'Sante / Medical',
    en: 'Health / Medical',
    coefficient: 1.6,
    note: {
      fr: "Sante : les donnees de patients sont des donnees sensibles au sens du RGPD, protegees par le secret medical. Un incident de securite peut entrainer des sanctions lourdes et une atteinte grave a la vie privee. Le chiffrement, l'anti-usurpation e-mail et la confidentialite sont ici prioritaires.",
      en: 'Healthcare: patient data is sensitive data under GDPR, protected by medical confidentiality. A security incident can lead to heavy penalties and serious privacy harm. Encryption, e-mail anti-spoofing and confidentiality are top priorities here.'
    }
  },
  {
    id: 'legal',
    fr: 'Avocat / Notaire',
    en: 'Lawyer / Notary',
    coefficient: 1.45,
    note: {
      fr: "Professions du droit : dossiers confidentiels couverts par le secret professionnel. La moindre fuite (e-mail usurpe, site compromis) peut engager votre responsabilite et nuire a vos clients. La securite du domaine et des e-mails est un enjeu de confiance central.",
      en: 'Legal professions: confidential files covered by professional secrecy. Any leak (spoofed e-mail, compromised site) can trigger your liability and harm your clients. Domain and e-mail security are a central trust issue.'
    }
  },
  {
    id: 'accounting',
    fr: 'Comptabilite',
    en: 'Accounting',
    coefficient: 1.4,
    note: {
      fr: "Comptabilite : donnees financieres, fiches de paie et pieces sensibles de vos clients. Cible privilegiee des fraudes au virement et de l'usurpation d'identite par e-mail. L'authentification e-mail (SPF/DMARC) et le chiffrement sont determinants.",
      en: 'Accounting: financial data, payslips and sensitive client documents. A prime target for wire-transfer fraud and e-mail identity spoofing. E-mail authentication (SPF/DMARC) and encryption are decisive.'
    }
  },
  {
    id: 'finance',
    fr: 'Banque / Assurance / Finance',
    en: 'Banking / Insurance / Finance',
    coefficient: 1.6,
    note: {
      fr: "Finance : secteur fortement regule (RGPD, PCI-DSS, exigences sectorielles). Les donnees financieres et d'identite sont extremement convoitees. Le phishing par usurpation de domaine est la premiere menace : SPF, DMARC en rejet et TLS solide sont indispensables.",
      en: 'Finance: a heavily regulated sector (GDPR, PCI-DSS, sector requirements). Financial and identity data are highly coveted. Domain-spoofing phishing is the top threat: SPF, DMARC in reject mode and strong TLS are essential.'
    }
  },
  {
    id: 'realestate',
    fr: 'Immobilier',
    en: 'Real estate',
    coefficient: 1.25,
    note: {
      fr: "Immobilier : mandats, pieces justificatives et virements de depots de garantie. Les fraudes au faux conseiller et au virement detourne sont frequentes. Proteger le domaine contre l'usurpation e-mail et securiser le site limite fortement ce risque.",
      en: 'Real estate: mandates, supporting documents and deposit transfers. Fake-advisor and diverted-transfer fraud are common. Protecting the domain against e-mail spoofing and securing the site strongly reduces this risk.'
    }
  },
  {
    id: 'construction',
    fr: 'BTP / Artisanat',
    en: 'Construction / Trades',
    coefficient: 0.95,
    note: {
      fr: "BTP et artisanat : devis, factures et coordonnees clients. Le risque principal est la fraude a la facture et l'usurpation d'e-mail pour detourner des paiements. Un site vitrine securise et une authentification e-mail correcte protegent votre reputation.",
      en: 'Construction and trades: quotes, invoices and client details. The main risk is invoice fraud and e-mail spoofing to divert payments. A secure showcase site and proper e-mail authentication protect your reputation.'
    }
  },
  {
    id: 'education',
    fr: 'Ecole / Formation',
    en: 'School / Training',
    coefficient: 1.2,
    note: {
      fr: "Education et formation : donnees d'eleves et d'apprenants, parfois mineurs, donc sensibles au regard du RGPD. Comptes en ligne et paiements de frais. Le chiffrement, la protection des comptes et l'anti-usurpation e-mail sont a soigner.",
      en: 'Education and training: student and learner data, sometimes minors, hence sensitive under GDPR. Online accounts and fee payments. Encryption, account protection and e-mail anti-spoofing must be well handled.'
    }
  },
  {
    id: 'nonprofit',
    fr: 'Association / ONG',
    en: 'Nonprofit / NGO',
    coefficient: 1.0,
    note: {
      fr: "Association ou ONG : fichiers d'adherents, de donateurs et dons en ligne. Les donnees des donateurs relevent du RGPD et la confiance est vitale pour la collecte. Securiser les paiements et empecher l'usurpation de votre domaine protege vos donateurs.",
      en: 'Nonprofit or NGO: member and donor files, and online donations. Donor data falls under GDPR and trust is vital for fundraising. Securing payments and preventing domain spoofing protects your donors.'
    }
  },
  {
    id: 'industry',
    fr: 'Industrie',
    en: 'Industry',
    coefficient: 1.15,
    note: {
      fr: "Industrie : propriete intellectuelle, donnees de production et relations fournisseurs. Cible d'espionnage et de fraude au president. Proteger les e-mails contre l'usurpation et securiser les acces publics reduit fortement le risque.",
      en: 'Industry: intellectual property, production data and supplier relationships. A target for espionage and CEO fraud. Protecting e-mails against spoofing and securing public access strongly reduces the risk.'
    }
  },
  {
    id: 'logistics',
    fr: 'Transport / Logistique',
    en: 'Transport / Logistics',
    coefficient: 1.1,
    note: {
      fr: "Transport et logistique : suivi de commandes, coordonnees clients et facturation. Les fraudes a la livraison et au virement sont courantes. Une chaine e-mail authentifiee (SPF/DMARC) et un site securise sont essentiels.",
      en: 'Transport and logistics: order tracking, customer details and invoicing. Delivery and transfer fraud are common. An authenticated e-mail chain (SPF/DMARC) and a secure site are essential.'
    }
  },
  {
    id: 'marketing',
    fr: 'Agence marketing',
    en: 'Marketing agency',
    coefficient: 1.1,
    note: {
      fr: "Agence marketing : vous gerez la reputation et parfois les acces de vos clients. Un domaine usurpe ou un site non securise nuit directement a votre credibilite. Montrer l'exemple sur la securite est un argument commercial fort.",
      en: 'Marketing agency: you manage clients\' reputation and sometimes their access. A spoofed domain or insecure site directly harms your credibility. Leading by example on security is a strong sales argument.'
    }
  },
  {
    id: 'webit',
    fr: 'Agence web / IT / SaaS',
    en: 'Web / IT / SaaS agency',
    coefficient: 1.3,
    note: {
      fr: "Agence web, IT ou SaaS : vous heberger des donnees et des acces critiques pour vos clients. Le niveau d'exigence attendu est eleve. En-tetes de securite, TLS moderne et anti-usurpation e-mail sont a la fois une obligation et une vitrine de votre serieux.",
      en: 'Web, IT or SaaS agency: you host critical data and access for your clients. The expected bar is high. Security headers, modern TLS and e-mail anti-spoofing are both an obligation and a showcase of your seriousness.'
    }
  },
  {
    id: 'retail',
    fr: 'Commerce de detail',
    en: 'Retail',
    coefficient: 1.1,
    note: {
      fr: "Commerce de detail : programme de fidelite, coordonnees clients et parfois vente en ligne. Le RGPD s'applique aux fichiers clients. Securiser le site et le domaine e-mail protege votre relation client et vos campagnes.",
      en: 'Retail: loyalty programs, customer details and sometimes online sales. GDPR applies to customer files. Securing the site and the e-mail domain protects your customer relationship and campaigns.'
    }
  },
  {
    id: 'beauty',
    fr: 'Beaute / Coiffure / Spa',
    en: 'Beauty / Hair / Spa',
    coefficient: 1.0,
    note: {
      fr: "Beaute, coiffure et spa : prise de rendez-vous en ligne et coordonnees clients. Les donnees de reservation relevent du RGPD. Le risque courant est l'usurpation du domaine pour de faux messages et un site vitrine non securise qui inquiete les clients.",
      en: 'Beauty, hair and spa: online booking and customer details. Booking data falls under GDPR. The common risk is domain spoofing for fake messages and an insecure showcase site that worries customers.'
    }
  },
  {
    id: 'sport',
    fr: 'Sport / Fitness',
    en: 'Sport / Fitness',
    coefficient: 1.0,
    note: {
      fr: "Sport et fitness : abonnements, comptes membres et paiements recurrents. Les donnees des adherents relevent du RGPD. Securiser les comptes et les paiements en ligne, et proteger le domaine e-mail, est primordial.",
      en: 'Sport and fitness: memberships, member accounts and recurring payments. Member data falls under GDPR. Securing accounts and online payments, and protecting the e-mail domain, is essential.'
    }
  },
  {
    id: 'automotive',
    fr: 'Automobile / Garage',
    en: 'Automotive / Garage',
    coefficient: 1.0,
    note: {
      fr: "Automobile et garage : devis, prises de rendez-vous et coordonnees clients. Le risque principal est la fraude a la facture et l'usurpation d'e-mail. Un site securise et une authentification e-mail correcte renforcent la confiance.",
      en: 'Automotive and garage: quotes, appointments and customer details. The main risk is invoice fraud and e-mail spoofing. A secure site and proper e-mail authentication build trust.'
    }
  },
  {
    id: 'food',
    fr: 'Agroalimentaire',
    en: 'Food industry',
    coefficient: 1.1,
    note: {
      fr: "Agroalimentaire : relations fournisseurs, tracabilite et commandes B2B. Cible de fraude au virement et d'usurpation d'identite. Proteger la chaine e-mail et securiser les acces publics limite les detournements de paiement.",
      en: 'Food industry: supplier relationships, traceability and B2B orders. A target for transfer fraud and identity spoofing. Protecting the e-mail chain and securing public access limits payment diversion.'
    }
  },
  {
    id: 'energy',
    fr: 'Energie',
    en: 'Energy',
    coefficient: 1.3,
    note: {
      fr: "Energie : secteur strategique et regule, souvent considere comme infrastructure critique. Les donnees clients et les acces techniques sont sensibles. Un TLS solide, des en-tetes de securite stricts et une authentification e-mail forte sont attendus.",
      en: 'Energy: a strategic, regulated sector, often treated as critical infrastructure. Customer data and technical access are sensitive. Strong TLS, strict security headers and strong e-mail authentication are expected.'
    }
  },
  {
    id: 'publicadmin',
    fr: 'Administration publique',
    en: 'Public administration',
    coefficient: 1.4,
    note: {
      fr: "Administration publique : donnees citoyennes sensibles et forte exigence de confiance. Cible frequente de phishing par usurpation de domaine. Le chiffrement, l'anti-usurpation e-mail (DMARC en rejet) et l'accessibilite securisee sont prioritaires.",
      en: 'Public administration: sensitive citizen data and a high trust requirement. A frequent target of domain-spoofing phishing. Encryption, e-mail anti-spoofing (DMARC in reject mode) and secure access are priorities.'
    }
  },
  {
    id: 'media',
    fr: 'Media / Presse',
    en: 'Media / Press',
    coefficient: 1.1,
    note: {
      fr: "Media et presse : forte visibilite, abonnements et protection des sources. Un site defigure ou un domaine usurpe nuit immediatement a la credibilite. Les en-tetes de securite et l'anti-usurpation e-mail protegent l'audience et la marque.",
      en: 'Media and press: high visibility, subscriptions and source protection. A defaced site or spoofed domain immediately harms credibility. Security headers and e-mail anti-spoofing protect the audience and the brand.'
    }
  },
  {
    id: 'events',
    fr: 'Evenementiel',
    en: 'Events',
    coefficient: 1.0,
    note: {
      fr: "Evenementiel : billetterie en ligne, listes de participants et paiements. Les pics de trafic attirent la fraude a la billetterie. Securiser les paiements, le site et le domaine e-mail protege vos participants et vos revenus.",
      en: 'Events: online ticketing, attendee lists and payments. Traffic spikes attract ticketing fraud. Securing payments, the site and the e-mail domain protects your attendees and revenue.'
    }
  },
  {
    id: 'liberal',
    fr: 'Profession liberale',
    en: 'Liberal profession',
    coefficient: 1.1,
    note: {
      fr: "Profession liberale : dossiers clients confidentiels et prises de rendez-vous. Selon l'activite, secret professionnel et RGPD s'appliquent. Proteger le domaine contre l'usurpation e-mail et chiffrer les echanges est essentiel a la confiance.",
      en: 'Liberal profession: confidential client files and appointments. Depending on the activity, professional secrecy and GDPR apply. Protecting the domain against e-mail spoofing and encrypting exchanges is essential to trust.'
    }
  },
  {
    id: 'general',
    fr: 'Autre / Generaliste',
    en: 'Other / General',
    coefficient: 1.0,
    note: {
      fr: "Activite generaliste : les bonnes pratiques de securite s'appliquent a tout site professionnel. Le chiffrement HTTPS, des en-tetes de securite corrects et une authentification e-mail (SPF/DMARC) protegent vos clients et votre reputation, quel que soit votre metier.",
      en: 'General activity: security best practices apply to any professional website. HTTPS encryption, proper security headers and e-mail authentication (SPF/DMARC) protect your clients and reputation, whatever your business.'
    }
  }
];

// Index par identifiant pour un acces direct O(1).
const BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

/**
 * Retourne un secteur par son identifiant (ou le secteur generaliste par
 * defaut si l'identifiant est inconnu, pour ne jamais casser le rendu).
 */
function get(id) {
  return BY_ID.get(id) || BY_ID.get('general');
}

/**
 * Liste des secteurs formatee pour un menu deroulant dans la langue demandee.
 * Renvoie [{ id, label }].
 */
function list(lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return SECTORS.map((s) => ({ id: s.id, label: s[l] }));
}

/**
 * Note d'enjeux d'un secteur dans la langue demandee.
 */
function note(id, lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return get(id).note[l];
}

/**
 * Libelle d'un secteur dans la langue demandee.
 */
function label(id, lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return get(id)[l];
}

/**
 * Coefficient de risque sectoriel (multiplicateur de l'exposition financiere).
 */
function coefficient(id) {
  return get(id).coefficient;
}

module.exports = { SECTORS, get, list, note, label, coefficient };
