const fs = require('fs').promises;
const yaml = require('js-yaml');

async function readYaml(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return yaml.load(content);
}

async function writeYaml(filePath, data) {
  const yamlString = yaml.dump(data, { noRefs: true });
  await fs.writeFile(filePath, yamlString, 'utf8');
}

module.exports = {
  readYaml,
  writeYaml
};
