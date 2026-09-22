const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const sourceName = 'JourneyDeckSiriIntents.swift';
const shortcutMarker = '    // JOURNEYDECK_V3_APP_SHORTCUTS';
const askShortcut = `    AppShortcut(intent: AskJourneyDeckIntent(), phrases: [
      "Ask \\(.applicationName)", "Ask \\(.applicationName) about my journeys"
    ], shortTitle: "Ask JourneyDeck", systemImageName: "bubble.left.and.text.bubble.right")`;
const providerDeclaration = 'struct JourneyDeckAppShortcuts: AppShortcutsProvider {';
const availableProviderDeclaration = '@available(iOS 26.0, *)\n' + providerDeclaration;

function addAskShortcutToSiriSource(source) {
  if (source.includes('AppShortcut(intent: AskJourneyDeckIntent()')) return source;
  if (!source.includes(shortcutMarker)) throw new Error('JourneyDeck Siri shortcut insertion marker is missing.');
  if (!source.includes(providerDeclaration)) throw new Error('JourneyDeck Siri shortcuts provider is missing.');
  return source.replace(providerDeclaration, availableProviderDeclaration).replace(shortcutMarker, askShortcut);
}

function addMarkerShortcutToSiriSource(source, intentSource) {
  if (source.includes('AppShortcut(intent: CreateJourneyMarkerIntent()')) return source;
  const insertion = '  static var appShortcuts: [AppShortcut] {';
  if (!source.includes(insertion)) throw new Error('JourneyDeck Siri shortcuts provider is missing.');
  return source.replace(insertion, `${insertion}
    AppShortcut(intent: CreateJourneyMarkerIntent(), phrases: [
      "Create a marker in \\(.applicationName)", "Mark this moment in \\(.applicationName)"
    ], shortTitle: "Create a Marker", systemImageName: "mappin.and.ellipse")`) + '\n' + intentSource;
}

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
    const sourcePath = path.join(mod.modRequest.projectRoot, 'siri', sourceName);
    const source = fs.readFileSync(sourcePath, 'utf8');
    let output = config.extra?.features?.askJourneyDeck === true ? addAskShortcutToSiriSource(source) : source;
    if (config.extra?.features?.markerPrototype === true) {
      output = addMarkerShortcutToSiriSource(output, fs.readFileSync(path.join(mod.modRequest.projectRoot, 'siri', 'JourneyDeckMarkerIntent.swift'), 'utf8'));
    }
    fs.writeFileSync(path.join(sourceRoot, sourceName), output);
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
module.exports.addAskShortcutToSiriSource = addAskShortcutToSiriSource;

module.exports.addMarkerShortcutToSiriSource = addMarkerShortcutToSiriSource;
