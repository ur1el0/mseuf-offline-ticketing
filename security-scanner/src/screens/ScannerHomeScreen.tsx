import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CheckCircle2, CloudDownload, CloudOff, CloudUpload, LogOut, MapPin, RefreshCw, Settings2, ShieldCheck, TicketCheck, Wifi } from 'lucide-react-native';
import { useSecuritySession } from '../hooks/useSecuritySession';
import { fetchAssignedGates, type AssignedGate } from '../services/assignedGates';
import { ApiError } from '../services/apiClient';
import { fetchGateManifest } from '../services/gateManifest';
import {
  clearOfflineGateManifests,
  loadOfflineGateManifests,
  saveOfflineGateManifest,
  summarizeOfflineGateManifest,
  type CachedManifestSummary,
  type OfflineGateManifest,
} from '../services/offlineManifestStore';
import { countPendingScans } from '../services/offlineScanQueue';
import { syncPendingScans } from '../services/scanSync';
import { GateScanModal } from './GateScanModal';
import { colors, fonts } from '../theme';

export function ScannerHomeScreen() {
  const session = useSecuritySession();
  const { token, serverUrl, signOut: endSession } = session;
  const [assignments, setAssignments] = useState<AssignedGate[]>([]);
  const [cachedManifests, setCachedManifests] = useState<Record<number, CachedManifestSummary>>({});
  const [offlineManifests, setOfflineManifests] = useState<Record<number, OfflineGateManifest>>({});
  const [selectedScanGateId, setSelectedScanGateId] = useState<number | null>(null);
  const [pendingScansCount, setPendingScansCount] = useState(0);
  const [isSyncingScans, setIsSyncingScans] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [message, setMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingGateId, setDownloadingGateId] = useState<number | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const staffId = session.user?.id;

  const refreshQueue = useCallback(async (attemptSync = false) => {
    if (!staffId) {
      setPendingScansCount(0);
      return;
    }

    try {
      let pendingCount = await countPendingScans(serverUrl, staffId);
      setPendingScansCount(pendingCount);
      if (attemptSync && pendingCount > 0 && token) {
        setIsSyncingScans(true);
        setSyncMessage('');
        try {
          const summary = await syncPendingScans(token, serverUrl, staffId);
          pendingCount = await countPendingScans(serverUrl, staffId);
          setPendingScansCount(pendingCount);
          if (summary.accepted || summary.rejected) {
            setSyncMessage(summary.rejected
              ? `${summary.accepted} accepted · ${summary.rejected} rejected (${summary.reasons.join(', ')})`
              : `${summary.accepted} offline ${summary.accepted === 1 ? 'scan' : 'scans'} synchronized`);
          }
        } catch {
          setSyncMessage('Scans remain encrypted on this device and will retry when the server is reachable.');
        } finally {
          setIsSyncingScans(false);
        }
      }
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : 'Could not read the local scan queue.');
    }
  }, [serverUrl, staffId, token]);

  const handleQueueChanged = useCallback(() => {
    void refreshQueue(false);
  }, [refreshQueue]);

  const loadAssignments = useCallback(async (showRefresh = false) => {
    if (!token || !staffId) return;
    setIsRefreshing(showRefresh);
    setMessage('');
    let savedManifests: Awaited<ReturnType<typeof loadOfflineGateManifests>> = [];

    try {
      savedManifests = await loadOfflineGateManifests(serverUrl, staffId);
      setOfflineManifests(Object.fromEntries(savedManifests.map((snapshot) => [snapshot.assignment.gate_id, snapshot])));
      setCachedManifests(Object.fromEntries(savedManifests.map((snapshot) => [
        snapshot.assignment.gate_id,
        summarizeOfflineGateManifest(snapshot),
      ])));
      if (savedManifests.length > 0) {
        setAssignments(savedManifests.map((snapshot) => snapshot.assignment));
        setIsLoading(false);
      }
    } catch {
      setCachedManifests({});
      setOfflineManifests({});
    }

    try {
      setAssignments(await fetchAssignedGates(token));
      setIsOffline(false);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        setMessage('This staff account is no longer authorized. Sign in again to load current assignments.');
        await endSession();
      } else if ((!(cause instanceof ApiError) || cause.status >= 500) && savedManifests.length > 0) {
        setAssignments(savedManifests.map((snapshot) => snapshot.assignment));
        setIsOffline(true);
        setMessage('Event server unavailable. Showing this device’s last downloaded gate manifests.');
      } else {
        setIsOffline(false);
        setMessage(cause instanceof Error ? cause.message : 'Could not load gate assignments.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      void refreshQueue(true);
    }
  }, [endSession, refreshQueue, serverUrl, staffId, token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadAssignments());
  }, [loadAssignments]);

  async function downloadManifest(assignment: AssignedGate) {
    if (!session.token || !staffId || isOffline) return;
    setDownloadingGateId(assignment.gate_id);
    try {
      const manifest = await fetchGateManifest(session.token, assignment.gate_id);
      const snapshot = await saveOfflineGateManifest(
        session.serverUrl,
        staffId,
        assignment,
        manifest,
      );
      setOfflineManifests((current) => ({ ...current, [assignment.gate_id]: snapshot }));
      setCachedManifests((current) => ({
        ...current,
        [assignment.gate_id]: summarizeOfflineGateManifest(snapshot),
      }));
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        await session.signOut();
      } else {
        Alert.alert(
          'Manifest not saved',
          cause instanceof Error ? cause.message : 'Could not download this gate manifest.',
        );
      }
    } finally {
      setDownloadingGateId(null);
    }
  }

  async function signOut() {
    if (staffId && pendingScansCount > 0) {
      Alert.alert(
        'Scans are waiting to sync',
        `${pendingScansCount} validated ${pendingScansCount === 1 ? 'scan is' : 'scans are'} still encrypted on this device. Signing out keeps them here for this staff account to sync later.`,
        [
          { text: 'Stay signed in', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: () => {
              setIsSigningOut(true);
              void endSession().finally(() => setIsSigningOut(false));
            },
          },
        ],
      );
      return;
    }
    setIsSigningOut(true);
    await endSession();
    setIsSigningOut(false);
  }

  const selectedAssignment = assignments.find((assignment) => assignment.gate_id === selectedScanGateId);
  const selectedManifest = selectedScanGateId === null ? undefined : offlineManifests[selectedScanGateId];

  return (
    <>
      <SafeAreaView style={styles.screen}>
        <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadAssignments(true)} tintColor={colors.gold} colors={[colors.gold]} />}
    >
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/euevent-192.png')} style={styles.logo} accessibilityLabel="EUEvent logo" />
          <View>
            <Text style={styles.wordmark}>EU<Text style={styles.wordmarkGold}>EVENT</Text></Text>
            <Text style={styles.brandCaption}>GATE OPERATIONS</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/server-settings')} accessibilityRole="button" accessibilityLabel="Server settings" style={styles.iconButton}>
            <Settings2 size={18} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => void signOut()} disabled={isSigningOut} accessibilityRole="button" accessibilityLabel="Sign out" style={styles.iconButton}>
            {isSigningOut ? <ActivityIndicator color={colors.muted} /> : <LogOut size={18} color={colors.muted} />}
          </Pressable>
        </View>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.eyebrow}>SECURITY STAFF</Text>
        <Text style={styles.title}>Hi, {session.user?.name.split(' ')[0]}.</Text>
        <Text style={styles.subtitle}>Here are your assigned event gates.</Text>
      </View>

      <View style={[styles.statusPill, (Boolean(message) || isOffline) && styles.statusPillOffline]}>
        <View style={[styles.statusDot, (Boolean(message) || isOffline) && styles.statusDotOffline]} />
        <Text style={[styles.statusPillText, (Boolean(message) || isOffline) && styles.statusPillTextOffline]}>
          {isLoading ? 'Connecting to event server' : isOffline ? 'Offline · local manifests available' : message ? 'Server unavailable' : 'Connected to event server'}
        </Text>
        <Wifi size={14} color={(message || isOffline) ? colors.red : colors.green} />
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Your assignments</Text>
          <Text style={styles.sectionHint}>Current assignments or the last saved offline copies.</Text>
        </View>
        <Pressable onPress={() => void loadAssignments(true)} disabled={isRefreshing} accessibilityRole="button" accessibilityLabel="Refresh assignments" style={styles.refreshButton}>
          {isRefreshing ? <ActivityIndicator color={colors.gold} /> : <RefreshCw size={16} color={colors.gold} />}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Loading your gate assignments…</Text></View>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      {pendingScansCount > 0 ? (
        <View style={styles.pendingQueue}>
          <View style={styles.pendingQueueCopy}>
            <Text style={styles.pendingQueueTitle}>{pendingScansCount} {pendingScansCount === 1 ? 'scan' : 'scans'} waiting to sync</Text>
            <Text style={styles.pendingQueueText}>{syncMessage || 'The saved scan queue is encrypted on this device.'}</Text>
          </View>
          <Pressable onPress={() => void refreshQueue(true)} disabled={isSyncingScans} style={styles.syncButton}>
            {isSyncingScans ? <ActivityIndicator color={colors.background} size="small" /> : <CloudUpload size={15} color={colors.background} />}
            <Text style={styles.syncButtonText}>{isSyncingScans ? 'Syncing' : 'Sync'}</Text>
          </Pressable>
        </View>
      ) : syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
      {!isLoading && !message && assignments.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><MapPin size={22} color={colors.gold} /></View>
          <Text style={styles.emptyTitle}>No gates assigned yet</Text>
          <Text style={styles.emptyText}>Ask an administrator to assign you to an event gate, then refresh this screen.</Text>
        </View>
      ) : null}
      {assignments.map((assignment) => {
        const snapshot = offlineManifests[assignment.gate_id];
        const manifestVersionMismatch = snapshot !== undefined
          && snapshot.manifest.manifest_version !== assignment.manifest_version;

        return (
          <AssignmentCard
            key={assignment.gate_id}
            assignment={assignment}
            cachedManifest={cachedManifests[assignment.gate_id]}
            isDownloading={downloadingGateId === assignment.gate_id}
            isOffline={isOffline}
            manifestVersionMismatch={manifestVersionMismatch}
            canScan={Boolean(snapshot) && (!manifestVersionMismatch || isOffline)}
            onScan={() => setSelectedScanGateId(assignment.gate_id)}
            onDownload={() => void downloadManifest(assignment)}
          />
        );
      })}

      <View style={styles.checklistCard}>
        <Text style={styles.checklistHeading}>Before doors open</Text>
        <ChecklistRow icon={<ShieldCheck size={17} color={colors.green} />} title="Signed in as security staff" detail={session.user?.name ?? ''} done />
        <ChecklistRow icon={<TicketCheck size={17} color={assignments.length ? colors.green : colors.muted} />} title="Gate assignments loaded" detail={`${assignments.length} assigned ${assignments.length === 1 ? 'gate' : 'gates'}`} done={assignments.length > 0} />
        <ChecklistRow
          icon={<CloudOff size={17} color={Object.keys(cachedManifests).length ? colors.green : colors.gold} />}
          title="Encrypted offline manifests"
          detail={`${Object.keys(cachedManifests).length} ${Object.keys(cachedManifests).length === 1 ? 'gate' : 'gates'} prepared on this device`}
          done={Object.keys(cachedManifests).length > 0}
          last
        />
      </View>

      <View style={styles.offlineNotice}>
        <View style={styles.noticeIcon}><CloudOff size={17} color={colors.gold} /></View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Prepare each gate before doors open</Text>
          <Text style={styles.noticeBody}>Download the current ticket manifest while online. QR codes are checked on this phone; encrypted scan records sync when the event server is reachable.</Text>
        </View>
      </View>
      <Pressable
        onPress={() => Alert.alert(
          'Clear offline manifests?',
          'This removes the encrypted ticket data saved on this phone. Download the manifests again before the event.',
          [
            { text: 'Keep manifests', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: () => {
                void clearOfflineGateManifests()
                  .then(() => {
                    setCachedManifests({});
                    setOfflineManifests({});
                  })
                  .catch(() => Alert.alert('Could not clear manifests', 'Please try again.'));
              },
            },
          ],
        )}
        accessibilityRole="button"
        style={styles.clearCacheButton}
      >
        <Text style={styles.clearCacheText}>Clear saved offline manifests</Text>
      </Pressable>
      <Text style={styles.footer}>EUEvent · Secure entry operations</Text>
        </ScrollView>
      </SafeAreaView>
    {selectedAssignment && selectedManifest ? (
      <GateScanModal
        visible
        assignment={selectedAssignment}
        snapshot={selectedManifest}
        serverUrl={serverUrl}
        staffId={staffId ?? 0}
        token={token ?? ''}
        pendingScanCount={pendingScansCount}
        onClose={() => setSelectedScanGateId(null)}
        onQueueChanged={handleQueueChanged}
      />
    ) : null}
    </>
  );
}

function AssignmentCard({
  assignment,
  cachedManifest,
  isDownloading,
  isOffline,
  manifestVersionMismatch,
  canScan,
  onScan,
  onDownload,
}: {
  assignment: AssignedGate;
  cachedManifest?: CachedManifestSummary;
  isDownloading: boolean;
  isOffline: boolean;
  manifestVersionMismatch: boolean;
  canScan: boolean;
  onScan: () => void;
  onDownload: () => void;
}) {
  const statusLabel = assignment.event_status.replace('_', ' ');
  const eventDate = new Date(assignment.starts_at);
  const schedule = Number.isNaN(eventDate.getTime())
    ? 'Schedule unavailable'
    : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(eventDate);
  const isActive = assignment.event_status === 'scheduled' || assignment.event_status === 'in_progress';

  return (
    <View style={styles.assignmentCard}>
      <View style={styles.assignmentHeader}>
        <View style={styles.assignmentIcon}><MapPin size={19} color={colors.gold} /></View>
        <View style={styles.assignmentCopy}>
          <Text style={styles.gateName}>{assignment.gate_name}</Text>
          <Text style={styles.gateMeta}>{assignment.gate_code} · Gate ID {assignment.gate_id}</Text>
        </View>
        <View style={[styles.eventBadge, isActive ? styles.eventBadgeActive : styles.eventBadgeOther]}>
          <Text style={[styles.eventBadgeText, isActive ? styles.eventBadgeTextActive : styles.eventBadgeTextOther]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.eventName}>{assignment.event_name}</Text>
      <Text style={styles.schedule}>{schedule}</Text>
      <View style={styles.assignmentStats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>VALID TICKETS</Text>
          <Text style={styles.statValue}>{assignment.ticket_count.toLocaleString()}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>CONFIGURATION</Text>
          <Text style={styles.statValue}>v{assignment.manifest_version}</Text>
        </View>
      </View>
      <View style={styles.manifestRow}>
        <View style={styles.manifestCopy}>
          {cachedManifest ? (
            <>
              <Text style={styles.manifestReady}><CheckCircle2 size={13} color={colors.green} />  Encrypted copy · {cachedManifest.ticketCount} tickets</Text>
              <Text style={styles.manifestMeta}>Version {cachedManifest.manifestVersion} · downloaded {formatDownloadedAt(cachedManifest.downloadedAt)}</Text>
            </>
          ) : (
            <Text style={styles.manifestMeta}>No offline manifest saved for this gate yet.</Text>
          )}
        </View>
        <View style={styles.manifestActions}>
          {canScan ? (
            <Pressable onPress={onScan} disabled={!isActive} accessibilityRole="button" style={[styles.scanButton, !isActive && styles.downloadButtonDisabled]}>
              <Camera size={15} color={colors.gold} />
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDownload}
            disabled={isDownloading || isOffline || !isActive}
            accessibilityRole="button"
            style={[styles.downloadButton, (isDownloading || isOffline || !isActive) && styles.downloadButtonDisabled]}
          >
            {isDownloading
              ? <ActivityIndicator color={colors.background} size="small" />
              : <CloudDownload size={15} color={colors.background} />}
            <Text style={styles.downloadButtonText}>
              {isDownloading ? 'Saving' : cachedManifest ? 'Update' : 'Prepare'}
            </Text>
          </Pressable>
        </View>
      </View>
      {manifestVersionMismatch ? (
        <Text style={styles.manifestUnavailable}>
          {isOffline
            ? 'Offline: this saved manifest is out of date. Use the event’s offline admission procedure; local results may miss later changes.'
            : 'The event changed after this manifest was saved. Update the manifest before scanning.'}
        </Text>
      ) : null}
      {!isActive ? <Text style={styles.manifestUnavailable}>Manifests are available when the event is scheduled or in progress.</Text> : null}
    </View>
  );
}

function formatDownloadedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'recently'
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function ChecklistRow({ icon, title, detail, done, last = false }: { icon: React.ReactNode; title: string; detail: string; done: boolean; last?: boolean }) {
  return (
    <View style={[styles.checklistRow, !last && styles.checklistBorder]}>
      <View style={styles.checkIcon}>{icon}</View>
      <View style={styles.checkCopy}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkDetail}>{detail}</Text>
      </View>
      <View style={[styles.checkBadge, done ? styles.checkBadgeDone : styles.checkBadgePending]}>
        <Text style={[styles.checkBadgeText, done ? styles.checkBadgeTextDone : styles.checkBadgeTextPending]}>{done ? 'READY' : 'NEXT'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 13 },
  wordmark: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 17, letterSpacing: 0.3 },
  wordmarkGold: { color: colors.gold },
  brandCaption: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1.45 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  greeting: { marginBottom: 16 },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.7, marginBottom: 5 },
  title: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 34, lineHeight: 39 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#286A58', backgroundColor: '#123D32', paddingHorizontal: 12, paddingVertical: 7, marginBottom: 19 },
  statusPillOffline: { borderColor: '#7B3631', backgroundColor: '#49201E' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  statusDotOffline: { backgroundColor: colors.red },
  statusPillText: { color: colors.green, fontFamily: fonts.bodyStrong, fontSize: 11 },
  statusPillTextOffline: { color: colors.red },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 23 },
  sectionHint: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, marginTop: 2 },
  refreshButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  loadingCard: { minHeight: 108, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 13 },
  loadingText: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  error: { color: colors.red, fontFamily: fonts.bodyStrong, fontSize: 12, lineHeight: 18, backgroundColor: '#49201E', borderRadius: 14, padding: 12, marginBottom: 13 },
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 21, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 25, marginBottom: 14 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 20 },
  emptyText: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 5 },
  assignmentCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 21, padding: 15, marginBottom: 12 },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assignmentIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  assignmentCopy: { flex: 1, gap: 3 },
  gateName: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  gateMeta: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 9 },
  eventBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  eventBadgeActive: { backgroundColor: '#123D32' },
  eventBadgeOther: { backgroundColor: colors.surfaceRaised },
  eventBadgeText: { fontFamily: fonts.bodyBold, fontSize: 8, textTransform: 'uppercase' },
  eventBadgeTextActive: { color: colors.green },
  eventBadgeTextOther: { color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  eventName: { color: colors.text, fontFamily: fonts.heading, fontSize: 19 },
  schedule: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, marginTop: 3 },
  assignmentStats: { flexDirection: 'row', gap: 28, marginTop: 13 },
  stat: { gap: 3 },
  statLabel: { color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
  statValue: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 12 },
  manifestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 12 },
  manifestActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  scanButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  scanButtonText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 10 },
  manifestCopy: { flex: 1, gap: 4 },
  manifestReady: { color: colors.green, fontFamily: fonts.bodyBold, fontSize: 10 },
  manifestMeta: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 9, lineHeight: 14 },
  downloadButton: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.gold },
  downloadButtonDisabled: { opacity: 0.45 },
  downloadButtonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 10 },
  manifestUnavailable: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 9, marginTop: 8 },
  checklistCard: { padding: 16, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 3, marginBottom: 14 },
  checklistHeading: { color: colors.text, fontFamily: fonts.heading, fontSize: 20, marginBottom: 8 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', minHeight: 61, gap: 10 },
  checklistBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  checkIcon: { width: 31, alignItems: 'center' },
  checkCopy: { flex: 1, gap: 3 },
  checkTitle: { color: colors.text, fontFamily: fonts.bodyStrong, fontSize: 12 },
  checkDetail: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 14 },
  checkBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  checkBadgeDone: { backgroundColor: '#123D32' },
  checkBadgePending: { backgroundColor: colors.surfaceRaised },
  checkBadgeText: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.7 },
  checkBadgeTextDone: { color: colors.green },
  checkBadgeTextPending: { color: colors.gold },
  pendingQueue: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, backgroundColor: '#33250D', borderWidth: 1, borderColor: '#6B5018', marginBottom: 14 },
  pendingQueueCopy: { flex: 1, gap: 3 },
  pendingQueueTitle: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12 },
  pendingQueueText: { color: '#E6D5AA', fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 14 },
  syncButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 13, backgroundColor: colors.gold },
  syncButtonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 10 },
  syncMessage: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, marginBottom: 12 },
  offlineNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, backgroundColor: '#33250D', borderWidth: 1, borderColor: '#6B5018' },
  noticeIcon: { width: 30, height: 30, borderRadius: 11, backgroundColor: '#49340E', alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12 },
  noticeBody: { color: '#E6D5AA', fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 15 },
  clearCacheButton: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  clearCacheText: { color: colors.muted, fontFamily: fonts.bodyStrong, fontSize: 10 },
  footer: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 10, marginTop: 22 },
});
