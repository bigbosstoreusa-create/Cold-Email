import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { EnergyEvent } from "../lib/useEnergySensors";

const KIND_COLOR: Record<EnergyEvent["kind"], string> = {
  magnetic: "#f43f5e",
  vibration: "#fbbf24",
  calibration: "#22d3ee",
};

export default function EventJournal({ events }: { events: EnergyEvent[] }) {
  if (events.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      {events.slice(0, 4).map((e, i) => (
        <View key={e.id} style={[styles.row, { opacity: 1 - i * 0.22 }]}>
          <View style={[styles.dot, { backgroundColor: KIND_COLOR[e.kind] }]} />
          <Text style={styles.time}>{e.time}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {e.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    maxWidth: "95%",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  time: {
    color: "#64748b",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  label: {
    color: "#e2e8f0",
    fontSize: 11,
    flexShrink: 1,
  },
});
