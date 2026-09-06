import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeChoice } from './app-theme';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import { PlaceDataCredits } from './place-data-credits';
import type { AppleIdentityStatus } from './auth';
import type { SavedPlaceSlot } from './saved-places';

type Props = {
  displayName: string; avatar: string | null; initials: string; appleIdentityStatus: AppleIdentityStatus;
  signingInWithApple: boolean; accountActionPending: boolean; hasAppleAccount: boolean;
  cloud: { status: string; detail: string }; membershipTier: 'free' | 'paid'; membershipExpirationDate: string | null;
  providerName: string; providerDetail: string;
  places: { id: SavedPlaceSlot; label: string; symbol: string; saved: boolean }[];
  onEditProfile: () => void; onAppleSignIn: () => void; onSignOut: () => void; onDeleteAccount: () => void;
  onSync: () => void; onMembership: () => void; onChangeProvider: () => void; onPlace: (slot: SavedPlaceSlot) => void;
  advancedVisible: boolean; onToggleAdvanced: () => void; onDataHealth: () => void; advancedContent: ReactNode;
};

export function IpadSettingsScreen(p: Props) {
  const { theme, setMode } = useThemeChoice();
  const c = theme.isLight
    ? { page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: ivoryPalette.violet, line: ivoryPalette.border, inset: ivoryPalette.lilac }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#b795e5', line: '#49304f', inset: '#291735' };
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  // Use the actual sidebar-adjusted canvas, not the full device width.
  const columns = width >= 660 * Math.max(1, fontScale) ? 3 : 1;
  const topCopy = [s.topCopy, { height: 86 * Math.max(1, fontScale) }];
  const column = columns === 3 ? (width - 24) / 3 : width;
  const panel = [s.panel, { backgroundColor: c.card, borderColor: c.line }];
  const title = [s.title, { color: c.text }];
  const body = [s.body, { color: c.muted }];
  const icon = (name: SFSymbol) => <View style={[s.icon, { backgroundColor: c.inset }]}><SymbolView name={name} tintColor={c.accent} size={25} /></View>;
  const button = (label: string, onPress: () => void, options: { disabled?: boolean; primary?: boolean; accessibilityLabel?: string } = {}) =>
    <Pressable accessibilityRole="button" accessibilityLabel={options.accessibilityLabel ?? label} disabled={options.disabled}
      onPress={onPress} style={({ pressed }) => [s.button, { borderColor: c.line, backgroundColor: options.primary ? c.accent : c.card }, (pressed || options.disabled) && s.dim]}>
      <Text style={[s.buttonText, { color: options.primary ? (theme.isLight ? '#ffffff' : '#180e23') : c.accent }]}>{label}</Text>
    </Pressable>;
  const cloudBusy = p.cloud.status === 'syncing';
  const cloudUnavailable = p.cloud.status === 'unavailable';
  const footer = (label: string, symbol: SFSymbol, onPress: () => void, expanded?: boolean) =>
    <Pressable accessibilityRole={expanded === undefined ? 'link' : 'button'} accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress}
      style={({ pressed }) => [panel, s.footer, { width: column }, pressed && s.dim]}>
      <SymbolView name={symbol} tintColor={c.accent} size={19} /><Text style={[s.footerText, { color: c.text }]}>{label}</Text>
      <SymbolView name={expanded === undefined ? 'arrow.up.right' : expanded ? 'chevron.up' : 'chevron.down'} tintColor={c.accent} size={14} />
    </Pressable>;
  const openPage = (path: 'privacy' | 'support') => {
    void Linking.openURL(`https://journeydeck.me/${path}`).catch(() => Alert.alert('Unable to open page', 'Please try again when you are connected.'));
  };

  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <ScrollView testID="ipad-settings" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}>
      <View testID="ipad-settings-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={s.canvas}>
        <IpadPageHeader title="Settings" width={width} artwork={require('../assets/settings-header-cinematic-v1.png')} />

        <View testID="settings-account-row" style={s.row}>
          <View style={[panel, s.account, { width: columns === 3 ? column * 2 + 12 : column }]}>
            <View style={[s.accountColumn, columns === 1 && s.full]}>
              <View style={topCopy}>
                <View style={s.identity}>{p.avatar ? <Image source={p.avatar} contentFit="cover" style={s.icon} /> : <View style={[s.icon, { backgroundColor: c.inset }]}><Text style={[s.initials, { color: c.accent }]}>{p.initials}</Text></View>}
                  <View style={s.flex}><Text style={title}>Account</Text><Text numberOfLines={2} style={body}>{p.displayName}</Text></View></View>
              </View>
              {button('Edit profile', p.onEditProfile, { accessibilityLabel: 'Edit primary driver profile' })}
              <View style={s.accountLinks}>
                {p.hasAppleAccount && <Pressable accessibilityRole="button" disabled={p.accountActionPending} onPress={p.onSignOut} style={s.textButton}><Text style={[s.link, { color: c.accent }]}>Sign out</Text></Pressable>}
                <Pressable accessibilityRole="button" disabled={p.accountActionPending} onPress={p.onDeleteAccount} style={s.textButton}><Text style={[s.link, { color: c.accent }]}>{p.accountActionPending ? 'Finishing…' : 'Delete account'}</Text></Pressable>
              </View>
            </View>
            <View style={[s.accountColumn, columns === 1 && s.full]}>
              <View style={topCopy}><Text style={title}>Apple Account</Text><Text style={body}>{p.appleIdentityStatus === 'authorized' ? 'Apple connected' : 'Link your driver profile'}</Text></View>
              {p.signingInWithApple ? <View style={s.authStatus}><ActivityIndicator color={c.accent} /><Text style={body}>Finishing sign-in…</Text></View>
                : p.appleIdentityStatus !== 'authorized' ? <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={theme.isLight ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={12} style={s.appleButton} onPress={p.onAppleSignIn} />
                  : <View style={s.authStatus}><SymbolView name="checkmark.circle.fill" tintColor={c.accent} size={21} /><Text style={body}>Connected</Text></View>}
              <Text style={[body, s.note]}>{p.appleIdentityStatus === 'revoked' ? 'Apple access was revoked. Sign in again to relink this profile. Your local journeys are safe.' : 'Use the same Apple Account on both devices.'}</Text>
            </View>
          </View>
          <View style={[panel, { width: column, gap: 0 }]}>
            <View style={topCopy}><View style={s.identity}>{icon('icloud')}<Text style={[title, s.flex]}>iCloud Backup</Text></View></View>
            {button(cloudBusy ? 'Syncing…' : cloudUnavailable ? 'Update app' : 'Sync now', p.onSync, { primary: true, disabled: cloudBusy || cloudUnavailable, accessibilityLabel: 'Sync iCloud now' })}
            <Text accessibilityLiveRegion="polite" style={[body, s.note]}>{p.cloud.detail}</Text>
          </View>
        </View>

        <View testID="settings-preferences-row" style={s.row}>
          <View style={[panel, { width: column }]}><View style={s.identity}>{icon(theme.isLight ? 'sun.max' : 'moon')}<Text style={[title, s.flex]}>Appearance</Text></View>
            <View style={s.preferenceAction}><View style={s.flex}><Text style={[s.label, { color: c.text }]}>Light Mode</Text><Text style={body}>{theme.isLight ? 'Warm ivory' : 'Cinematic dark'}</Text></View>
              <Switch accessibilityLabel="Light Mode" value={theme.isLight} trackColor={{ false: '#594060', true: c.accent }} thumbColor="#fffaf0" onValueChange={enabled => {
                try { setMode(enabled ? 'light' : 'dark'); } catch { Alert.alert('Appearance not saved', 'Please try switching the theme again.'); }
              }} /></View></View>
          <View style={[panel, { width: column }]}><View style={s.identity}>{icon('crown')}<Text style={[title, s.flex]}>Membership</Text></View>
            <View style={s.preferenceAction}><View style={s.flex}><Text style={[s.label, { color: c.text }]}>{p.membershipTier === 'paid' ? 'JourneyDeck Atlas' : 'Free'}</Text><Text style={body}>{p.membershipTier === 'paid' ? 'Complete history' : 'Latest 45 days'}</Text></View>
              {button(p.membershipTier === 'paid' ? 'Manage' : 'Unlock', p.onMembership)}</View>
            {p.membershipTier === 'paid' && p.membershipExpirationDate && <Text style={body}>Through {new Date(p.membershipExpirationDate).toLocaleDateString()}</Text>}</View>
          <View style={[panel, { width: column }]}><View style={s.identity}>{icon('music.note')}<Text style={[title, s.flex]}>Soundtrack capture</Text></View>
            <View style={s.preferenceAction}><View style={s.flex}><Text style={[s.label, { color: c.text }]}>{p.providerName}</Text></View>{button('Change', p.onChangeProvider)}</View>
            <Text style={body}>{p.providerDetail}</Text></View>
        </View>

        <Text accessibilityRole="header" style={[s.sectionTitle, { color: c.muted }]}>SAVED PLACES</Text>
        <View testID="settings-places-row" style={s.row}>{p.places.map(place => <View key={place.id} style={[panel, s.place, { width: column }]}>
          {icon(place.symbol as SFSymbol)}<Text style={title}>{place.label}</Text><Text style={body}>{place.saved ? 'Saved · protected when sharing' : 'Not set'}</Text>
          {button(place.saved ? 'Change' : 'Set', () => p.onPlace(place.id), { accessibilityLabel: `${place.saved ? 'Change' : 'Set'} ${place.label}` })}
        </View>)}</View>

        <View testID="settings-footer-row" style={s.row}>
          {footer('Advanced Support', 'wrench.and.screwdriver', p.onToggleAdvanced, p.advancedVisible)}
          {footer('Privacy Policy', 'hand.raised', () => openPage('privacy'))}
          {footer('Support Page', 'questionmark.circle', () => openPage('support'))}
        </View>
        {p.advancedVisible && <View style={panel}>{button('Open Data Health', p.onDataHealth)}{p.advancedContent}</View>}
        <PlaceDataCredits />
        <Text style={[body, s.guidance]}>Your library stays private in your iCloud account. Use the same iCloud account and Apple-linked driver profile on both devices. Sync on your iPhone first, then sync here.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1400, alignSelf: 'center', gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  panel: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12, minWidth: 0 },
  account: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  accountColumn: { flex: 1, minWidth: 0 }, full: { flexBasis: '100%' },
  topCopy: { minHeight: 86, justifyContent: 'center', gap: 6, paddingBottom: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontSize: 20, fontWeight: '700' }, flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '700' }, body: { fontSize: 13, lineHeight: 19 }, label: { fontSize: 15, fontWeight: '600' },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  buttonText: { fontSize: 14, fontWeight: '600', textAlign: 'center' }, dim: { opacity: 0.5 },
  appleButton: { width: '100%', height: 48 }, authStatus: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 10 }, accountLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  textButton: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 12 },
  preferenceAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 12, letterSpacing: 2, fontWeight: '700', marginTop: 4 },
  place: { alignItems: 'center' }, footer: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  footerText: { flex: 1, fontSize: 14, fontWeight: '600' }, guidance: { textAlign: 'center', paddingHorizontal: 12, paddingVertical: 4 },
});
