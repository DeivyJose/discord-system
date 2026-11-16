import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  createDiscordBlueprintArtifact,
  renderDiscordBlueprintArtifact,
} from './artifact.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const artifact =
  createDiscordBlueprintArtifact();

const report =
  renderDiscordBlueprintArtifact(
    artifact,
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'discord-blueprint',
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

const jsonPath =
  path.join(
    outputDirectory,
    'latest.json',
  );

const textPath =
  path.join(
    outputDirectory,
    'latest.txt',
  );

await writeFile(
  jsonPath,
  JSON.stringify(
    artifact,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  textPath,
  report,
  'utf8',
);

console.log('');
console.log(
  '🧬 Discord Blueprint Artifact generado.',
);

console.log('');
console.log(
  `Schema:      ${artifact.schemaVersion}`,
);

console.log(
  `Blueprint:   ${artifact.blueprintVersion}`,
);

console.log(
  `Fingerprint: ${artifact.fingerprint}`,
);

console.log('');

console.log(
  `Categorías: ${artifact.summary.categories}`,
);

console.log(
  `Canales:    ${artifact.summary.channels}`,
);

console.log(
  `Roles:      ${artifact.summary.roles}`,
);

console.log(
  `Total:      ${artifact.summary.totalResources}`,
);

console.log('');
console.log(
  'Ejecución permitida: NO',
);

console.log('');
console.log(
  `Reporte: ${textPath}`,
);

console.log(
  `JSON:    ${jsonPath}`,
);

console.log('');
