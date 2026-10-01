import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyRound, Server, Settings2, ShieldCheck } from 'lucide-react-native';
import { useSecuritySession } from '../hooks/useSecuritySession';
import { colors, fonts } from '../theme';

export function SignInScreen() {
  const session = useSecuritySession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError('');
    setIsSubmitting(true);
    try {
      await session.signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Image source={require('../../assets/euevent-192.png')} style={styles.logo} accessibilityLabel="EUEvent logo" />
            <View style={styles.brandText}>
              <Text style={styles.wordmark}>EU<Text style={styles.wordmarkGold}>EVENT</Text></Text>
              <Text style={styles.brandCaption}>SECURITY SCANNER</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/server-settings')} accessibilityRole="button" accessibilityLabel="Configure event server" style={styles.settingsButton}>
            <Settings2 color={colors.muted} size={19} />
          </Pressable>
        </View>

        <View style={styles.heroIcon}>
          <ShieldCheck color={colors.gold} size={28} strokeWidth={2.2} />
        </View>
        <Text style={styles.eyebrow}>STAFF ACCESS</Text>
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.intro}>Sign in with your staff account to view your assigned event gates.</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Staff email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@school.edu.ph"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="next"
            style={styles.input}
            accessibilityLabel="Staff email"
          />
          <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
          <View style={styles.passwordWrap}>
            <KeyRound color={colors.muted} size={18} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={styles.passwordInput}
              accessibilityLabel="Password"
            />
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => void submit()}
            disabled={isSubmitting || !email.trim() || !password}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, (pressed || isSubmitting) && styles.buttonPressed, (!email.trim() || !password) && styles.buttonDisabled]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>Sign in securely</Text>}
          </Pressable>
          <Text style={styles.secureNote}>Your session token is stored in the device secure store.</Text>
        </View>

        <Pressable onPress={() => router.push('/server-settings')} style={styles.serverRow} accessibilityRole="button">
          <Server size={15} color={colors.muted} />
          <Text style={styles.serverText} numberOfLines={1}>{session.serverUrl}</Text>
          <Text style={styles.serverAction}>Change</Text>
        </Pressable>
        <Text style={styles.footer}>For authorized event security staff only</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 36, paddingBottom: 30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 15 },
  brandText: { gap: 1 },
  wordmark: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 19, letterSpacing: 0.4 },
  wordmarkGold: { color: colors.gold },
  brandCaption: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.7 },
  settingsButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, marginBottom: 22 },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8, marginBottom: 7 },
  title: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 38, lineHeight: 42 },
  intro: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 24, maxWidth: 320 },
  formCard: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18 },
  label: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 13, marginBottom: 8 },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 15, minHeight: 52, paddingHorizontal: 15 },
  passwordLabel: { marginTop: 17 },
  passwordWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 15, paddingHorizontal: 14 },
  passwordInput: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
  error: { color: colors.red, fontFamily: fonts.bodyStrong, fontSize: 12, lineHeight: 18, marginTop: 12 },
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold, borderRadius: 16, marginTop: 20 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.48 },
  buttonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 15 },
  secureNote: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 11, marginTop: 14 },
  serverRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingHorizontal: 4 },
  serverText: { flex: 1, color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10 },
  serverAction: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 10 },
  footer: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 11, marginTop: 25 },
});
