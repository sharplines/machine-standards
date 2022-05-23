import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as process from 'process';
import * as path from 'path';
import chalk from 'chalk';
import glob from 'glob-promise';

import { validate as validateSchema } from 'jsonschema';

const SCHEMA_FILE_NAME = 'schema.yaml';
/**
 *
 */
const fileExists = (path) =>
  fs
    .access(path)
    .then(() => true)
    .catch(() => false);

/**
 * 
 * @see https://stackoverflow.com/a/45242825/4442671
 */
const isPathChildOfDirectory = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};



const schemaCache = {};
const getSchema = async (file) => {
  if (!isPathChildOfDirectory(file, './')) {
    throw new Error('Only files in the current directory can be validated');
  }

  let candidateDir = path.dirname(file);
  while (isPathChildOfDirectory(candidateDir, './')) {
    const schemaFile = path.resolve(candidateDir, SCHEMA_FILE_NAME);

    // N.B. We explicitly check for the file existing to avoid race conditions
    // against the schema cache.
    if (await fileExists(schemaFile)) {
      if (!(schemaFile in schemaCache)) {
        schemaCache[schemaFile] = fs.readFile(schemaFile, 'utf-8').then(yaml.load);
      }
      return [schemaCache[schemaFile], path.relative(process.cwd(), schemaFile)];
    } else {
      candidateDir = path.dirname(candidateDir);
    }
  }

  throw new Error(`Failed to find schema file for ${file}`);
};

const validateFile = async (filePath) => {
  filePath = path.relative(process.cwd(), filePath);

  const [schemaProm, schemaFile] = await getSchema(filePath);
  const schema = await schemaProm;
  const doc = await fs.readFile(filePath, 'utf-8').then(yaml.load);

  const status = validateSchema(doc, schema);
  if (status.errors.length > 0) {
    process.stderr.write(`[${chalk.red('FAIL')}] ${filePath} (${schemaFile}): ${status.errors.length} errors\n`);

    for (const e of status.errors) {
      console.error(e.stack);
    }
  } else {
    process.stderr.write(`[${chalk.green('OK')}] ${filePath} (${schemaFile})\n`);
  }

  return status.errors.length;
};

const main = async () => {
  const patterns = process.argv.slice(2);

  const results = [];
  for (const pat of patterns) {
    const files = await glob(pat);
    for (const f of files) {
      if (path.basename(f) !== SCHEMA_FILE_NAME) {
        results.push(validateFile(f));
      }
    }
  }

  let totalErrors = 0;
  for (const r of results) {
    totalErrors += await r;
  }

  process.exit(totalErrors);
};

main();
// const schemaPath = process.argv[3];

// const schema = yaml.load(fs.readFileSync(schemaPath, "utf8"));

// const status = validate(doc, schema);

// if (status.errors.length > 0) {
//   for (const e of status.errors) {
//     console.log(e.stack);
//   }

//   console.log(`${status.errors.length} errors found!`);
//   process.exit(1);
// } else {
//   console.log(`${docPath} is valid`);
// }

// process.exit(0);
