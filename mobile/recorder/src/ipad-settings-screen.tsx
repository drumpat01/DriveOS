import { TouchPressable as Pressable, ExpandingSection, SlidingSelection } from './touch-feedback';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeChoice } from './app-theme';
import { AppIconPicker } from './app-icon-picker';
import { ThemePicker } from './theme-picker';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import { PlaceDataCredits } from './place-data-credits';
import { settingsCategories, type SettingsCategoryId } from './settings-categories';
import type { AppleIdentityStatus } from './auth';
import type { SavedPlaceSlot } from './saved-places';

type Props = {
  displayName: string; avatar: string | null; initials: string; appleIdentityStatus: AppleIdentityStatus;
  signingInWithApple: boolean; accountActionPending: boolean; hasAppleAccount: boolean;
  cloud: { status: string; detail: string }; membershipTier: 'free' | 'paid'; membershipExpirationDate: string | null;
  providerName: string; providerDetail: string;
  places: { id: SavedPlaceSlot; label: string; symbol: string; saved: boolean }[];
  customPlaces: { id: string; label: string }[];
  onEditProfile: () => void; onAppleSignIn: () => void; onSignOut: () => void; onDeleteAccount: () => void;
  onSync: () => void; onMembership: () => void; onChangeProvider: () => void; onPlace: (slot: SavedPlaceSlot) => void; onCustomPlace: (placeId?: string) => void;
  advancedVisible: boolean; onToggleAdvanced: () => void; onDataHealth: () => void; advancedContent: ReactNode;
};

const categoryCopy: Record<SettingsCategoryId, string> = {
  appearance: 'Choose the colors and app icon that feel like yours.',
  recording: 'Review how JourneyDeck records and protects location data.',
  music: 'Choose how your drives become soundtracks.',
  account: 'Manage your private profile, Apple Account, and iCloud backup.',
  places: 'Name common locations and protect them when sharing.',
  membership: 'Manage JourneyDeck access, privacy, and diagnostics.',
};

export function IpadSettingsScreen(p: Props) {
  const { theme } = useThemeChoice();
  const colors = theme.resolvePalette(theme.isLight
    ? { page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: ivoryPalette.violet, line: ivoryPalette.border, inset: ivoryPalette.lilac }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#b795e5', line: '#49304f', inset: '#291735' });
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [category, setCategory] = useState<SettingsCategoryId>('appearance');
  const [canvasWidth, setCanvasWidth] = useState(window.width || 1024);
  const selectedCategory = settingsCategories.find(item => item.id === category)!;
  const portrait = window.height > window.width;
  const availableWidth = canvasWidth / Math.max(1, window.fontScale);
  const compact = availableWidth < 680;
  // Give the in-app category rail more of the landscape canvas. UIKit owns the
  // separate system sidebar width, so this is the safe place to rebalance the
  // three-column composition without replacing native adaptive navigation.
  const categoryRailWidth = portrait
    ? Math.max(206, Math.min(238, canvasWidth * 0.28))
    : canvasWidth / 3;
  const categoryContentWidth = Math.max(1, categoryRailWidth - (portrait ? 28 : 36));
  const touringGreen = theme.id === 'redline' ? theme.palette.green : colors.accent;
  const touringGreenWash = theme.id === 'redline' ? `${touringGreen}42` : colors.inset;
  const panel = [styles.panel, { backgroundColor: colors.card, borderColor: theme.id === 'redline' ? `${touringGreen}aa` : colors.line }];
  const title = [styles.title, { color: colors.text }];
  const body = [styles.body, { color: colors.muted }];
  const cloudBusy = p.cloud.status === 'syncing';
  const cloudUnavailable = p.cloud.status === 'unavailable';
  const placeCount = p.places.filter(place => place.saved).length + p.customPlaces.length;

  const categorySummary = useMemo<Record<SettingsCategoryId, string>>(() => ({
    appearance: theme.name,
    recording: 'Manual recording',
    music: p.providerName,
    account: p.cloud.status === 'synced' ? 'iCloud synced' : p.cloud.detail,
    places: `${placeCount} saved`,
    membership: p.membershipTier === 'paid' ? 'JourneyDeck Membership' : 'Free · Latest 45 days',
  }), [p.cloud.detail, p.cloud.status, p.membershipTier, p.providerName, placeCount, theme.name]);

  const icon = (name: SFSymbol, size = 24) => <View style={[styles.icon, { backgroundColor: theme.id === 'redline' ? touringGreen : colors.inset }]}><SymbolView name={name} tintColor={theme.id === 'redline' ? colors.text : colors.accent} size={size} /></View>;
  const button = (label: string, onPress: () => void, options: { disabled?: boolean; primary?: boolean; accessibilityLabel?: string } = {}) =>
    <Pressable accessibilityRole="button" accessibilityLabel={options.accessibilityLabel ?? label} disabled={options.disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: theme.id === 'redline' ? touringGreen : colors.line, backgroundColor: options.primary ? touringGreen : touringGreenWash }, (pressed || options.disabled) && styles.dim]}>
      <Text style={[styles.buttonText, { color: options.primary && theme.id !== 'redline' ? theme.palette.onAccent : colors.text }]}>{label}</Text>
    </Pressable>;
  const openPage = (path: 'privacy' | 'support') => {
    void Linking.openURL(`https://journeydeck.me/${path}`).catch(() => Alert.alert('Unable to open page', 'Please try again when you are connected.'));
  };

  const appearance = <View testID="ipad-settings-appearance" style={styles.detailStack}>
    <ThemePicker embedded compact membershipTier={p.membershipTier} onUpgrade={p.onMembership} />
    <View style={[styles.divider, { backgroundColor: colors.line }]} />
    <AppIconPicker embedded compact membershipTier={p.membershipTier} onUpgrade={p.onMembership} />
  </View>;
  const recording = <View testID="ipad-settings-recording" style={styles.detailStack}>
    <View style={panel}><View style={styles.row}>{icon('record.circle')}<View style={styles.flex}><Text style={title}>Manual recording</Text><Text style={body}>A journey begins only after you tap Start Journey. You stay in control of every drive JourneyDeck saves.</Text></View></View></View>
    <View style={panel}><View style={styles.row}>{icon('location.fill')}<View style={styles.flex}><Text style={title}>Location stays private</Text><Text style={body}>Route points remain in your local library and private iCloud account. Saved places are masked when you share.</Text></View></View></View>
    <PlaceDataCredits />
  </View>;
  const music = <View testID="ipad-settings-music" style={styles.detailStack}>
    <View style={panel}><View style={styles.row}>{icon('music.note')}<View style={styles.flex}><Text style={title}>Soundtrack capture</Text><Text style={body}>{p.providerName}</Text><Text style={body}>{p.providerDetail}</Text></View>{button('Change', p.onChangeProvider, { accessibilityLabel: 'Change soundtrack provider' })}</View></View>
    <View style={[panel, { backgroundColor: colors.inset }]}><Text style={[styles.kicker, { color: colors.accent }]}>PRIVATE BY DESIGN</Text><Text style={body}>Music is optional. A music or iCloud problem never blocks starting, finishing, or saving a journey.</Text></View>
    {p.advancedContent}
  </View>;
  const account = <View testID="ipad-settings-account" style={styles.detailStack}>
    <View style={panel}>
      <View style={styles.profileRow}>{p.avatar ? <Image source={p.avatar} contentFit="cover" style={styles.profileImage} /> : <View style={[styles.profileImage, { backgroundColor: colors.inset }]}><Text style={[styles.initials, { color: colors.accent }]}>{p.initials}</Text></View>}
        <View style={styles.flex}><Text style={title}>{p.displayName}</Text><Text style={body}>{p.appleIdentityStatus === 'authorized' ? 'Apple connected' : 'Apple sign-in is optional'}</Text></View>{button('Edit profile', p.onEditProfile, { accessibilityLabel: 'Edit primary driver profile' })}</View>
      {p.signingInWithApple ? <View style={styles.authStatus}><ActivityIndicator color={colors.accent} /><Text style={body}>Finishing sign-in…</Text></View>
        : p.appleIdentityStatus !== 'authorized' ? <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={theme.isLight ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12} style={styles.appleButton} onPress={p.onAppleSignIn} />
          : <View style={styles.authStatus}><SymbolView name="checkmark.circle.fill" tintColor={colors.accent} size={21} /><Text style={body}>Connected</Text></View>}
      {p.appleIdentityStatus === 'revoked' && <Text style={body}>Apple access was revoked. Sign in again to relink this profile. Your local journeys are safe.</Text>}
      <View style={styles.actionRow}>{p.hasAppleAccount && button('Sign out', p.onSignOut, { disabled: p.accountActionPending })}{button(p.accountActionPending ? 'Finishing…' : 'Delete account', p.onDeleteAccount, { disabled: p.accountActionPending })}</View>
    </View>
    <View style={panel}><View style={styles.row}>{icon('icloud')}<View style={styles.flex}><Text style={title}>iCloud Backup</Text><Text accessibilityLiveRegion="polite" style={body}>{p.cloud.detail}</Text></View>
      {button(cloudBusy ? 'Syncing…' : cloudUnavailable ? 'Update app' : 'Sync now', p.onSync, { primary: true, disabled: cloudBusy || cloudUnavailable, accessibilityLabel: 'Sync iCloud now' })}</View>
      <Text style={body}>Your JourneyDeck library stays private in your iCloud account. Sync on your iPhone first, then sync here.</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => openPage('privacy')}><Text style={[styles.link, { color: colors.accent }]}>Read Privacy Policy</Text></Pressable></View>
  </View>;
  const places = <View testID="ipad-settings-places" style={styles.detailStack}>{p.places.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`${place.saved ? 'Change' : 'Set'} ${place.label}`} onPress={() => p.onPlace(place.id)}
    style={({ pressed }) => [panel, styles.placeRow, pressed && styles.dim]}>{icon(place.symbol as SFSymbol)}<View style={styles.flex}><Text style={title}>{place.label}</Text><Text style={body}>{place.saved ? 'Saved · protected when sharing' : 'Not set'}</Text></View>
    <Text style={[styles.link, { color: colors.accent }]}>{place.saved ? 'Change' : 'Set'}</Text><SymbolView name="chevron.right" tintColor={colors.muted} size={14} /></Pressable>)}
    {p.customPlaces.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`Edit custom place ${place.label}`} onPress={() => p.onCustomPlace(place.id)} style={({ pressed }) => [panel, styles.placeRow, pressed && styles.dim]}>{icon('mappin.and.ellipse')}<View style={styles.flex}><Text style={title}>{place.label}</Text><Text style={body}>Saved · protected when sharing</Text></View><Text style={[styles.link, { color: colors.accent }]}>Change</Text><SymbolView name="chevron.right" tintColor={colors.muted} size={14} /></Pressable>)}
    <Pressable accessibilityRole="button" accessibilityLabel={p.customPlaces.length ? 'Add another custom place' : 'Add custom place'} onPress={() => p.onCustomPlace()} style={({ pressed }) => [panel, styles.placeRow, pressed && styles.dim]}>{icon('plus')}<View style={styles.flex}><Text style={title}>Custom</Text><Text style={body}>{p.customPlaces.length ? 'Add another safe place' : 'Add a named safe place'}</Text></View><Text style={[styles.link, { color: colors.accent }]}>Add</Text><SymbolView name="chevron.right" tintColor={colors.muted} size={14} /></Pressable>
  </View>;
  const membership = <View testID="ipad-settings-membership" style={styles.detailStack}>
    <View style={panel}><View style={styles.row}>{icon('crown')}<View style={styles.flex}><Text style={title}>{p.membershipTier === 'paid' ? 'JourneyDeck Membership' : 'Free · Latest 45 days'}</Text><Text style={body}>{p.membershipTier === 'paid' ? `Atlas and complete history unlocked${p.membershipExpirationDate ? ` through ${new Date(p.membershipExpirationDate).toLocaleDateString()}` : ''}.` : 'Unlock Atlas and your complete history.'}</Text></View>{button(p.membershipTier === 'paid' ? 'Manage' : 'Unlock', p.onMembership, { primary: true })}</View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Advanced Support" accessibilityState={{ expanded: p.advancedVisible }} onPress={p.onToggleAdvanced} style={({ pressed }) => [panel, styles.placeRow, pressed && styles.dim]}>{icon('wrench.and.screwdriver')}<View style={styles.flex}><Text style={title}>Advanced Support</Text><Text style={body}>Diagnostics are hidden here unless you need help.</Text></View><SymbolView name={p.advancedVisible ? 'chevron.up' : 'chevron.down'} tintColor={colors.accent} size={15} /></Pressable>
    <ExpandingSection expanded={p.advancedVisible}><View style={panel}>{button('Open Data Health', p.onDataHealth, { accessibilityLabel: 'Open Data Health' })}</View></ExpandingSection>
    <View style={styles.linkGrid}><Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => openPage('privacy')} style={({ pressed }) => [panel, styles.linkCard, pressed && styles.dim]}>{icon('hand.raised')}<Text style={title}>Privacy Policy</Text><SymbolView name="arrow.up.right" tintColor={colors.accent} size={14} /></Pressable>
      <Pressable accessibilityRole="link" accessibilityLabel="Support Page" onPress={() => openPage('support')} style={({ pressed }) => [panel, styles.linkCard, pressed && styles.dim]}>{icon('questionmark.circle')}<Text style={title}>Support Page</Text><SymbolView name="arrow.up.right" tintColor={colors.accent} size={14} /></Pressable></View>
  </View>;
  const detail = { appearance, recording, music, account, places, membership }[category];

  return <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: colors.page }]}>
    <View testID="ipad-settings" onLayout={event => setCanvasWidth(event.nativeEvent.layout.width)} style={[styles.split, compact && styles.compactSplit]}>
      <ScrollView testID="ipad-settings-sidebar" horizontal={compact} showsHorizontalScrollIndicator={false}
        style={[styles.sidebar, compact ? styles.compactSidebar : { width: categoryRailWidth }, { borderColor: colors.line }]}
        contentInsetAdjustmentBehavior="automatic" automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets
        contentContainerStyle={compact ? styles.compactSidebarContent : { paddingHorizontal: portrait ? 14 : 18, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
        {!compact && <><IpadPageHeader title="Settings" width={categoryContentWidth} artwork={require('../assets/cinematic-settings-photo-v1.jpg')} />
        <Pressable accessibilityRole="button" accessibilityLabel="Edit primary driver profile" onPress={p.onEditProfile} style={({ pressed }) => [styles.sidebarProfile, { borderColor: colors.line, backgroundColor: colors.card }, pressed && styles.dim]}>
          {p.avatar ? <Image source={p.avatar} contentFit="cover" style={styles.sidebarAvatar} /> : <View style={[styles.sidebarAvatar, { backgroundColor: colors.inset }]}><Text style={[styles.sidebarInitials, { color: colors.accent }]}>{p.initials}</Text></View>}
          <View style={styles.flex}><Text numberOfLines={1} style={[styles.sidebarName, { color: colors.text }]}>{p.displayName}</Text><Text numberOfLines={1} style={[styles.sidebarDetail, { color: colors.muted }]}>Primary driver</Text></View>
        </Pressable></>}
        <SlidingSelection selectedIndex={settingsCategories.findIndex(item => item.id === category)} style={[styles.categoryList, compact && styles.compactCategoryList]} highlightStyle={{ backgroundColor: touringGreenWash, borderRadius: 15 }}>{settingsCategories.map(item => { const active = item.id === category; return <Pressable key={item.id} accessibilityRole="menuitem" accessibilityLabel={`Open ${item.title} settings`} accessibilityState={{ selected: active }} onPress={() => setCategory(item.id)} style={({ pressed }) => [styles.categoryRow, compact && styles.compactCategoryRow, { borderColor: active ? touringGreen : 'transparent', backgroundColor: 'transparent' }, pressed && styles.dim]}>
          <SymbolView name={item.symbol as SFSymbol} tintColor={active ? (theme.id === 'redline' ? colors.text : colors.accent) : colors.muted} size={21} /><View style={styles.flex}><Text numberOfLines={compact ? 1 : 2} style={[styles.categoryTitle, { color: active ? colors.text : colors.muted }]}>{item.title}</Text>{!compact && <Text numberOfLines={2} style={[styles.categorySummary, { color: colors.muted }]}>{categorySummary[item.id]}</Text>}</View>{active && <View style={[styles.activeDot, { backgroundColor: touringGreen }]} />}
        </Pressable>; })}</SlidingSelection>
      </ScrollView>
      <ScrollView testID="ipad-settings-detail" style={styles.detail} contentInsetAdjustmentBehavior="automatic" automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets contentContainerStyle={[styles.detailContent, compact && styles.compactDetailContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.detailHeader}><View style={[styles.detailIcon, { backgroundColor: theme.id === 'redline' ? touringGreen : colors.inset }]}><SymbolView name={selectedCategory.symbol as SFSymbol} tintColor={theme.id === 'redline' ? colors.text : colors.accent} size={28} /></View><View style={styles.flex}><Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>{selectedCategory.title}</Text><Text style={[styles.detailSubtitle, { color: colors.muted }]}>{categoryCopy[category]}</Text></View></View>
        {detail}
      </ScrollView>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, split: { flex: 1, flexDirection: 'row' }, compactSplit: { flexDirection: 'column' },
  sidebar: { flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth }, compactSidebar: { width: '100%', height: 84, borderRightWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  compactSidebarContent: { paddingHorizontal: 12, paddingVertical: 10 },
  sidebarProfile: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 17, padding: 10, marginTop: 14 }, sidebarAvatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sidebarInitials: { fontSize: 17, fontWeight: '800' }, sidebarName: { fontSize: 14, fontWeight: '800' }, sidebarDetail: { fontSize: 11, marginTop: 2 }, categoryList: { gap: 6, marginTop: 16 }, compactCategoryList: { flexDirection: 'row', gap: 8, marginTop: 0 },
  categoryRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9 }, categoryTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800' }, categorySummary: { fontSize: 10, lineHeight: 14, marginTop: 2 }, activeDot: { width: 5, height: 26, borderRadius: 3 },
  compactCategoryRow: { width: 184, minHeight: 62, paddingVertical: 8 },
  detail: { flex: 1 }, detailContent: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 28, gap: 22 }, compactDetailContent: { paddingHorizontal: 18, paddingTop: 18 }, detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 }, detailIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 }, detailSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 3 }, detailStack: { gap: 14 }, panel: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 }, divider: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 }, flex: { flex: 1, minWidth: 0 }, icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 17, fontWeight: '800' }, body: { fontSize: 13, lineHeight: 19 }, kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  button: { minHeight: 44, minWidth: 92, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 9 }, buttonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' }, dim: { opacity: 0.55 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, profileImage: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, initials: { fontSize: 21, fontWeight: '800' }, appleButton: { width: '100%', height: 48 }, authStatus: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  link: { fontSize: 13, fontWeight: '800' }, placeRow: { flexDirection: 'row', alignItems: 'center' }, linkGrid: { flexDirection: 'row', gap: 12 }, linkCard: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
});
