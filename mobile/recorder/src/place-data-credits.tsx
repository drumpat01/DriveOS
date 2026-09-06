import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeChoice } from './app-theme';
import licenses from '../assets/overture-licenses.json';

/** Bundled licenses remain readable offline alongside cached public places. */
export function PlaceDataCredits() {
  const [visible, setVisible] = useState(false);
  const { theme } = useThemeChoice();
  const ink = theme.isLight ? '#704582' : '#cda8ea';
  const text = theme.isLight ? '#2a202b' : '#f8effb';
  const backgroundColor = theme.isLight ? '#fff9ef' : '#120919';
  return <>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: ink, fontSize: 13, fontWeight: '600' }}>Place data credits</Text>
    </Pressable>
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor }}>
        <View style={{ paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={{ color: text, fontSize: 21, fontWeight: '700' }}>Place data</Text>
          <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={{ padding: 16 }}><Text style={{ color: ink, fontSize: 17 }}>Done</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
          {licenses.map(item => <View key={item.title} style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ color: text, fontSize: 18, fontWeight: '700' }}>{item.title}</Text>
            <Text selectable style={{ color: text, fontSize: 14, lineHeight: 21 }}>{item.text}</Text>
          </View>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
