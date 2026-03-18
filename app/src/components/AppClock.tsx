import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamilies, withAlpha } from '../theme';

type AppClockProps = {
  date?: Date;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type MarkerConfig = {
  angle: number;
  backgroundColor: string;
  height: number;
  key: string;
  left: number;
  top: number;
  width: number;
};

const NUMERALS = [
  { angle: 0, label: '12' },
  { angle: 90, label: '3' },
  { angle: 180, label: '6' },
  { angle: 270, label: '9' },
] as const;

function getPolarPosition(angle: number, distance: number, origin: number) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: origin + Math.cos(radians) * distance,
    y: origin + Math.sin(radians) * distance,
  };
}

function buildMarkers(size: number): MarkerConfig[] {
  const center = size / 2;
  const majorLength = size * 0.085;
  const minorLength = size * 0.03;
  const markerInset = size * 0.038;

  return Array.from({ length: 60 }, (_, index) => {
    const angle = index * 6;
    const isHourMarker = index % 5 === 0;
    const height = isHourMarker ? majorLength : minorLength;
    const width = isHourMarker ? Math.max(2, size * 0.0065) : Math.max(1, size * 0.0035);
    const distance = center - markerInset - height / 2;
    const position = getPolarPosition(angle, distance, center);

    return {
      angle,
      backgroundColor: isHourMarker
        ? withAlpha(colors.text.primary, 0.45)
        : withAlpha(colors.text.primary, 0.12),
      height,
      key: `marker-${index}`,
      left: position.x - width / 2,
      top: position.y - height / 2,
      width,
    };
  });
}

export default function AppClock({ date, size = 312, style }: AppClockProps) {
  const [internalNow, setInternalNow] = useState(() => new Date());

  useEffect(() => {
    if (date) {
      return;
    }

    const updateClock = () => {
      setInternalNow(new Date());
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [date]);

  const now = date ?? internalNow;

  const center = size / 2;
  const markers = useMemo(() => buildMarkers(size), [size]);
  const numeralDistance = center - size * 0.22;
  const numeralWidth = size * 0.14;
  const numeralHeight = size * 0.12;
  const numeralFontSize = size * 0.08;

  const numerals = useMemo(
    () =>
      NUMERALS.map((numeral) => {
        const position = getPolarPosition(numeral.angle, numeralDistance, center);

        return {
          ...numeral,
          left: position.x - numeralWidth / 2,
          top: position.y - numeralHeight / 2,
        };
      }),
    [center, numeralDistance, numeralHeight, numeralWidth],
  );

  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;

  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = hours * 30 + minutes * 0.5;

  const hourWidth = Math.max(9, size * 0.03);
  const minuteWidth = Math.max(6, size * 0.018);
  const secondWidth = Math.max(3, size * 0.009);
  const hourLength = size * 0.26;
  const minuteLength = size * 0.36;
  const secondLength = size * 0.38;
  const handTail = size * 0.03;
  const capSize = size * 0.048;

  const accessibilityLabel = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [now],
  );

  return (
    <View
      accessibilityLabel={`Analog clock showing ${accessibilityLabel}`}
      accessible
      style={[styles.outer, { height: size, width: size }, style]}
    >
      <View
        style={[
          styles.face,
          {
            borderRadius: center,
            elevation: Math.max(4, Math.round(size * 0.03)),
            height: size,
            shadowOffset: {
              height: size * 0.032,
              width: 0,
            },
            shadowRadius: size * 0.06,
            width: size,
          },
        ]}
      >
        {markers.map((marker) => (
          <View
            key={marker.key}
            style={[
              styles.marker,
              {
                backgroundColor: marker.backgroundColor,
                borderRadius: marker.width / 2,
                height: marker.height,
                left: marker.left,
                top: marker.top,
                transform: [{ rotate: `${marker.angle}deg` }],
                width: marker.width,
              },
            ]}
          />
        ))}

        {numerals.map((numeral) => (
          <Text
            key={numeral.label}
            style={[
              styles.numeral,
              {
                fontSize: numeralFontSize,
                height: numeralHeight,
                left: numeral.left,
                lineHeight: numeralHeight,
                top: numeral.top,
                width: numeralWidth,
              },
            ]}
          >
            {numeral.label}
          </Text>
        ))}

        <View pointerEvents="none" style={styles.handLayer}>
          <View style={[styles.handWrapper, { transform: [{ rotate: `${hourAngle}deg` }] }]}>
            <View
              style={[
                styles.hand,
                styles.hourHand,
                {
                  borderRadius: hourWidth / 2,
                  bottom: center - handTail,
                  height: hourLength + handTail,
                  left: center - hourWidth / 2,
                  width: hourWidth,
                },
              ]}
            />
          </View>

          <View style={[styles.handWrapper, { transform: [{ rotate: `${minuteAngle}deg` }] }]}>
            <View
              style={[
                styles.hand,
                styles.minuteHand,
                {
                  borderRadius: minuteWidth / 2,
                  bottom: center - handTail,
                  height: minuteLength + handTail,
                  left: center - minuteWidth / 2,
                  width: minuteWidth,
                },
              ]}
            />
          </View>

          <View style={[styles.handWrapper, { transform: [{ rotate: `${secondAngle}deg` }] }]}>
            <View
              style={[
                styles.hand,
                styles.secondHand,
                {
                  borderRadius: secondWidth / 2,
                  bottom: center - handTail * 0.6,
                  height: secondLength + handTail * 0.6,
                  left: center - secondWidth / 2,
                  width: secondWidth,
                },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.centerCap,
            {
              borderRadius: capSize / 2,
              height: capSize,
              left: center - capSize / 2,
              top: center - capSize / 2,
              width: capSize,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerCap: {
    backgroundColor: '#D99A3F',
    position: 'absolute',
    shadowColor: withAlpha(colors.accents.bronzePressed, 0.6),
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  face: {
    backgroundColor: colors.backgrounds.card,
    borderColor: withAlpha(colors.text.primary, 0.04),
    borderWidth: 1,
    shadowColor: withAlpha(colors.text.primary, 0.24),
    shadowOpacity: 0.18,
  },
  hand: {
    position: 'absolute',
  },
  handLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  handWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  hourHand: {
    backgroundColor: '#2E2D2F',
  },
  marker: {
    position: 'absolute',
  },
  minuteHand: {
    backgroundColor: withAlpha(colors.text.primary, 0.72),
  },
  numeral: {
    color: withAlpha(colors.text.primary, 0.72),
    fontFamily: fontFamilies.serif,
    fontWeight: '500',
    position: 'absolute',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondHand: {
    backgroundColor: '#D99A3F',
  },
});
