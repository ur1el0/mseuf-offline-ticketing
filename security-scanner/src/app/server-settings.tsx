import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleCheck, Server, Wifi } from 'lucide-react-native';
import { useSecuritySession } from '../hooks/useSecuritySession';
import { testApiConnection } from '../services/apiClient';
import { colors, fonts } from '../theme';

export default function ServerSettingsScreen() {
  const session = useSecuritySession();
  const [url, setUrl] = useState(session.serverUrl);
  const [result, setResult] = useState<{ text: string; success: boolean } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  async function checkConnection() {
    setIsChecking(true);
    setResult(null);
    try {
      setResult({ text: await testApiConnection(url), success: true });
    } catch (error) {
      setResult({ text: error instanceof Error ? error.message : 'Connection check failed.', success: false });
    } finally {
      setIsChecking(false);
    }
  }

  async function save() {
    setIsSaving(true);
    try {
      const changed = await session.updateServerUrl(url);
      if (changed) router.replace('/');
      else router.back();
    } catch (error) {
      setResult({ text: error instanceof Error ? error.message : 'Could not save this server URL.', success: false });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.heroIcon}><Server size={24} color={colors.gold} /></View>
      <Text style={styles.eyebrow}>CONNECTION</Text>
      <Text style={styles.title}>Event server</Text>
      <Text style={styles.intro}>Set the Fedora computer or event server that this phone should connect to. Both devices need to be on the same Wi-Fi for a local demo.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>API base URL</Text>
        <TextInput
          value={url}
          onChangeText={(value) => { setUrl(value); setResult(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          placeholder="http://192.168.1.10:8000/api/v1"
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel="API base URL"
        />
        <Text style={styles.help}>Include the full /api/v1 suffix. Use your computer’s LAN IP, not localhost, on a physical phone. HTTP is only for a trusted local demo network.</Text>
        {result ? (
          <View style={[styles.result, result.success ? styles.resultSuccess : styles.resultError]}>
            {result.success ? <CircleCheck size={17} color={colors.green} /> : <Wifi size={17} color={colors.red} />}
            <Text style={[styles.resultText, result.success ? styles.successText : styles.errorText]}>{result.text}</Text>
          </View>
        ) : null}
        <Pressable onPress={() => void checkConnection()} disabled={isChecking} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} accessibilityRole="button">
          {isChecking ? <ActivityIndicator color={colors.gold} /> : <><Wifi size={16} color={colors.gold} /><Text style={styles.secondaryButtonText}>Test connection</Text></>}
        </Pressable>
        <Pressable onPress={() => void save()} disabled={isSaving} style={({ pressed }) => [styles.goldButton, pressed && styles.pressed]} accessibilityRole="button">
          {isSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.goldButtonText}>Save server address</Text>}
        </Pressable>
      </View>
      <Text style={styles.securityNote}>Changing the server signs you out. Each server issues its own session token.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 10, marginBottom: 22 },
  backText: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 13 },
  heroIcon: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, marginBottom: 20 },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.8, marginBottom: 5 },
  title: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 34 },
  intro: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 17 },
  label: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 13, marginBottom: 8 },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 13, minHeight: 51, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  help: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 15, marginTop: 9 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 13, marginTop: 13 },
  resultSuccess: { backgroundColor: '#123D32' },
  resultError: { backgroundColor: '#49201E' },
  resultText: { flex: 1, fontFamily: fonts.bodyStrong, fontSize: 11, lineHeight: 16 },
  successText: { color: colors.green },
  errorText: { color: colors.red },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  secondaryButtonText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12 },
  goldButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold, marginTop: 9 },
  goldButtonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 13 },
  pressed: { opacity: 0.82 },
  securityNote: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 17 },
});
