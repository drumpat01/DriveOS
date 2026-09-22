const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject, withDangerousMod, withInfoPlist } = require('expo/config-plugins');

const filename = 'AskJourneyDeckIntent.swift';
function addIntentSource(project, projectName) {
  const target = project.getFirstTarget();
  const relative = `${projectName}/${filename}`;
  if (!project.hasFile(relative)) project.addSourceFile(relative, { target: target.uuid }, project.getFirstProject().firstProject.mainGroup);
  project.addFramework('AppIntents.framework', { target: target.uuid });
  return project;
}

module.exports = config => {
  if (config.extra?.features?.askJourneyDeck !== true) return config;
  config = withInfoPlist(config, mod => {
    mod.modResults.JourneyDeckAskEnabled = true;
    mod.modResults.JourneyDeckSiriTestingEnabled = process.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING === '1';
    return mod;
  });
  config = withDangerousMod(config, ['ios', async mod => {
    const destination = path.join(mod.modRequest.platformProjectRoot, mod.modRequest.projectName);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'intents', filename), path.join(destination, filename));
    return mod;
  }]);
  return withXcodeProject(config, mod => { addIntentSource(mod.modResults, mod.modRequest.projectName); return mod; });
};
module.exports.addIntentSource = addIntentSource;
