import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function DisclaimerModal({ visible, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="eye-outline" size={34} color="#a855f7" />
          <Text style={styles.title}>Spectra</Text>
          <Text style={styles.subtitle}>Détecteur d’énergies ambiantes</Text>

          <Text style={styles.body}>
            Cette application lit les capteurs réels de votre téléphone : le{" "}
            <Text style={styles.em}>magnétomètre</Text> (champ magnétique en µT)
            et l’<Text style={styles.em}>accéléromètre</Text> (vibrations). Elle
            visualise leurs fluctuations comme des « énergies » superposées à
            l’image de la caméra.
          </Text>
          <Text style={styles.body}>
            Les perturbations affichées ont des causes physiques ordinaires
            (appareils électriques, métal, mouvements). Aucune preuve
            scientifique ne relie ces mesures à des entités ou des phénomènes
            paranormaux : l’interprétation « spirituelle » relève de
            l’exploration et du divertissement.
          </Text>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.buttonText}>Commencer l’exploration</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    padding: 24,
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 4,
  },
  subtitle: {
    color: "#a855f7",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  body: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  em: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  button: {
    marginTop: 10,
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
});
