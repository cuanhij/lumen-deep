// Lumen Deep's hand-in program (Node 22, standard library only): it copies the game
// (game/) and its screenshots (screenshots/) from beside this file into /output and
// writes /output/dossier.json with the vendored make.fun library, which is the summary
// the judge reads. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Count the files under a directory, for the summary line this program prints. */
function countFiles(dir, seen = { files: 0, bytes: 0 }) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) countFiles(path, seen);
    else if (name.isFile()) {
      seen.files += 1;
      seen.bytes += statSync(path).size;
    }
  }
  return seen;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: nothing to hand in');
}
if (!existsSync(shotsDir) || readdirSync(shotsDir).filter((n) => !n.startsWith('.')).length < 3) {
  throw new Error('screenshots/ needs at least 3 images: take them before handing in');
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The caps the gate enforces: at most 4 screenshots of 256 KiB each, at most 993 files
// and 48 MiB under game/, and no path under game/ longer than 1000 bytes. The dossier
// text itself is capped at 163840 bytes by the library.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const game = countFiles(join(out, 'game'));
const shots = countFiles(join(out, 'screenshots'));
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(
  `Lumen Deep handed in: ${game.files} game files (${game.bytes} bytes), `
  + `${shots.files} screenshots (${shots.bytes} bytes), dossier.json ${dossierBytes} bytes.`,
);
