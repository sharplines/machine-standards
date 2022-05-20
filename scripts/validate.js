import * as yaml from "js-yaml";
import * as fs from "fs";
import * as process from "process";
import * as path from "path";

import { validate } from "jsonschema";

const docPath = process.argv[2];
const docDir = path.dirname(docPath);

const doc = yaml.load(fs.readFileSync(docPath, "utf8"));

if ("$schema" in doc) {
  const schemaFile = path.resolve(docDir, doc["$schema"]);
  const schema = yaml.load(fs.readFileSync(schemaFile, "utf8"));

  const status = validate(doc, schema);

  if (status.errors.length > 0) {
    for (const e of status.errors) {
      console.log(e.stack);
    }

    console.log(`${status.errors.length} errors found!`);
    process.exit(1);
  } else {
    console.log(`${docPath} is valid`);
  }
} else {
  console.log(`${docPath} has no $schema specified, so it's valid by default`);
}
process.exit(0);
