import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Camera, CheckCircle2, CloudOff, X } from 'lucide-react-native';
import type { AssignedGate } from '../services/assignedGates';
import type { OfflineGateManifest } from '../services/offlineManifestStore';
import { hasScannedTicket, savePendingScan, type PendingScan } from '../services/offlineScanQueue';
import { syncPendingScans } from '../services/scanSync';
import { validateTicketQr } from '../services/ticketValidation';
import { colors, fonts } from '../theme';

export function GateScanModal({
  visible,
  assignment,
  snapshot,
  serverUrl,
  staffId,
  token,
  pendingScanCount,
  onClose,
  onQueueChanged,
}: {
  visible: boolean;
  assignment: AssignedGate;
  snapshot: OfflineGateManifest;
  serverUrl: string;
  staffId: number;
  token: string;
  pendingScanCount: number;
  onClose: () => void;
  onQueueChanged: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error' | 'neutral'; title: string; detail: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncIssue, setSyncIssue] = useState('');
  const scanLock = useRef(false);
  const syncInFlight = useRef(false);
  const syncRequested = useRef(false);
  const retryAfter = useRef(0);
  const activeScanId = useRef<string | null>(null);
  const requestSyncRef = useRef<() => void>(() => undefined);

  const requestBackgroundSync = useCallback(() => {
    if (!token || Date.now() < retryAfter.current) return;
    if (syncInFlight.current) {
      syncRequested.current = true;
      return;
    }

    syncInFlight.current = true;
    syncRequested.current = false;
    setIsSyncing(true);

    void syncPendingScans(token, serverUrl, staffId)
      .then((summary) => {
        retryAfter.current = 0;
        onQueueChanged();

        const rejectedOutcomes = summary.outcomes.filter((outcome) => outcome.decision === 'rejected');
        if (rejectedOutcomes.length > 0) {
          const reason = serverReason(rejectedOutcomes[0].reason_code);
          setSyncIssue(`${rejectedOutcomes.length} queued ${rejectedOutcomes.length === 1 ? 'scan was' : 'scans were'} rejected after sync. ${reason} Ask the event lead to review entry.`);
          setSyncStatus(`${summary.accepted} accepted · ${summary.rejected} rejected after sync`);
        } else if (summary.accepted > 0) {
          setSyncIssue('');
          setSyncStatus(`${summary.accepted} ${summary.accepted === 1 ? 'scan' : 'scans'} confirmed by the event server.`);
        }

        const displayedScanId = activeScanId.current;
        const scanOutcome = displayedScanId
          ? summary.outcomes.find((outcome) => outcome.scan_id === displayedScanId)
          : undefined;
        if (displayedScanId && scanOutcome?.decision === 'accepted') {
          setResult({ tone: 'success', title: 'Entry accepted · synced', detail: 'The event server confirmed this ticket. The scan is recorded in the event log.' });
        } else if (displayedScanId && scanOutcome?.decision === 'rejected') {
          setResult({ tone: 'error', title: 'Server rejected this scan', detail: serverReason(scanOutcome.reason_code) });
        }
      })
      .catch(() => {
        retryAfter.current = Date.now() + 30_000;
        syncRequested.current = false;
        setSyncStatus('Server unavailable. Scans stay saved on this phone; scanning can continue while sync retries in the background.');
      })
      .finally(() => {
        syncInFlight.current = false;
        setIsSyncing(false);

        if (syncRequested.current && Date.now() >= retryAfter.current) {
          syncRequested.current = false;
          requestSyncRef.current();
        }
      });
  }, [onQueueChanged, serverUrl, staffId, token]);

  useEffect(() => {
    requestSyncRef.current = requestBackgroundSync;
  }, [requestBackgroundSync]);

  useEffect(() => {
    if (!visible || !token) return;

    requestBackgroundSync();
    const retryInterval = setInterval(() => requestBackgroundSync(), 15_000);
    return () => clearInterval(retryInterval);
  }, [requestBackgroundSync, token, visible]);

  async function handleBarcode({ data }: { data: string }) {
    if (!visible || !isScanning || scanLock.current) return;
    scanLock.current = true;
    setIsScanning(false);
    setIsProcessing(true);
    setResult(null);

    try {
      const check = await validateTicketQr(data, snapshot.manifest, assignment.gate_id);
      if (!check.valid) {
        setResult({ tone: 'error', title: invalidTitle(check.reason), detail: invalidDetail(check.reason) });
        return;
      }

      const alreadyScanned = await hasScannedTicket(serverUrl, staffId, check.ticket.ticket_id);
      if (alreadyScanned) {
        setResult({ tone: 'error', title: 'Ticket already scanned', detail: 'This device has already recorded this ticket. Do not admit it again.' });
        return;
      }

      const scan: PendingScan = {
        scan_id: Crypto.randomUUID(),
        ticket_id: check.ticket.ticket_id,
        gate_id: assignment.gate_id,
        scanned_at: Date.now(),
        is_override: false,
        event_configuration_version: snapshot.manifest.manifest_version,
        code_step: check.timeStep,
        code: check.code,
      };
      const saved = await savePendingScan(serverUrl, staffId, scan);
      if (!saved) {
        setResult({ tone: 'error', title: 'Ticket already scanned', detail: 'This device has already recorded this ticket. Do not admit it again.' });
        return;
      }

      onQueueChanged();
      activeScanId.current = scan.scan_id;
      setSyncStatus('Saved on this phone. Server confirmation can happen in the background.');
      setResult({ tone: 'success', title: 'Locally validated · saved on device', detail: 'The rotating code matches this saved gate manifest. This is not server confirmation; offline checks cannot see later revocations, event changes, or scans at other disconnected gates. Follow the event’s offline admission procedure and sync promptly.' });
      if (token) {
        requestBackgroundSync();
      }
    } catch (cause) {
      setResult({
        tone: 'error',
        title: 'Could not record scan',
        detail: cause instanceof Error ? cause.message : 'Check the encrypted device storage and try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  }

  function scanNext() {
    scanLock.current = false;
    activeScanId.current = null;
    setResult(null);
    setIsScanning(true);
  }

  const cameraAllowed = permission?.granted === true;
  const cameraCanBeRequested = permission?.canAskAgain !== false;
  const manifestDate = new Date(snapshot.downloadedAt);
  const manifestTimestamp = Number.isNaN(manifestDate.getTime())
    ? 'an unknown time'
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(manifestDate);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>SECURITY SCANNER</Text>
            <Text style={styles.title} numberOfLines={1}>{assignment.gate_code} · {assignment.gate_name}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{assignment.event_name} · manifest v{snapshot.manifest.manifest_version}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner" style={styles.closeButton}>
            <X size={19} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.manifestWarning}>
          <AlertTriangle size={16} color={colors.gold} />
          <Text style={styles.manifestWarningText}>
            Snapshot downloaded {manifestTimestamp}. Offline scans cannot receive later ticket revocations, event changes, or other gates’ scans; admission stays provisional until sync.
          </Text>
        </View>

        {syncIssue ? (
          <View style={styles.syncIssue} accessibilityRole="alert">
            <AlertTriangle size={15} color={colors.red} />
            <Text style={styles.syncIssueText}>{syncIssue}</Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <View style={styles.permissionCard}>
            <CloudOff size={26} color={colors.gold} />
            <Text style={styles.permissionTitle}>Use the mobile scanner</Text>
            <Text style={styles.permissionCopy}>Camera scanning and encrypted offline scan storage are available in the iOS or Android app.</Text>
          </View>
        ) : permission === null ? (
          <View style={styles.permissionCard}><ActivityIndicator color={colors.gold} /><Text style={styles.permissionCopy}>Checking camera access…</Text></View>
        ) : !cameraAllowed ? (
          <View style={styles.permissionCard}>
            <Camera size={27} color={colors.gold} />
            <Text style={styles.permissionTitle}>Camera access needed</Text>
            <Text style={styles.permissionCopy}>EUEvent uses the camera to read student ticket QR codes. The image is checked on this phone and is not uploaded.</Text>
            <Pressable onPress={() => cameraCanBeRequested ? void requestPermission() : void Linking.openSettings()} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>{cameraCanBeRequested ? 'Allow camera' : 'Open settings'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cameraFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                active={visible && cameraAllowed}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={isScanning ? handleBarcode : undefined}
              />
              {isScanning ? <View pointerEvents="none" style={styles.scanGuide}><View style={styles.scanGuideCorner} /><View style={[styles.scanGuideCorner, styles.scanGuideTopRight]} /><View style={[styles.scanGuideCorner, styles.scanGuideBottomLeft]} /><View style={[styles.scanGuideCorner, styles.scanGuideBottomRight]} /></View> : null}
            </View>

            <View style={styles.instructionRow}>
              <View style={styles.instructionIcon}><Camera size={17} color={colors.gold} /></View>
              <View style={styles.instructionCopy}>
                <Text style={styles.instructionTitle}>{isScanning ? 'Align the student QR in the frame' : 'Scan paused'}</Text>
                <Text style={styles.instructionText}>This phone checks the rotating code against the encrypted gate manifest. Network access is not needed for the check, but offline results are not confirmed by the event server.</Text>
              </View>
            </View>

            {result ? (
              <View style={[styles.resultCard, result.tone === 'success' ? styles.resultSuccess : result.tone === 'error' ? styles.resultError : styles.resultNeutral]}>
                <View style={styles.resultHeading}>
                  {isSyncing ? <ActivityIndicator color={result.tone === 'error' ? colors.red : colors.green} /> : <CheckCircle2 size={20} color={result.tone === 'error' ? colors.red : colors.green} />}
                  <Text style={[styles.resultTitle, result.tone === 'error' && styles.resultTitleError]}>{isSyncing ? 'Syncing saved scans in background…' : result.title}</Text>
                </View>
                <Text style={styles.resultDetail}>{result.detail}</Text>
                {!isScanning && !isProcessing ? (
                  <Pressable onPress={scanNext} style={styles.scanNextButton}><Text style={styles.scanNextText}>Scan next ticket</Text></Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{snapshot.manifest.tickets.length} tickets prepared for this gate</Text>
          <Text style={styles.footerText}>
            {pendingScanCount > 0
              ? `${pendingScanCount} ${pendingScanCount === 1 ? 'scan is' : 'scans are'} waiting for server confirmation. Continue scanning; queued scans stay encrypted on this device.`
              : syncStatus || 'Keep the screen visible at the door. Offline scans stay encrypted on this device until they are synchronized.'}
          </Text>
          {isProcessing ? <ActivityIndicator style={styles.processing} color={colors.gold} /> : null}
        </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function invalidTitle(reason: string): string {
  const titles: Record<string, string> = {
    invalid_format: 'Unrecognized ticket QR',
    unknown_ticket: 'Ticket not on this gate manifest',
    wrong_gate: 'Ticket belongs to another gate',
    event_inactive: 'Event is not accepting entry',
    ticket_used: 'Ticket already used',
    expired: 'Rotating code expired',
    invalid_code: 'Invalid rotating code',
  };
  return titles[reason] ?? 'Ticket rejected';
}

function invalidDetail(reason: string): string {
  if (reason === 'expired') return 'This QR is outside the scanner’s current 30-second time slot. Check that the student phone uses automatic date and time, then scan the live QR again.';
  if (reason === 'unknown_ticket') return 'Update this gate’s manifest while online, then scan again.';
  if (reason === 'ticket_used') return 'The saved manifest marks this ticket as already claimed.';
  if (reason === 'wrong_gate') return 'Check the assigned gate and scan at the gate printed on the student ticket.';
  if (reason === 'event_inactive') return 'The saved event is not scheduled or in progress.';
  return 'The QR code did not match a valid EUEvent rotating ticket.';
}

function serverReason(reasonCode: string | null): string {
  const reasons: Record<string, string> = {
    EVENT_NOT_ACTIVE: 'The event was cancelled, postponed, completed, or otherwise inactive before sync. Do not admit this ticket.',
    TICKET_REVOKED: 'The administrator revoked this ticket before the scan synchronized. Do not admit it.',
    GATE_MISMATCH: 'The server found this ticket assigned to a different gate. Do not admit it here.',
    SPLIT_BRAIN_COLLISION: 'Another scanner already accepted this ticket. Check the event log before allowing entry.',
    INVALID_TICKET_CODE: 'The server could not verify this QR code against the ticket secret. Do not admit it.',
  };
  return reasonCode ? reasons[reasonCode] ?? `The server rejected this scan (${reasonCode}). Do not admit this ticket.` : 'The server rejected this scan. Do not admit this ticket.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  headerTitleWrap: { flex: 1, gap: 3 },
  manifestWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: '#7B5418', backgroundColor: '#33250D', padding: 11, marginBottom: 12 },
  manifestWarningText: { flex: 1, color: '#E6D5AA', fontFamily: fonts.bodyRegular, fontSize: 9, lineHeight: 14 },
  syncIssue: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: '#7B3631', backgroundColor: '#49201E', padding: 10, marginBottom: 12 },
  syncIssueText: { flex: 1, color: '#FFD5D1', fontFamily: fonts.bodyRegular, fontSize: 9, lineHeight: 14 },
  eyebrow: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.headingStrong, fontSize: 20 },
  subtitle: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10 },
  closeButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { height: 360, overflow: 'hidden', borderRadius: 24, backgroundColor: '#100707', borderWidth: 1, borderColor: colors.border },
  camera: { flex: 1 },
  scanGuide: { position: 'absolute', width: 230, height: 230, left: '50%', top: '50%', marginLeft: -115, marginTop: -115 },
  scanGuideCorner: { position: 'absolute', width: 38, height: 38, borderColor: colors.gold, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18, left: 0, top: 0 },
  scanGuideTopRight: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 4, borderTopLeftRadius: 0, borderTopRightRadius: 18 },
  scanGuideBottomLeft: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 4, borderTopLeftRadius: 0, borderBottomLeftRadius: 18 },
  scanGuideBottomRight: { left: undefined, top: undefined, right: 0, bottom: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 4, borderBottomWidth: 4, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 18 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 14 },
  instructionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  instructionCopy: { flex: 1, gap: 4 },
  instructionTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 12 },
  instructionText: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 15 },
  resultCard: { padding: 15, borderRadius: 19, marginTop: 12, borderWidth: 1 },
  resultSuccess: { backgroundColor: '#123D32', borderColor: '#286A58' },
  resultError: { backgroundColor: '#49201E', borderColor: '#7B3631' },
  resultNeutral: { backgroundColor: colors.surface, borderColor: colors.border },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  resultTitle: { flex: 1, color: colors.green, fontFamily: fonts.bodyBold, fontSize: 13 },
  resultTitleError: { color: colors.red },
  resultDetail: { color: colors.text, fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 17, marginTop: 8 },
  scanNextButton: { alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.gold, marginTop: 12 },
  scanNextText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 11 },
  footer: { marginTop: 'auto', paddingTop: 17, borderTopWidth: 1, borderTopColor: colors.border },
  footerTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 11 },
  footerText: { color: colors.muted, fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 15, marginTop: 5 },
  processing: { marginTop: 10 },
  permissionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  permissionTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 21, textAlign: 'center' },
  permissionCopy: { color: colors.muted, fontFamily: fonts.bodyRegular, textAlign: 'center', fontSize: 12, lineHeight: 18, maxWidth: 280 },
  permissionButton: { backgroundColor: colors.gold, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  permissionButtonText: { color: colors.background, fontFamily: fonts.bodyBold, fontSize: 12 },
});
