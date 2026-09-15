const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const sourceName = 'JourneyDeckSiriIntents.swift';

function addSiriSource(project, relativeSource) {
  if (project.hasFile(relativeSource)) return project;
  const host = project.getFirstTarget().firstTarget;
  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  if (!project.addSourceFile(relativeSource, { target: host.uuid }, mainGroup)) {
    throw new Error('Failed to add JourneyDeck Siri intents to the iOS app target.');
  }
  return project;
}

module.exports = config => {
  config = withDangerousMod(config, ['ios', mod => {
    const sourceRoot = IOSConfig.Paths.getSourceRoot(mod.modRequest.projectRoot);
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'siri', sourceName), path.join(sourceRoot, sourceName));
    return mod;
  }]);
  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    const sourceRoot = IOSConfig.Paths.getSourceRoot(mod.modRequest.projectRoot);
    const relativeSource = path.relative(mod.modRequest.platformProjectRoot, path.join(sourceRoot, sourceName))
      .split(path.sep).join('/');
    addSiriSource(project, relativeSource);
    return mod;
  });
};

module.exports.addSiriSource = addSiriSource;
