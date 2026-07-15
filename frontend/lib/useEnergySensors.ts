import { useCallback, useEffect, useRef, useState } from "react";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Haptics from "expo-haptics";

export type EnergyStatus = "calibrating" | "calm" | "active" | "anomaly";

export interface EnergyEvent {
  id: number;
  time: string;
  kind: "magnetic" | "vibration" | "calibration";
  label: string;
}

export interface EnergyState {
  /** Score global 0–100, lissé */
  score: number;
  /** Intensité du champ magnétique ambiant en µT */
  magnetic: number;
  /** Écart du champ magnétique par rapport à la référence calibrée, en µT */
  magneticDelta: number;
  /** Niveau de vibration (RMS en g, gravité soustraite) */
  vibration: number;
  status: EnergyStatus;
  events: EnergyEvent[];
}

const MAG_INTERVAL_MS = 100;
const ACC_INTERVAL_MS = 50;
const UI_TICK_MS = 100;
const CALIBRATION_MS = 3000;

// Un écart de 35 µT ou une vibration RMS de 0,35 g saturent leur composante.
const MAG_DELTA_FULL_SCALE = 35;
const VIB_FULL_SCALE = 0.35;

const MAG_EVENT_THRESHOLD = 18; // µT d'écart pour journaliser un pic
const VIB_EVENT_THRESHOLD = 0.22; // g RMS pour journaliser une vibration
const EVENT_COOLDOWN_MS = 4000;

const magnitude = (v: { x: number; y: number; z: number }) =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

const now = () =>
  new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/**
 * Lit le magnétomètre et l'accéléromètre du téléphone, calibre une référence
 * ambiante, puis produit un score d'« activité » 0–100 basé sur les écarts
 * réels mesurés (champ magnétique et vibrations).
 */
export function useEnergySensors(): EnergyState & { calibrate: () => void } {
  const [state, setState] = useState<EnergyState>({
    score: 0,
    magnetic: 0,
    magneticDelta: 0,
    vibration: 0,
    status: "calibrating",
    events: [],
  });

  const magRef = useRef(0);
  const magBaselineRef = useRef<number | null>(null);
  const calibSamplesRef = useRef<number[]>([]);
  const calibratingRef = useRef(true);
  const accWindowRef = useRef<number[]>([]);
  const scoreRef = useRef(0);
  const eventIdRef = useRef(0);
  const lastEventAtRef = useRef<{ [k: string]: number }>({});
  const overThresholdRef = useRef<{ magnetic: boolean; vibration: boolean }>({
    magnetic: false,
    vibration: false,
  });

  const pushEvent = useCallback(
    (kind: EnergyEvent["kind"], label: string, haptic: boolean) => {
      const last = lastEventAtRef.current[kind] ?? 0;
      const t = Date.now();
      if (t - last < EVENT_COOLDOWN_MS) return;
      lastEventAtRef.current[kind] = t;
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      const event: EnergyEvent = {
        id: ++eventIdRef.current,
        time: now(),
        kind,
        label,
      };
      setState((s) => ({ ...s, events: [event, ...s.events].slice(0, 6) }));
    },
    []
  );

  const calibrate = useCallback(() => {
    calibratingRef.current = true;
    calibSamplesRef.current = [];
    magBaselineRef.current = null;
    scoreRef.current = 0;
    setState((s) => ({ ...s, status: "calibrating", score: 0 }));
    setTimeout(() => {
      const samples = calibSamplesRef.current;
      magBaselineRef.current = samples.length
        ? samples.reduce((a, b) => a + b, 0) / samples.length
        : magRef.current;
      calibratingRef.current = false;
      pushEvent(
        "calibration",
        `Référence ambiante fixée à ${magBaselineRef.current.toFixed(0)} µT`,
        false
      );
    }, CALIBRATION_MS);
  }, [pushEvent]);

  useEffect(() => {
    Magnetometer.setUpdateInterval(MAG_INTERVAL_MS);
    Accelerometer.setUpdateInterval(ACC_INTERVAL_MS);

    const magSub = Magnetometer.addListener((data) => {
      const m = magnitude(data);
      magRef.current = m;
      if (calibratingRef.current) calibSamplesRef.current.push(m);
    });

    const accSub = Accelerometer.addListener((data) => {
      // L'accéléromètre renvoie des g ; au repos la magnitude vaut ~1 g.
      const dev = Math.abs(magnitude(data) - 1);
      const w = accWindowRef.current;
      w.push(dev);
      if (w.length > 24) w.shift();
    });

    calibrate();

    const tick = setInterval(() => {
      const mag = magRef.current;
      const baseline = magBaselineRef.current;
      const magDelta = baseline === null ? 0 : Math.abs(mag - baseline);

      const w = accWindowRef.current;
      const vibration = w.length
        ? Math.sqrt(w.reduce((a, b) => a + b * b, 0) / w.length)
        : 0;

      if (calibratingRef.current) {
        setState((s) => ({
          ...s,
          magnetic: mag,
          magneticDelta: 0,
          vibration,
          status: "calibrating",
          score: 0,
        }));
        return;
      }

      const magScore = Math.min(1, magDelta / MAG_DELTA_FULL_SCALE);
      const vibScore = Math.min(1, vibration / VIB_FULL_SCALE);
      const raw = 100 * (0.65 * magScore + 0.35 * vibScore);
      scoreRef.current = scoreRef.current * 0.82 + raw * 0.18;
      const score = scoreRef.current;

      const status: EnergyStatus =
        score >= 65 ? "anomaly" : score >= 30 ? "active" : "calm";

      const over = overThresholdRef.current;
      if (magDelta >= MAG_EVENT_THRESHOLD && !over.magnetic) {
        pushEvent(
          "magnetic",
          `Perturbation magnétique · Δ ${magDelta.toFixed(0)} µT`,
          true
        );
      }
      over.magnetic = magDelta >= MAG_EVENT_THRESHOLD;

      if (vibration >= VIB_EVENT_THRESHOLD && !over.vibration) {
        pushEvent(
          "vibration",
          `Vibration détectée · ${vibration.toFixed(2)} g`,
          true
        );
      }
      over.vibration = vibration >= VIB_EVENT_THRESHOLD;

      setState((s) => ({
        ...s,
        score,
        magnetic: mag,
        magneticDelta: magDelta,
        vibration,
        status,
      }));
    }, UI_TICK_MS);

    return () => {
      magSub.remove();
      accSub.remove();
      clearInterval(tick);
    };
  }, [calibrate, pushEvent]);

  return { ...state, calibrate };
}
