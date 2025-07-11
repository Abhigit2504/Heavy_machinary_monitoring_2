import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Create animated components
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CustomDonutChart = ({ data, size = 220, strokeWidth = 38 }) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Initialize animated values
  const segmentAnimations = useRef(data.map(() => new Animated.Value(0))).current;
  const labelAnimations = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Animate segments first
    const segmentAnims = data.map((_, i) => 
      Animated.timing(segmentAnimations[i], {
        toValue: 1,
        duration: 800,
        delay: i * 100,
        useNativeDriver: true,
      })
    );

    // Then animate labels with a slight delay after segments
    const labelAnims = data.map((_, i) => 
      Animated.timing(labelAnimations[i], {
        toValue: 1,
        duration: 400,
        delay: 800 + i * 50,
        useNativeDriver: true,
      })
    );

    Animated.sequence([
      Animated.parallel(segmentAnims),
      Animated.parallel(labelAnims)
    ]).start();
  }, []);

  const polarToCartesian = (angle) => {
    const rad = (Math.PI / 180) * angle;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const createArc = (start, sweep) => {
    const startCoord = polarToCartesian(start);
    const endCoord = polarToCartesian(start + sweep);
    const largeArc = sweep > 180 ? 1 : 0;

    return `
      M ${startCoord.x} ${startCoord.y}
      A ${radius} ${radius} 0 ${largeArc} 1 ${endCoord.x} ${endCoord.y}
    `;
  };

  let startAngle = 0;
  const labelPositions = [];

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {data.map((d, i) => {
            const angle = (d.value / total) * 360;
            const fullPath = createArc(startAngle, angle);
            const pathLength = angle * radius * Math.PI / 180;
            
            const midAngle = startAngle + angle / 2;
            const labelCoord = polarToCartesian(midAngle);
            labelPositions.push(labelCoord);
            
            startAngle += angle;

            return (
              <G key={`segment-${i}`}>
                <AnimatedPath
                  d={fullPath}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${pathLength} ${pathLength}`}
                  strokeDashoffset={segmentAnimations[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [pathLength, 0],
                  })}
                />
                <AnimatedCircle
                  cx={labelCoord.x}
                  cy={labelCoord.y}
                  r={14}
                  fill="#fff"
                  stroke={d.color}
                  strokeWidth={2}
                  opacity={labelAnimations[i]}
                />
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Render labels outside SVG for better control */}
      <View style={StyleSheet.absoluteFill}>
        {data.map((d, i) => {
          const labelCoord = labelPositions[i];
          const labelStyle = {
            position: 'absolute',
            left: labelCoord.x - 30,
            top: labelCoord.y - 20,
            width: 60,
            opacity: labelAnimations[i],
            transform: [
              {
                scale: labelAnimations[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              }
            ]
          };

          return (
            <Animated.View key={`label-${i}`} style={labelStyle}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelTitle}>GFRID: {d.label}</Text>
                <Text style={styles.labelValue}>{d.value}%</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  labelContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  labelTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  labelValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default CustomDonutChart;