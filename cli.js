#!/usr/bin/env node
'use strict';

/**
 * CLI CyberAudit : lance un audit depuis la ligne de commande.
 * -------------------------------------------------------------------------
 * Usage :
 *   node cli.js <domaine> [options]
 * Options :
 *   --lang=fr|en            langue du rapport (defaut fr)
 *   --sector=<id>           secteur (defaut general)
 *   --depth=quick|standard|deep   profondeur (defaut standard)
 *   --currency=EUR|USD|GBP|CAD|CHF  devise du risque (defaut EUR)
 *   --template=client|technical|exec  modele PDF (defaut client)
 *   --brand="Ma Marque"     marque blanche
 *   --accent=#F26419        couleur d'accent
 *   --out=rapport.pdf       genere un PDF a ce chemin
 *
 * Exemple :
 *   node cli.js exemple.com --lang=fr --sector=ecommerce --out=rapport.pdf
 */

const fs = require('fs');
const scanner = require('./src/scanner');
const i18n = require('./src/i18n');
const report = require('./src/report');

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) opts[m[1]] = m[2];
    else if (a.startsWith('--')) opts[a.slice(2)] = true;
    else positional.push(a);
  }
  return { opts, positional };
}

const STATUS_MARK = { pass: '[OK] ', warn: '[~]  ', fail: '[X]  ', info: '[i]  ' };

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));
  const domain = positional[0];
  if (!domain) {
    console.log('Usage : node cli.js <domaine> [--lang=fr|en] [--sector=id] [--depth=standard] [--out=rapport.pdf]');
    process.exit(1);
    return;
  }
  const lang = opts.lang === 'en' ? 'en' : 'fr';

  console.log(`\nAnalyse de ${domain} en cours (non intrusive)...\n`);
  let raw;
  try {
    raw = await scanner.analyze(domain, { depth: opts.depth });
  } catch (e) {
    if (e && e.code === 'INVALID_DOMAIN') {
      console.error('Domaine invalide.');
    } else {
      console.error('Echec de l\'analyse :', e && e.message);
    }
    process.exit(1);
    return;
  }

  const model = i18n.describe(raw, {
    lang,
    sector: opts.sector,
    currency: opts.currency,
    template: opts.template,
    tone: opts.tone,
    brand: opts.brand,
    accent: opts.accent
  });

  // Affichage texte.
  console.log('====================================================');
  console.log(`  ${model.ui.reportTitle}`);
  console.log('====================================================');
  console.log(`  ${model.ui.domain}   : ${model.domain}`);
  console.log(`  ${model.ui.sector}   : ${model.sector.label}`);
  console.log(`  ${model.ui.score}   : ${model.score}/100  (${model.gradeKey} - ${model.gradeLabel})`);
  console.log(`  ${model.countsLabel.fail}: ${model.counts.fail}   ${model.countsLabel.warn}: ${model.counts.warn}   ${model.countsLabel.pass}: ${model.counts.pass}`);
  if (model.exposure && model.exposure.hasRisk) {
    console.log(`  ${model.exposure.title} : ${model.exposure.rangeFormatted} (${model.exposure.disclaimer})`);
  }
  console.log('----------------------------------------------------');
  for (const cat of model.categories) {
    console.log(`\n  ${cat.label}`);
    for (const c of cat.checks) {
      console.log(`   ${STATUS_MARK[c.status]}${c.title} - ${c.statusLabel}`);
      console.log(`        ${c.message}`);
    }
  }
  console.log('\n====================================================\n');

  // Generation PDF optionnelle.
  if (opts.out) {
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(opts.out);
      stream.on('finish', resolve);
      stream.on('error', reject);
      report.build(model, stream);
    });
    console.log(`PDF genere : ${opts.out}\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
