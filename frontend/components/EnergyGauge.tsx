import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EnergyStatus } from "../lib/useEnergySensors";

interface Props {
  score: number;
  magnetic: number;
  magneticDelta: number;
  vibration: number;
  status: EnergyStatus;
  onCalibrate: () => void;
}

const STATUS_META: Record<EnergyStatus, { label: string; color: string }> = {
  calibrating: { label: "CALIBRATION…", color: "#22d3ee" },
  calm: { label: "CALME", color: "#34d399" },
  active: { label: "ACTIVITÉ", color: "#fbbf24" },
  anomaly: { label: "ANOMALIE", color: "#f43f5e" },
};

function ReadoutBar({
  icon,
  label,
  value,
  ratio,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  ratio: number;
  color: string;
}) {
  return (
    <View style={styles.readout}>
      <View style={styles.readoutHeader}>
        <Ionicons name={icon} size={13} color="#94a3b8" />
        <Text style={styles.readoutLabel}>{label}</Text>
        <Text style={styles.readoutValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, Math.max(2, ratio * 100))}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function EnergyGauge({
  score,
  magnetic,
  magneticDelta,
  vibration,
  status,
  onCalibrate,
}: Props) {
  const meta = STATUS_META[status];
  const calibrating = status === "calibrating";

  return (
    <View style={styles.panel}>
      <View style={styles.gaugeRow}>
        <View style={[styles.gauge, { borderColor: meta.color }]}>
          <Text style={[styles.gaugeScore, { color: meta.color }]}>
            {calibrating ? "--" : Math.round(score)}
          </Text>
          <Text style={styles.gaugeUnit}>/ 100</Text>
        </View>

        <View style={styles.readouts}>
          <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
          <ReadoutBar
            icon="magnet-outline"
            label="Champ magnétique"
            value={`${magnetic.toFixed(1)} µT · Δ ${magneticDelta.toFixed(1)}`}
            ratio={magneticDelta / 35}
            color={meta.color}
          />
          <ReadoutBar
            icon="pulse-outline"
            label="Vibrations"
            value={`${vibration.toFixed(3)} g`}
            ratio={vibration / 0.35}
            color={meta.color}
          />
        </View>
      </View>

      <Pressable
        onPress={onCalibrate}
        disabled={calibrating}
        style={({ pressed }) => [
          styles.calibrateBtn,
          (pressed || calibrating) && { opacity: 0.5 },
        ]}
      >
        <Ionicons name="refresh-outline" size={16} color="#e2e8f0" />
        <Text style={styles.calibrateText}>
          {calibrating ? "Calibration en cours…" : "Recalibrer l'environnement"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    padding: 14,
    gap: 12,
  },
  gaugeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  gauge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  gaugeScore: {
    fontSize: 30,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  gaugeUnit: {
    fontSize: 10,
    color: "#64748b",
    marginTop: -2,
  },
  readouts: {
    flex: 1,
    gap: 8,
  },
  status: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
  },
  readout: {
    gap: 4,
  },
  readoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  readoutLabel: {
    color: "#94a3b8",
    fontSize: 11,
    flex: 1,
  },
  readoutValue: {
    color: "#e2e8f0",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  calibrateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(51, 65, 85, 0.6)",
  },
  calibrateText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
});
