import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useEnergySensors } from "../lib/useEnergySensors";
import AuraOverlay from "../components/AuraOverlay";
import EnergyGauge from "../components/EnergyGauge";
import EventJournal from "../components/EventJournal";
import DisclaimerModal from "../components/DisclaimerModal";

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const sensors = useEnergySensors();

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Ionicons name="videocam-off-outline" size={40} color="#a855f7" />
        <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
        <Text style={styles.permissionBody}>
          Spectra superpose la visualisation des capteurs à l’image de votre
          caméra pour scanner l’environnement.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
          </Pressable>
        ) : (
          <Text style={styles.permissionBody}>
            Activez la caméra pour cette application dans les réglages du
            téléphone.
          </Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
      <AuraOverlay score={sensors.score} />

      <SafeAreaView style={styles.hud} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="none">
          <Text style={styles.title}>SPECTRA</Text>
          <Text style={styles.tagline}>Analyse de l’environnement en cours…</Text>
        </View>

        <EventJournal events={sensors.events} />

        <View style={styles.spacer} pointerEvents="none" />

        <EnergyGauge
          score={sensors.score}
          magnetic={sensors.magnetic}
          magneticDelta={sensors.magneticDelta}
          vibration={sensors.vibration}
          status={sensors.status}
          onCalibrate={sensors.calibrate}
        />
      </SafeAreaView>

      <DisclaimerModal
        visible={showDisclaimer}
        onDismiss={() => setShowDisclaimer(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  hud: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 6,
  },
  tagline: {
    color: "rgba(226, 232, 240, 0.7)",
    fontSize: 11,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
  },
  permissionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  permissionBody: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  permissionBtn: {
    marginTop: 8,
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  permissionBtnText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
});
