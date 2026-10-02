import { useRef, useState } from 'react';
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
import { Camera, CheckCircle2, CloudOff, X } from 'lucide-react-native';
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
  onClose,
  onQueueChanged,
}: {
  visible: boolean;
  assignment: AssignedGate;
  snapshot: OfflineGateManifest;
  serverUrl: string;
  staffId: number;
  token: string;
  onClose: () => void;
  onQueueChanged: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error' | 'neutral'; title: string; detail: string } | null>(null);
  const scanLock = useRef(false);

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
      setResult({ tone: 'success', title: 'Valid pass · saved on device', detail: 'The rotating code matches this gate’s downloaded manifest. The scan is saved securely and awaiting server confirmation.' });
      if (token) {
        setIsSyncing(true);
        try {
          const sync = await syncPendingScans(token, serverUrl, staffId);
          onQueueChanged();
          const outcome = sync.outcomes.find((entry) => entry.scan_id === scan.scan_id);
          if (outcome?.decision === 'accepted') {
            setResult({ tone: 'success', title: 'Entry accepted · synced', detail: 'The event server confirmed this ticket. The scan is recorded in the event log.' });
          } else if (outcome?.decision === 'rejected') {
            setResult({ tone: 'error', title: 'Server rejected this scan', detail: serverReason(outcome.reason_code) });
          }
        } catch {
          setResult({ tone: 'success', title: 'Valid pass · saved offline', detail: 'The code matches this gate’s manifest. Keep this device; its scan will sync when the event server is reachable.' });
        } finally {
          setIsSyncing(false);
        }
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
    setResult(null);
    setIsScanning(true);
  }

  const cameraAllowed = permission?.granted === true;
  const cameraCanBeRequested = permission?.canAskAgain !== false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={styles.screen}>
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
                <Text style={styles.instructionText}>This phone checks the rotating code against the encrypted gate manifest. Network access is not needed for local validation.</Text>
              </View>
            </View>

            {result ? (
              <View style={[styles.resultCard, result.tone === 'success' ? styles.resultSuccess : result.tone === 'error' ? styles.resultError : styles.resultNeutral]}>
                <View style={styles.resultHeading}>
                  {isSyncing ? <ActivityIndicator color={result.tone === 'error' ? colors.red : colors.green} /> : <CheckCircle2 size={20} color={result.tone === 'error' ? colors.red : colors.green} />}
                  <Text style={[styles.resultTitle, result.tone === 'error' && styles.resultTitleError]}>{isSyncing ? 'Syncing scan…' : result.title}</Text>
                </View>
                <Text style={styles.resultDetail}>{result.detail}</Text>
                {!isScanning && !isProcessing && !isSyncing ? (
                  <Pressable onPress={scanNext} style={styles.scanNextButton}><Text style={styles.scanNextText}>Scan next ticket</Text></Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{snapshot.manifest.tickets.length} tickets prepared for this gate</Text>
          <Text style={styles.footerText}>Keep the screen visible at the door. Offline scans stay encrypted on this device until they are synchronized.</Text>
          {isProcessing ? <ActivityIndicator style={styles.processing} color={colors.gold} /> : null}
        </View>
      </View>
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
  if (reason === 'expired') return 'Ask the student to refresh their ticket so the QR updates, then scan again.';
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
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 56 : 30, paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  headerTitleWrap: { flex: 1, gap: 3 },
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
