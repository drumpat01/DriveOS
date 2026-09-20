const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

const legacyMarker = '// JourneyDeck: equal native tab slots';
const marker = '// JourneyDeck: equal native tab appearance slots v2';
const layout = `
${marker}
#if !TARGET_OS_TV && !TARGET_OS_VISION
- (UITabBarAppearance *)journeyDeckAppearance:(UITabBarAppearance *)appearance
                                  itemWidth:(CGFloat)itemWidth
{
  // Selected-item appearances override UITabBar's legacy itemWidth settings.
  // Zero spacing means system-default spacing, so request a positive near-zero gap.
  const CGFloat spacing = 0.01;
  if (appearance == nil ||
      (appearance.stackedItemPositioning == UITabBarItemPositioningCentered &&
       ABS(appearance.stackedItemWidth - itemWidth) <= 0.25 &&
       ABS(appearance.stackedItemSpacing - spacing) < 0.001)) {
    return nil;
  }
  UITabBarAppearance *updated = [appearance copy];
  updated.stackedItemPositioning = UITabBarItemPositioningCentered;
  updated.stackedItemWidth = itemWidth;
  updated.stackedItemSpacing = spacing;
  return updated;
}
#endif

- (void)viewDidLayoutSubviews
{
  [super viewDidLayoutSubviews];
#if !TARGET_OS_TV && !TARGET_OS_VISION
  // Use public UIKit layout APIs; leave native selection and gestures intact.
  if (self.traitCollection.userInterfaceIdiom != UIUserInterfaceIdiomPhone || self.tabBar.items.count != 5) {
    return;
  }
  const CGFloat availableWidth = CGRectGetWidth(self.tabBar.layoutMarginsGuide.layoutFrame);
  if (availableWidth <= 0) {
    return;
  }
  const CGFloat itemWidth = (availableWidth - 0.01 * (self.tabBar.items.count - 1)) / self.tabBar.items.count;
  // Copy and reassign only when changed, preserving the native glass/materials,
  // icon/title styles and selection while avoiding a repeated layout cycle.
  UITabBarAppearance *standard = [self journeyDeckAppearance:self.tabBar.standardAppearance itemWidth:itemWidth];
  if (standard != nil) self.tabBar.standardAppearance = standard;
  UITabBarAppearance *edge = [self journeyDeckAppearance:self.tabBar.scrollEdgeAppearance itemWidth:itemWidth];
  if (edge != nil) self.tabBar.scrollEdgeAppearance = edge;
  for (UITabBarItem *item in self.tabBar.items) {
    UITabBarAppearance *itemStandard = [self journeyDeckAppearance:item.standardAppearance itemWidth:itemWidth];
    if (itemStandard != nil) item.standardAppearance = itemStandard;
    UITabBarAppearance *itemEdge = [self journeyDeckAppearance:item.scrollEdgeAppearance itemWidth:itemWidth];
    if (itemEdge != nil) item.scrollEdgeAppearance = itemEdge;
  }
#endif
}

`;

function patchController(source) {
  if (source.includes(marker)) return source;
  const anchor = '- (instancetype)init\n';
  // Upgrade a locally prebuilt copy too; never leave both layout overrides behind.
  if (source.includes(legacyMarker)) {
    const start = source.indexOf(legacyMarker);
    const end = source.indexOf(anchor, start);
    if (end < 0 || source.indexOf(legacyMarker, start + 1) >= 0) {
      throw new Error('Review the JourneyDeck legacy tab-spacing patch before upgrading.');
    }
    source = source.slice(0, start) + source.slice(end);
  }
  if (source.split(anchor).length !== 2 || source.includes('- (void)viewDidLayoutSubviews')) {
    throw new Error('Review the JourneyDeck tab-spacing patch against the updated React Native Screens controller.');
  }
  return source.replace(anchor, layout + anchor);
}

module.exports = config => withDangerousMod(config, ['ios', async config => {
  const packageFile = require.resolve('react-native-screens/package.json', { paths: [config.modRequest.projectRoot] });
  const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
  if (version !== '4.27.0') throw new Error(`Review the JourneyDeck tab-spacing patch for React Native Screens ${version}.`);
  const controller = path.join(path.dirname(packageFile), 'ios/tabs/host/RNSTabBarController.mm');
  const source = fs.readFileSync(controller, 'utf8');
  const patched = patchController(source);
  if (patched !== source) fs.writeFileSync(controller, patched);
  console.info('JourneyDeck: equal native tab appearance slots v2 applied to React Native Screens ' + version);
  return config;
}]);
module.exports.patchController = patchController;
