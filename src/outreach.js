'use strict';

/**
 * Module OUTREACH (message de prospection automatique)
 * -------------------------------------------------------------------------
 * Genere un e-mail de prospection pret a envoyer au prospect, base sur les
 * resultats de l'audit. Bilingue (fr/en) et decline selon le TON choisi :
 *   - direct  : va droit au but ;
 *   - friendly: chaleureux et accessible ;
 *   - formal  : vouvoiement soutenu ;
 *   - urgent  : insiste sur le risque et le temps.
 *
 * Aucune caractere hors police standard (compatible copier-coller et PDF).
 */

// Formules d'accroche par ton et par langue.
const GREETING = {
  fr: {
    direct: 'Bonjour,',
    friendly: 'Bonjour et merci pour votre temps,',
    formal: 'Madame, Monsieur,',
    urgent: 'Bonjour, un point important concernant votre site :'
  },
  en: {
    direct: 'Hello,',
    friendly: 'Hi there, thanks for your time,',
    formal: 'Dear Sir or Madam,',
    urgent: 'Hello, an important note about your website:'
  }
};

// Formules d'appel a l'action par ton et par langue.
const CTA = {
  fr: {
    direct: 'Je peux corriger ces points rapidement. Avez-vous 15 minutes cette semaine pour en parler ?',
    friendly: "Je serais ravi de vous aider a corriger tout cela en douceur. Un petit echange de 15 minutes cette semaine vous conviendrait-il ?",
    formal: "Je me tiens a votre disposition pour corriger ces elements. Seriez-vous disponible pour un entretien de quinze minutes dans les prochains jours ?",
    urgent: "Ces points peuvent etre corriges des cette semaine. Pouvons-nous en discuter aujourd'hui ou demain avant qu'un incident ne survienne ?"
  },
  en: {
    direct: 'I can fix these quickly. Do you have 15 minutes this week to talk?',
    friendly: 'I would be glad to help you fix all of this smoothly. Would a quick 15-minute chat this week work for you?',
    formal: 'I remain at your disposal to correct these items. Would you be available for a fifteen-minute call in the coming days?',
    urgent: 'These items can be fixed this week. Could we talk today or tomorrow before an incident occurs?'
  }
};

// Signature par langue (le nom de marque est ajoute a la suite).
const SIGNOFF = {
  fr: 'Cordialement,',
  en: 'Best regards,'
};

/**
 * Construit le message de prospection.
 * @param {object} ctx
 *   lang, tone, brand (marque de l'expediteur), domain, sectorLabel,
 *   score, gradeLabel, failCount, warnCount, topIssues (array de titres),
 *   exposureRange (chaine formatee), hasRisk (bool)
 * @returns {{subject:string, body:string, text:string}}
 */
function message(ctx) {
  const lang = ctx.lang === 'en' ? 'en' : 'fr';
  const tone = ['direct', 'friendly', 'formal', 'urgent'].includes(ctx.tone) ? ctx.tone : 'direct';
  const brand = ctx.brand || 'CyberAudit';
  const domain = ctx.domain || '';
  const failCount = ctx.failCount || 0;
  const warnCount = ctx.warnCount || 0;
  const totalIssues = failCount + warnCount;
  const examples = (ctx.topIssues || []).slice(0, 3);

  const greeting = GREETING[lang][tone];
  const cta = CTA[lang][tone];
  const signoff = `${SIGNOFF[lang]}\n${brand}`;

  // Cas sans faille : message de felicitation + offre de suivi.
  if (totalIssues === 0) {
    if (lang === 'fr') {
      const subject = `Securite de ${domain} : bon niveau, quelques idees pour aller plus loin`;
      const body = `${greeting}\n\n`
        + `J'ai realise un controle de securite rapide et non intrusif de votre site ${domain}. Bonne nouvelle : le niveau est solide (note ${ctx.score}/100, ${ctx.gradeLabel}).\n\n`
        + `Je propose un suivi regulier pour maintenir ce niveau dans le temps (surveillance du certificat, des en-tetes et de la protection e-mail).\n\n`
        + `${cta}\n\n${signoff}`;
      return { subject, body, text: `${subject}\n\n${body}` };
    }
    const subject = `Security of ${domain}: solid level, a few ideas to go further`;
    const body = `${greeting}\n\n`
      + `I ran a quick, non-intrusive security check of your website ${domain}. Good news: the level is solid (score ${ctx.score}/100, ${ctx.gradeLabel}).\n\n`
      + `I offer ongoing monitoring to keep this level over time (certificate, headers and e-mail protection).\n\n`
      + `${cta}\n\n${signoff}`;
    return { subject, body, text: `${subject}\n\n${body}` };
  }

  // Cas general : failles detectees.
  if (lang === 'fr') {
    const subject = `Audit securite de ${domain} : ${failCount} point(s) a corriger`;
    const examplesLine = examples.length
      ? `Quelques exemples : ${examples.join(' ; ')}.\n\n`
      : '';
    const riskLine = ctx.hasRisk
      ? `En cas d'incident, l'exposition financiere estimee se situe autour de ${ctx.exposureRange} (estimation indicative).\n\n`
      : '';
    const body = `${greeting}\n\n`
      + `J'ai realise un controle de securite rapide et non intrusif de votre site ${domain}`
      + `${ctx.sectorLabel ? ` (secteur ${ctx.sectorLabel})` : ''}. `
      + `Resultat : une note de ${ctx.score}/100 (${ctx.gradeLabel}), avec ${failCount} point(s) a corriger et ${warnCount} a ameliorer.\n\n`
      + examplesLine
      + riskLine
      + `${cta}\n\n${signoff}`;
    return { subject, body, text: `${subject}\n\n${body}` };
  }

  const subject = `Security audit of ${domain}: ${failCount} issue(s) to fix`;
  const examplesLine = examples.length
    ? `A few examples: ${examples.join('; ')}.\n\n`
    : '';
  const riskLine = ctx.hasRisk
    ? `In case of an incident, the estimated financial exposure is around ${ctx.exposureRange} (indicative estimate).\n\n`
    : '';
  const body = `${greeting}\n\n`
    + `I ran a quick, non-intrusive security check of your website ${domain}`
    + `${ctx.sectorLabel ? ` (${ctx.sectorLabel} sector)` : ''}. `
    + `Result: a score of ${ctx.score}/100 (${ctx.gradeLabel}), with ${failCount} issue(s) to fix and ${warnCount} to improve.\n\n`
    + examplesLine
    + riskLine
    + `${cta}\n\n${signoff}`;
  return { subject, body, text: `${subject}\n\n${body}` };
}

module.exports = { message };
