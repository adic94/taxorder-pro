#!/usr/bin/env node
/**
 * TaxOrder Pro — Generator CHANGELOG.md z git log
 * Użycie: node tools/generate-changelog.js [--output CHANGELOG.md]
 *
 * Parsuje git log i grupuje commity po tagach/datach.
 * Konwencja commitów: "Typ: opis" (Add, Fix, Update, Refactor, Docs, Security)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1]
  : path.join(ROOT, 'CHANGELOG.md');

// Pobierz tagi i daty
function getTags() {
  try {
    const raw = execSync('git tag --sort=-version:refname --format=%(refname:short)%09%(creatordate:short)', { cwd: ROOT }).toString().trim();
    return raw ? raw.split('\n').map(l => {
      const [tag, date] = l.split('\t');
      return { tag, date };
    }) : [];
  } catch {
    return [];
  }
}

// Pobierz commity między dwoma refs
function getCommits(from, to = 'HEAD') {
  const range = from ? `${from}..${to}` : to;
  try {
    const raw = execSync(
      `git log ${range} --pretty=format:%H%x09%ad%x09%s --date=short`,
      { cwd: ROOT }
    ).toString().trim();
    if (!raw) return [];
    return raw.split('\n').map(line => {
      const [hash, date, ...subjectParts] = line.split('\t');
      return { hash: hash.slice(0, 8), date, subject: subjectParts.join('\t') };
    });
  } catch {
    return [];
  }
}

// Kategoryzuj commit po prefiksie
function categorize(subject) {
  const m = subject.match(/^(Add|Fix|Update|Refactor|Docs|Security|Remove|Perf|Test|Chore|CI)[:：\s]/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : 'Other';
}

const CATEGORY_ORDER = ['Security', 'Fix', 'Add', 'Update', 'Refactor', 'Perf', 'Test', 'Docs', 'Chore', 'CI', 'Remove', 'Other'];
const CATEGORY_LABEL = {
  Security: '🔒 Bezpieczeństwo',
  Fix:      '🐛 Poprawki',
  Add:      '✨ Nowe funkcje',
  Update:   '🔄 Aktualizacje',
  Refactor: '♻️ Refaktoryzacja',
  Perf:     '⚡ Wydajność',
  Test:     '🧪 Testy',
  Docs:     '📝 Dokumentacja',
  Chore:    '🔧 Narzędzia',
  CI:       '⚙️ CI/CD',
  Remove:   '🗑️ Usunięcia',
  Other:    '📦 Inne',
};

function renderSection(commits) {
  if (!commits.length) return '';
  const groups = {};
  for (const c of commits) {
    const cat = categorize(c.subject);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  }
  const lines = [];
  for (const cat of CATEGORY_ORDER) {
    if (!groups[cat]) continue;
    lines.push(`\n### ${CATEGORY_LABEL[cat]}`);
    for (const c of groups[cat]) {
      lines.push(`- ${c.subject} (\`${c.hash}\`)`);
    }
  }
  return lines.join('\n');
}

// Buduj changelog
const tags = getTags();
const sections = [];

if (tags.length === 0) {
  // Brak tagów — jeden blok "Unreleased"
  const commits = getCommits(null, 'HEAD');
  const currentDate = new Date().toISOString().slice(0, 10);
  sections.push(`## [Unreleased] — ${currentDate}${renderSection(commits)}`);
} else {
  // Unreleased (HEAD → najnowszy tag)
  const unreleasedCommits = getCommits(tags[0].tag, 'HEAD');
  if (unreleasedCommits.length) {
    const currentDate = new Date().toISOString().slice(0, 10);
    sections.push(`## [Unreleased] — ${currentDate}${renderSection(unreleasedCommits)}`);
  }
  // Każdy tag → poprzedni tag
  for (let i = 0; i < tags.length; i++) {
    const { tag, date } = tags[i];
    const prevTag = tags[i + 1]?.tag ?? null;
    const commits = getCommits(prevTag, tag);
    sections.push(`## [${tag}] — ${date}${renderSection(commits)}`);
  }
}

const output = `# Changelog — TaxOrder Pro

Wszystkie istotne zmiany w projekcie. Format zgodny z [Keep a Changelog](https://keepachangelog.com/).

${sections.join('\n\n')}
`;

fs.writeFileSync(OUTPUT, output, 'utf8');
console.log(`✅ CHANGELOG.md wygenerowany → ${OUTPUT}`);
console.log(`   Sekcje: ${sections.length}`);
