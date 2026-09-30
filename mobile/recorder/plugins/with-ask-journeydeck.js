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
    const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
    if (typeof scheme !== 'string' || !/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new Error('Ask JourneyDeck requires the app URL scheme.');
    mod.modResults.JourneyDeckAskURLScheme = scheme;
    // Siri checks StoreKit itself; TestFlight builds that unlock Plus in the app unlock it for Siri too.
    mod.modResults.JourneyDeckPlusUnlocked = config.extra?.features?.testflightPlusUnlocked === true;
    // Plus trial from the first launch: 3 days on V4, 7 on V3 (src/plus-trial.ts). Siri reads the same Keychain item.
    mod.modResults.JourneyDeckPlusTrialFromFirstLaunch = true;
    mod.modResults.JourneyDeckPlusTrialDays = config.extra?.features?.redesign === true ? 3 : 7;
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
