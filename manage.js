#!/usr/bin/env node
'use strict';

/**
 * CLI de gestion des cles d'acces (paywall) de CyberAudit.
 * -------------------------------------------------------------------------
 * Usage :
 *   node manage.js owner              affiche la cle proprietaire
 *   node manage.js add ["libelle"]    genere et ajoute une cle vendable
 *   node manage.js list               liste toutes les cles
 *   node manage.js revoke <cle>       revoque une cle
 *
 * Les cles sont stockees dans DATA_DIR/access.json (volume Docker), avec
 * ecriture atomique : ce CLI et le serveur partagent le meme fichier.
 */

const access = require('./src/access');

function usage() {
  console.log('Usage :');
  console.log('  node manage.js owner              affiche la cle proprietaire');
  console.log('  node manage.js add ["libelle"]    genere une cle vendable');
  console.log('  node manage.js list               liste les cles');
  console.log('  node manage.js revoke <cle>       revoque une cle');
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case 'owner': {
      console.log(access.getOwnerKey());
      break;
    }
    case 'add': {
      const label = rest.join(' ') || '';
      const code = access.addKey(label);
      console.log(`Cle ajoutee : ${code}${label ? `  (${label})` : ''}`);
      break;
    }
    case 'list': {
      const keys = access.listKeys();
      console.log(`Cle proprietaire : ${access.getOwnerKey()}`);
      if (!keys.length) {
        console.log('Aucune cle vendable.');
      } else {
        console.log(`Cles vendables (${keys.length}) :`);
        for (const k of keys) {
          const state = k.revoked ? 'REVOQUEE' : 'active';
          console.log(`  ${k.code}  [${state}]  ${k.source || 'manual'}  ${k.label || ''}  ${k.createdAt || ''}`);
        }
      }
      break;
    }
    case 'revoke': {
      const code = rest[0];
      if (!code) { usage(); process.exit(1); return; }
      const ok = access.revokeKey(code);
      console.log(ok ? `Cle revoquee : ${code}` : `Cle introuvable : ${code}`);
      break;
    }
    default:
      usage();
      break;
  }
}

main();
