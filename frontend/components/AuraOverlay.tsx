import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";

interface Props {
  /** Score 0–100 qui pilote couleur et intensité */
  score: number;
}

const scoreToColor = (v: Animated.Value) =>
  v.interpolate({
    inputRange: [0, 30, 65, 100],
    outputRange: ["#34d399", "#34d399", "#fbbf24", "#f43f5e"],
  });

/** Anneau de balayage qui se dilate depuis le centre puis s'estompe. */
function ScanRing({
  delay,
  color,
  intensity,
}: {
  delay: number;
  color: Animated.AnimatedInterpolation<string>;
  intensity: Animated.AnimatedInterpolation<number>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.5] });
  const fade = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          borderColor: color,
          opacity: Animated.multiply(fade, intensity),
          transform: [{ scale }],
        },
      ]}
    />
  );
}

/** Orbe lumineux qui dérive lentement ; visible seulement en forte activité. */
function Orb({
  index,
  gate,
}: {
  index: number;
  gate: Animated.AnimatedInterpolation<number>;
}) {
  const { width, height } = useWindowDimensions();
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    const drift = () => {
      if (!alive) return;
      Animated.timing(pos, {
        toValue: {
          x: (Math.random() - 0.5) * width * 0.7,
          y: (Math.random() - 0.5) * height * 0.55,
        },
        duration: 3500 + Math.random() * 3000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(() => drift());
    };
    pos.setValue({
      x: (Math.random() - 0.5) * width * 0.7,
      y: (Math.random() - 0.5) * height * 0.55,
    });
    drift();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200 + index * 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200 + index * 300,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      alive = false;
      loop.stop();
    };
  }, [height, index, pos, pulse, width]);

  const size = 14 + (index % 3) * 8;
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbWrap,
        {
          opacity: Animated.multiply(gate, pulseOpacity),
          transform: [{ translateX: pos.x }, { translateY: pos.y }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.orbHalo,
          { width: size * 3, height: size * 3, borderRadius: size * 1.5 },
        ]}
      />
      <Animated.View
        style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
}

export default function AuraOverlay({ score }: Props) {
  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [animatedScore, score]);

  const color = useMemo(() => scoreToColor(animatedScore), [animatedScore]);
  const vignetteOpacity = animatedScore.interpolate({
    inputRange: [0, 100],
    outputRange: [0.12, 0.75],
  });
  const ringIntensity = animatedScore.interpolate({
    inputRange: [0, 100],
    outputRange: [0.35, 1],
  });
  const orbGate = animatedScore.interpolate({
    inputRange: [0, 45, 70, 100],
    outputRange: [0, 0, 0.7, 1],
  });

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.vignette, { borderColor: color, opacity: vignetteOpacity }]}
      />
      <ScanRing delay={0} color={color} intensity={ringIntensity} />
      <ScanRing delay={800} color={color} intensity={ringIntensity} />
      <ScanRing delay={1600} color={color} intensity={ringIntensity} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Orb key={i} index={i} gate={orbGate} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 42,
    borderRadius: 48,
  },
  ring: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -140,
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
  },
  orbWrap: {
    position: "absolute",
    top: "45%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  orbHalo: {
    position: "absolute",
    backgroundColor: "rgba(168, 85, 247, 0.18)",
  },
  orb: {
    backgroundColor: "rgba(216, 180, 254, 0.85)",
  },
});
