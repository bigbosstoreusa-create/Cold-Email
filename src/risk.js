'use strict';

/**
 * Module RISQUE (exposition financiere estimee)
 * -------------------------------------------------------------------------
 * Calcule un montant INDICATIF de l'exposition financiere en cas d'incident,
 * sous forme de fourchette basse-haute. Le calcul combine :
 *   - la gravite et le poids des failles detectees (echecs et ameliorations) ;
 *   - un coefficient sectoriel (donnees plus sensibles = risque plus eleve).
 *
 * IMPORTANT : il s'agit d'une ESTIMATION indicative destinee a la
 * sensibilisation, pas d'un calcul actuariel. L'etiquette "estimation
 * indicative" est ajoutee a l'affichage par la couche de mise en forme.
 */

const sectors = require('./sectors');

// Facteur de gravite applique au poids de chaque controle non conforme.
const SEVERITY_FACTOR = { fail: 1.0, warn: 0.4, pass: 0, info: 0 };

// Multiplicateurs monetaires (par "point de risque"), calibres pour des TPE/PME.
const LOW_PER_POINT = 55;
const HIGH_PER_POINT = 240;
// Base fixe (couts minimaux de gestion d'incident) des qu'il existe au moins une faille.
const LOW_BASE = 150;
const HIGH_BASE = 600;

// Devises supportees (taux indicatifs statiques par rapport a l'euro).
const CURRENCIES = {
  EUR: { code: 'EUR', symbol: '€', rate: 1, position: 'suffix' },
  USD: { code: 'USD', symbol: '$', rate: 1.08, position: 'prefix' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.85, position: 'prefix' },
  CAD: { code: 'CAD', symbol: 'CA$', rate: 1.48, position: 'prefix' },
  CHF: { code: 'CHF', symbol: 'CHF', rate: 0.96, position: 'suffix' }
};

/** Arrondit a un multiple donne (pour des montants "propres"). */
function roundTo(value, step) {
  return Math.round(value / step) * step;
}

/** Formate un montant entier avec un separateur de milliers (espace simple). */
function formatAmount(value, currencyCode) {
  const cur = CURRENCIES[currencyCode] || CURRENCIES.EUR;
  const rounded = Math.round(value);
  // Separateur de milliers : espace ASCII standard (compatible PDFKit).
  const digits = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (cur.position === 'prefix') return `${cur.symbol}${digits}`;
  return `${digits} ${cur.symbol}`;
}

/**
 * Estime l'exposition financiere a partir d'un resultat brut de scan.
 * @param {object} raw   resultat brut (avec raw.checks)
 * @param {string} sectorId identifiant de secteur
 * @param {string} currencyCode code devise (EUR/USD/GBP/CAD/CHF)
 */
function estimate(raw, sectorId, currencyCode) {
  const cur = CURRENCIES[currencyCode] ? currencyCode : 'EUR';
  const rate = CURRENCIES[cur].rate;
  const coef = sectors.coefficient(sectorId);

  let points = 0;
  for (const c of raw.checks || []) {
    const factor = SEVERITY_FACTOR[c.status] || 0;
    points += c.weight * factor;
  }

  if (points <= 0) {
    return {
      points: 0,
      hasRisk: false,
      currency: cur,
      symbol: CURRENCIES[cur].symbol,
      sectorCoefficient: coef,
      low: 0,
      high: 0,
      lowFormatted: formatAmount(0, cur),
      highFormatted: formatAmount(0, cur),
      rangeFormatted: `${formatAmount(0, cur)}`
    };
  }

  const lowEur = points * LOW_PER_POINT * coef + LOW_BASE;
  const highEur = points * HIGH_PER_POINT * coef + HIGH_BASE;
  const low = roundTo(lowEur * rate, 50);
  const high = roundTo(highEur * rate, 100);

  return {
    points: Math.round(points * 10) / 10,
    hasRisk: true,
    currency: cur,
    symbol: CURRENCIES[cur].symbol,
    sectorCoefficient: coef,
    low,
    high,
    lowFormatted: formatAmount(low, cur),
    highFormatted: formatAmount(high, cur),
    rangeFormatted: `${formatAmount(low, cur)} - ${formatAmount(high, cur)}`
  };
}

/** Liste des devises pour un menu deroulant. */
function currencyList() {
  return Object.keys(CURRENCIES).map((code) => ({ code, symbol: CURRENCIES[code].symbol }));
}

module.exports = { estimate, currencyList, CURRENCIES, formatAmount };
