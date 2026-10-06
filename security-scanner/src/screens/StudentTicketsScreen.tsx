import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { ApiError } from '../services/apiClient';
import { fetchStudentTickets, type StudentTicket } from '../services/studentTickets';
import { loadStudentTicketCache, saveStudentTicketCache } from '../services/studentTicketStorage';
import { createRotatingTicketCode, createTicketQrPayload, type RotatingTicketCode } from '../services/totp';
import { useSecuritySession } from '../hooks/useSecuritySession';
import { colors, fonts } from '../theme';
import { CloudOff, LogOut, RefreshCw, TicketCheck } from 'lucide-react-native';

export function StudentTicketsScreen() {
  const session = useSecuritySession();
  const { token, serverUrl, user } = session;
  const [tickets, setTickets] = useState<StudentTicket[]>([]);
  const [message, setMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadTickets = useCallback(async (showRefresh = false) => {
    if (!token || !user || user.role !== 'student') {
      setIsLoading(false);
      return;
    }

    setIsRefreshing(showRefresh);
    setMessage('');
    let cachedTickets: StudentTicket[] = [];

    try {
      cachedTickets = await loadStudentTicketCache(serverUrl, user.id);
      setTickets(cachedTickets);
    } catch {
      cachedTickets = [];
    }

    try {
      const freshTickets = await fetchStudentTickets(token);
      setTickets(freshTickets);
      setIsOffline(false);
      await saveStudentTicketCache(serverUrl, user.id, freshTickets).catch(() => undefined);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        setMessage('This student account is no longer authorized. Sign in again to continue.');
        await session.signOut();
      } else if ((!(cause instanceof ApiError) || cause.status >= 500) && cachedTickets.length > 0) {
        setTickets(cachedTickets);
        setIsOffline(true);
        setMessage('Event server unavailable. Showing tickets securely saved on this device.');
      } else {
        setIsOffline(false);
        setMessage(cause instanceof Error ? cause.message : 'Could not load your tickets.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [serverUrl, session, token, user]);

  useEffect(() => {
    void Promise.resolve().then(() => loadTickets());
  }, [loadTickets]);

  async function signOut() {
    setIsSigningOut(true);
    await session.signOut();
    setIsSigningOut(false);
  }

  const firstName = user?.name.trim().split(/\s+/)[0] || 'there';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadTickets(true)} tintColor={colors.gold} colors={[colors.gold]} />}
    >
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/euevent-192.png')} style={styles.logo} accessibilityLabel="EUEvent logo" />
          <View>
            <Text style={styles.wordmark}>EU<Text style={styles.wordmarkGold}>EVENT</Text></Text>
            <Text style={styles.brandCaption}>STUDENT TICKETS</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => void loadTickets(true)} accessibilityRole="button" accessibilityLabel="Refresh tickets" style={styles.iconButton}>
            <RefreshCw size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => void signOut()} disabled={isSigningOut} accessibilityRole="button" accessibilityLabel="Sign out" style={styles.iconButton}>
            {isSigningOut ? <ActivityIndicator color={colors.muted} /> : <LogOut size={18} color={colors.muted} />}
          </Pressable>
        </View>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.eyebrow}>STUDENT ACCESS</Text>
        <Text style={styles.title}>Hi, {firstName}.</Text>
        <Text style={styles.subtitle}>Your event tickets stay ready, even when the connection does not.</Text>
      </View>

      <View style={[styles.connectionPill, isOffline && styles.connectionPillOffline]}>
        {isOffline ? <CloudOff size={13} color={colors.gold} /> : <View style={styles.connectionDot} />}
        <Text style={[styles.connectionText, isOffline && styles.connectionTextOffline]}>
          {isOffline ? 'Secure offline tickets' : 'Ticket account connected'}
        </Text>
      </View>

      {message ? (
        <View style={[styles.messageCard, isOffline && styles.offlineMessage]}>
          <Text style={[styles.messageText, isOffline && styles.offlineMessageText]}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>My tickets</Text>
          <Text style={styles.sectionHint}>{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} on this account</Text>
        </View>
        <View style={styles.ticketCount}><TicketCheck size={14} color={colors.background} /><Text style={styles.ticketCountText}>{tickets.length}</Text></View>
      </View>

      {isLoading && tickets.length === 0 ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.emptyText}>Loading your tickets…</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><TicketCheck size={23} color={colors.gold} /></View>
          <Text style={styles.emptyTitle}>{message ? 'Tickets could not be loaded' : 'No tickets yet'}</Text>
          <Text style={styles.emptyText}>
            {message
              ? 'Connect to the event server and pull down to try again.'
              : 'When an administrator issues a ticket to your student number, it will appear here.'}
          </Text>
        </View>
      ) : (
        tickets.map((ticket) => <StudentTicketCard key={ticket.id} ticket={ticket} />)
      )}

      <View style={styles.securityNote}>
        <View style={styles.securityNoteIcon}><TicketCheck size={16} color={colors.gold} /></View>
        <View style={styles.securityNoteCopy}>
          <Text style={styles.securityNoteTitle}>Your pass refreshes every 30 seconds</Text>
          <Text style={styles.securityNoteBody}>The rotating QR is generated on this phone from a secret saved in secure device storage. Keep your screen brightness up at the gate.</Text>
        </View>
      </View>
      <Text style={styles.footer}>EUEvent · Student entry pass</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StudentTicketCard({ ticket }: { ticket: StudentTicket }) {
  const [now, setNow] = useState(0);
  const [storedCode, setStoredCode] = useState<(RotatingTicketCode & { ticketId: number; secret: string }) | null>(null);
  const [storedCodeError, setStoredCodeError] = useState<{ ticketId: number; secret: string; step: number; message: string } | null>(null);

  const isEventEntryOpen = ticket.event.status === 'scheduled' || ticket.event.status === 'in_progress';
  const canDisplayPass = ticket.status === 'issued' && isEventEntryOpen && ticket.totp_secret !== null;
  const timeStep = Math.floor(now / 30_000);
  const secondsRemaining = 30 - Math.floor((now % 30_000) / 1000);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    if (!canDisplayPass || !ticket.totp_secret || timeStep === 0) {
      return () => { isCurrent = false; };
    }

    void createRotatingTicketCode(ticket.totp_secret, timeStep * 30_000)
      .then((code) => {
        if (isCurrent) {
          setStoredCode({ ...code, ticketId: ticket.id, secret: ticket.totp_secret! });
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setStoredCodeError({
            ticketId: ticket.id,
            secret: ticket.totp_secret!,
            step: timeStep,
            message: cause instanceof Error ? cause.message : 'The rotating ticket code could not be created.',
          });
        }
      });

    return () => { isCurrent = false; };
  }, [canDisplayPass, ticket.id, ticket.totp_secret, timeStep]);

  const rotatingCode = storedCode?.ticketId === ticket.id
    && storedCode.secret === ticket.totp_secret
    && storedCode.step === timeStep
    ? storedCode
    : null;
  const codeError = storedCodeError?.ticketId === ticket.id
    && storedCodeError.secret === ticket.totp_secret
    && storedCodeError.step === timeStep
    ? storedCodeError.message
    : '';
  const qrPayload = rotatingCode
    ? createTicketQrPayload(ticket.id, rotatingCode.step, rotatingCode.code)
    : '';
  const eventDate = new Date(ticket.event.starts_at);
  const eventSchedule = Number.isNaN(eventDate.getTime())
    ? 'Schedule unavailable'
    : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(eventDate);
  const statusText = ticket.status === 'claimed'
    ? 'Used'
    : ticket.status === 'revoked'
      ? 'Revoked'
      : ticket.event.status.replace('_', ' ');

  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketAccent} />
      <View style={styles.ticketHeader}>
        <View style={styles.ticketTitleGroup}>
          <Text style={styles.ticketEyebrow}>{ticket.event.venue_name}</Text>
          <Text style={styles.ticketEventName}>{ticket.event.name}</Text>
          <Text style={styles.ticketSchedule}>{eventSchedule}</Text>
        </View>
        <View style={[styles.ticketStatus, canDisplayPass ? styles.ticketStatusReady : styles.ticketStatusWaiting]}>
          <Text style={[styles.ticketStatusText, canDisplayPass ? styles.ticketStatusTextReady : styles.ticketStatusTextWaiting]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.ticketDetails}>
        <View style={styles.ticketDetail}>
          <Text style={styles.ticketDetailLabel}>GATE</Text>
          <Text style={styles.ticketDetailValue}>{ticket.gate.code} · {ticket.gate.name}</Text>
        </View>
        <View style={styles.ticketDetail}>
          <Text style={styles.ticketDetailLabel}>TICKET</Text>
          <Text style={styles.ticketDetailValue}>#{ticket.id.toString().padStart(6, '0')}</Text>
        </View>
      </View>

      {canDisplayPass ? (
        <View style={styles.qrArea}>
          {rotatingCode && qrPayload ? (
            <>
              <View style={styles.qrFrame}>
                <QRCode value={qrPayload} size={202} color={colors.background} backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.qrHelp}>Show this code to event security</Text>
              <Text style={styles.rotatingCode}>{rotatingCode.code}</Text>
              <View style={styles.timerRow}>
                <View style={styles.timerTrack}>
                  <View style={[styles.timerFill, { width: ((secondsRemaining / 30) * 100).toFixed(2) + '%' as `${number}%` }]} />
                </View>
                <Text style={styles.timerText}>Refreshes in {secondsRemaining}s</Text>
              </View>
            </>
          ) : (
            <View style={styles.qrLoading}>
              <ActivityIndicator color={colors.goldDeep} />
              <Text style={styles.qrHelp}>{codeError || 'Preparing your secure ticket…'}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.passUnavailable}>
          <TicketCheck size={19} color={colors.gold} />
          <Text style={styles.passUnavailableTitle}>
            {ticket.status === 'revoked'
              ? 'This ticket is no longer valid'
              : ticket.status === 'claimed'
                ? 'This ticket has already been used'
                : ticket.event.status === 'cancelled'
                ? 'This event was cancelled'
                : ticket.event.status === 'completed'
                  ? 'This event has ended'
                  : 'Pass available when event is scheduled'}
          </Text>
          <Text style={styles.passUnavailableCopy}>
            {ticket.status === 'claimed'
              ? 'This entry has been recorded. Contact event staff if you believe this is a mistake.'
              : ticket.event.status === 'draft' || ticket.event.status === 'postponed'
              ? 'Your ticket stays on this account. Check again after the administrator updates the event.'
              : 'Contact the event administrator if you think this status is incorrect.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 13 },
  wordmark: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 17, letterSpacing: 0.3 },
  wordmarkGold: { color: colors.gold },
  brandCaption: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1.45 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  greeting: { marginBottom: 15 },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.7, marginBottom: 5 },
  title: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 34, lineHeight: 39 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 310 },
  connectionPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, borderColor: '#286A58', backgroundColor: '#123D32', paddingHorizontal: 11, paddingVertical: 7, marginBottom: 17 },
  connectionPillOffline: { borderColor: '#7B5418', backgroundColor: '#33250D' },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  connectionText: { color: colors.green, fontFamily: fonts.bodyStrong, fontSize: 10 },
  connectionTextOffline: { color: colors.gold },
  messageCard: { backgroundColor: '#49201E', borderRadius: 15, borderWidth: 1, borderColor: '#7B3631', padding: 12, marginBottom: 14 },
  offlineMessage: { backgroundColor: '#33250D', borderColor: '#6B5018' },
  messageText: { color: colors.red, fontFamily: fonts.bodyStrong, fontSize: 11, lineHeight: 17 },
  offlineMessageText: { color: '#E6D5AA' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 23 },
  sectionHint: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, marginTop: 2 },
  ticketCount: { minWidth: 37, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, backgroundColor: colors.gold },
  ticketCountText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 11 },
  loadingCard: { minHeight: 110, justifyContent: 'center', alignItems: 'center', gap: 9, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyCard: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 26, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.surfaceRaised, marginBottom: 11 },
  emptyTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 19 },
  emptyText: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  ticketCard: { overflow: 'hidden', borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  ticketAccent: { height: 4, backgroundColor: colors.gold },
  ticketHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9, paddingHorizontal: 16, paddingTop: 16 },
  ticketTitleGroup: { flex: 1, gap: 4 },
  ticketEyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' },
  ticketEventName: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 22, lineHeight: 25 },
  ticketSchedule: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10 },
  ticketStatus: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  ticketStatusReady: { backgroundColor: '#123D32' },
  ticketStatusWaiting: { backgroundColor: '#49340E' },
  ticketStatusText: { fontFamily: fonts.bodyBold, fontSize: 8, textTransform: 'uppercase' },
  ticketStatusTextReady: { color: colors.green },
  ticketStatusTextWaiting: { color: colors.gold },
  ticketDetails: { flexDirection: 'row', gap: 24, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  ticketDetail: { gap: 3 },
  ticketDetailLabel: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
  ticketDetailValue: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 11 },
  qrArea: { alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, padding: 17 },
  qrFrame: { minWidth: 236, minHeight: 236, alignItems: 'center', justifyContent: 'center', borderRadius: 21, padding: 16, backgroundColor: '#FFFFFF' },
  qrHelp: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, marginTop: 9 },
  rotatingCode: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 28, letterSpacing: 5, marginTop: 6 },
  timerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  timerTrack: { height: 6, flex: 1, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceRaised },
  timerFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },
  timerText: { width: 86, color: colors.muted, fontFamily: fonts.bodyStrong, fontSize: 9, textAlign: 'right' },
  qrLoading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 5 },
  passUnavailable: { alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 18, paddingVertical: 22 },
  passUnavailableTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center', marginTop: 8 },
  passUnavailableCopy: { maxWidth: 270, color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 19, backgroundColor: '#33250D', borderWidth: 1, borderColor: '#6B5018', marginTop: 4 },
  securityNoteIcon: { width: 30, height: 30, borderRadius: 11, backgroundColor: '#49340E', alignItems: 'center', justifyContent: 'center' },
  securityNoteCopy: { flex: 1, gap: 4 },
  securityNoteTitle: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 11 },
  securityNoteBody: { color: '#E6D5AA', fontFamily: fonts.bodyRegular, fontSize: 9, lineHeight: 14 },
  footer: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 10, marginTop: 22 },
});
