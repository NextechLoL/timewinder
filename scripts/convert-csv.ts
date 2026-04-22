import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function updatedAtFor(filePath: string): string {
  try {
    const dirty = execFileSync(
      'git',
      ['status', '--porcelain', '--', filePath],
      { encoding: 'utf-8' },
    ).trim();
    if (!dirty) {
      const stdout = execFileSync(
        'git',
        ['log', '-1', '--format=%cI', '--', filePath],
        { encoding: 'utf-8' },
      ).trim();
      if (stdout) return stdout;
    }
  } catch {
    // git not available or not a repo — fall through to mtime
  }
  return statSync(filePath).mtime.toISOString();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'data', 'generated');

mkdirSync(OUT_DIR, { recursive: true });

// --- Snapshot CSV parser ---
// Format: Rank,Tier,Player Count
// e.g.: CHALLENGER,3000LP,1  or  DIAMOND,IV,39399
function parseSnapshotCsv(filePath: string): string {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n').slice(1); // skip header

  const entries: Array<{ tier: string; bracket: string; playerCount: number }> = [];

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const tier = parts[0].trim();
    const bracket = parts[1].trim();
    const playerCount = parseInt(parts[2].trim(), 10);
    if (isNaN(playerCount)) continue;
    entries.push({ tier, bracket, playerCount });
  }

  const lines_out = entries.map(
    e => `  { tier: '${e.tier}', bracket: '${e.bracket}', playerCount: ${e.playerCount} },`
  );

  const updatedAt = updatedAtFor(filePath);

  return `import type { SnapshotEntry } from '../types';\n\nexport const updatedAt = '${updatedAt}';\n\nexport const data: SnapshotEntry[] = [\n${lines_out.join('\n')}\n];\n`;
}

// --- Historical CSV parser ---
// Format: first row is header with years, first column is rank name
// e.g.: ,2019,2020,...
//       Challenger,0.01%,0.01%,...
//       Diamond I,0.19%,...
function parseHistoricalCsv(filePath: string): string {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');
  const years = header.slice(1).map(y => parseInt(y.trim(), 10));

  const entries: Array<{
    tier: string;
    division: string | null;
    label: string;
    percentages: Record<number, number | null>;
  }> = [];

  // Map display names to tier + division
  const RANK_MAP: Record<string, { tier: string; division: string | null }> = {
    'Challenger':  { tier: 'CHALLENGER',  division: null },
    'GrandMaster': { tier: 'GRANDMASTER', division: null },
    'Master':      { tier: 'MASTER',      division: null },
  };
  // Divisions: "Diamond I" → { tier: 'DIAMOND', division: 'I' }
  const TIER_NAMES = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond'];
  const DIVS = ['I', 'II', 'III', 'IV'];
  for (const t of TIER_NAMES) {
    for (const d of DIVS) {
      RANK_MAP[`${t} ${d}`] = { tier: t.toUpperCase(), division: d };
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const label = parts[0].trim();
    const mapping = RANK_MAP[label];
    if (!mapping) {
      console.warn(`Unknown rank: "${label}", skipping`);
      continue;
    }

    const percentages: Record<number, number | null> = {};
    for (let j = 0; j < years.length; j++) {
      const val = parts[j + 1]?.trim();
      if (!val || val === '') {
        percentages[years[j]] = null;
      } else {
        percentages[years[j]] = parseFloat(val.replace('%', ''));
      }
    }

    entries.push({
      tier: mapping.tier,
      division: mapping.division,
      label,
      percentages,
    });
  }

  const lines_out = entries.map(e => {
    const pctEntries = Object.entries(e.percentages)
      .map(([y, v]) => `${y}: ${v === null ? 'null' : v}`)
      .join(', ');
    const div = e.division === null ? 'null' : `'${e.division}'`;
    return `  { tier: '${e.tier}', division: ${div}, label: '${e.label}', percentages: { ${pctEntries} } },`;
  });

  const updatedAt = updatedAtFor(filePath);

  return `import type { HistoricalEntry } from '../types';\n\nexport const updatedAt = '${updatedAt}';\n\nexport const data: HistoricalEntry[] = [\n${lines_out.join('\n')}\n];\n`;
}

// --- Generate files ---
console.log('Converting CSVs to TypeScript...');

writeFileSync(
  join(OUT_DIR, 'eu-snapshot.ts'),
  parseSnapshotCsv(join(ROOT, 'data', 'euw_snapshot.csv'))
);
console.log('  eu-snapshot.ts');

writeFileSync(
  join(OUT_DIR, 'na-snapshot.ts'),
  parseSnapshotCsv(join(ROOT, 'data', 'na_snapshot.csv'))
);
console.log('  na-snapshot.ts');

writeFileSync(
  join(OUT_DIR, 'eu-historical.ts'),
  parseHistoricalCsv(join(ROOT, 'data', 'eu_ladder_historical.csv'))
);
console.log('  eu-historical.ts');

writeFileSync(
  join(OUT_DIR, 'na-historical.ts'),
  parseHistoricalCsv(join(ROOT, 'data', 'na_ladder_historical.csv'))
);
console.log('  na-historical.ts');

console.log('Done.');
