#!/usr/bin/env node
/**
 * check-cards.mjs — quality gate for <mgt-recall> spaced-repetition cards.
 * Dependency-free (Node built-ins only). Run:  node scripts/check-cards.mjs
 *
 * ERRORS (exit 1): duplicate card ids (breaks SRS keying), or a card missing
 * an id / question / answer. WARNINGS (exit 0): answer or question too long to
 * be atomic, or a question that's neither a "?" nor a "___" cloze.
 *
 * Enforces the spirit of Matuschak's five criteria (focused, precise, tractable)
 * with the few things a machine can actually check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEARN = fileURLToPath(new URL('../learn', import.meta.url));
const MAX_ANSWER = 280;   // chars; longer ⇒ probably not atomic
const MAX_QUESTION = 160;

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (name.endsWith('.html')) out.push(p);
    }
    return out;
}
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

const files = walk(LEARN);
const ids = new Map();           // id -> file
const errors = [], warnings = [];
let total = 0;

for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const rel = file.slice(LEARN.length - 5);
    const re = /<mgt-recall\b([^>]*)>([\s\S]*?)<\/mgt-recall>/g;
    let m, perFile = 0;
    while ((m = re.exec(html))) {
        total++; perFile++;
        const attrs = m[1], body = m[2];
        const idM = attrs.match(/\bid="([^"]+)"/);
        const id = idM ? idM[1] : null;
        const sumM = body.match(/<summary>([\s\S]*?)<\/summary>/i);
        const question = sumM ? strip(sumM[1]) : (attrs.match(/\bquestion="([^"]*)"/) || [])[1] || '';
        const answer = sumM ? strip(body.replace(sumM[0], '')) : (attrs.match(/\banswer="([^"]*)"/) || [])[1] || '';
        const where = `${rel} [${id || '(no id)'}]`;
        if (!id) errors.push(`${where}: missing id`);
        else if (ids.has(id)) errors.push(`${where}: duplicate id (also in ${ids.get(id)})`);
        else ids.set(id, rel);
        if (!question) errors.push(`${where}: missing question`);
        if (!answer) errors.push(`${where}: missing answer`);
        if (answer.length > MAX_ANSWER) warnings.push(`${where}: answer ${answer.length} chars (>${MAX_ANSWER}) — split into atomic cards?`);
        if (question.length > MAX_QUESTION) warnings.push(`${where}: question ${question.length} chars (>${MAX_QUESTION})`);
        const isPrompt = /[?]|_{2,}|……|\.\.\./.test(question) || /^(name|list|give|state|describe|identify|explain|define|recall)\b/i.test(question);
        if (question && !isPrompt) warnings.push(`${where}: question isn't a "?", a "___" cloze, or an imperative prompt — is it really a prompt?`);
    }
    if (perFile) console.log(`  ${rel}: ${perFile} cards`);
}

console.log(`\n${total} cards across ${files.length} files · ${ids.size} unique ids`);
warnings.forEach(w => console.log('  ⚠ ' + w));
errors.forEach(e => console.log('  ✖ ' + e));
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
