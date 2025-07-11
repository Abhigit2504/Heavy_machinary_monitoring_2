import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Modal,
  Easing,
} from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const size = 240;
const strokeWidth = 40;
const radius = (size - strokeWidth) / 2;
const center = size / 2;
const circumference = 2 * Math.PI * radius;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedText = Animated.createAnimatedComponent(Text);

const CustomDonutChartWithLegend = ({ data }) => {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const modalScale = useRef(new Animated.Value(0)).current;

  const coloredData = useMemo(() => {
    const hueStep = 360 / data.length;
    return data.map((item, i) => ({
      ...item,
      color: `hsl(${i * hueStep}, 75%, 60%)`,
      textColor: `hsl(${i * hueStep}, 85%, 30%)`,
    }));
  }, [data]);

  const total = coloredData.reduce((sum, d) => sum + d.value, 0);
  const segmentAnims = useRef(coloredData.map(() => new Animated.Value(0))).current;
  const labelAnims = useRef(coloredData.map(() => new Animated.Value(0))).current;
  const positionAnims = useRef(coloredData.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const positionAnimations = coloredData.map((_, i) =>
      Animated.timing(positionAnims[i], {
        toValue: 1,
        duration: 800,
        delay: i * 150,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      })
    );

    const segmentAnimations = coloredData.map((_, i) =>
      Animated.timing(segmentAnims[i], {
        toValue: 1,
        duration: 800,
        delay: 400 + i * 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    const labelAnimations = coloredData.map((_, i) =>
      Animated.timing(labelAnims[i], {
        toValue: 1,
        duration: 400,
        delay: 1000 + i * 150,
        easing: Easing.out(Easing.elastic(1)),
        useNativeDriver: true,
      })
    );

    Animated.sequence([
      Animated.parallel(positionAnimations),
      Animated.parallel(segmentAnimations),
      Animated.parallel(labelAnimations),
    ]).start();
  }, []);

  const openModal = (item) => {
    setSelected(item);
    setShowModal(true);
    modalScale.setValue(0);
    Animated.spring(modalScale, {
      toValue: 1,
      damping: 10,
      stiffness: 100,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalScale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowModal(false));
  };

  let offset = 0;
  const arcs = coloredData.map((item, i) => {
    const value = item.value;
    const angle = (value / total) * 360;
    const rotate = (offset / total) * 360;
    const arcLength = (circumference * value) / total;
    const midAngle = rotate + angle / 2;
    const rad = (midAngle * Math.PI) / 180;
    const x = center + (radius - 25) * Math.cos(rad);
    const y = center + (radius - 25) * Math.sin(rad);

    offset += value;

    return {
      ...item,
      index: i,
      angle,
      arcLength,
      rotate,
      labelX: x,
      labelY: y,
      startX: center + radius * Math.cos(0),
      startY: center + radius * Math.sin(0),
      percentage: ((value / total) * 100).toFixed(1),
    };
  });

  return (
    <View style={{ alignItems: 'center', marginBottom: 30 }}>
      <Svg width={size} height={size}>
        {arcs.map((arc, i) => (
          <G
            rotation={arc.rotate}
            origin={`${center}, ${center}`}
            key={`arc-${i}`}
          >
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.arcLength} ${circumference}`}
              strokeDashoffset={segmentAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [arc.arcLength, 0],
              })}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        ))}
        {arcs.map((arc, i) => (
          <AnimatedG
            key={`label-container-${i}`}
            transform={[
              {
                translateX: positionAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [arc.startX - arc.labelX, 0],
                }),
              },
              {
                translateY: positionAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [arc.startY - arc.labelY, 0],
                }),
              },
            ]}
          >
            <AnimatedCircle
              cx={arc.labelX}
              cy={arc.labelY}
              r={labelAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 16],
              })}
              fill="#fff"
              stroke={arc.color}
              strokeWidth={labelAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 3],
              })}
              opacity={labelAnims[i]}
            />
            <AnimatedText
              style={{
                position: 'absolute',
                left: arc.labelX - 25,
                top: arc.labelY - 15,
                width: 50,
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'center',
                color: arc.textColor,
                opacity: labelAnims[i],
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderRadius: 10,
                padding: 4,
                overflow: 'hidden',
                transform: [
                  {
                    scale: labelAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              }}
            >
              {arc.percentage}%
            </AnimatedText>
          </AnimatedG>
        ))}
      </Svg>

      {/* LEGEND - Reverted to original chip style */}
      <View style={styles.legendRow}>
        {arcs.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.legendChip, { backgroundColor: item.color }]}
            onPress={() => openModal(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.legendText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* MODAL (keeping improved version) */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              { 
                borderTopColor: selected?.color,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            <View style={[styles.modalHeader, { backgroundColor: selected?.color }]}>
              <Text style={styles.modalTitle}>{selected?.label}</Text>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalPercentage}>{selected?.percentage}%</Text>
              <Text style={styles.modalSubtitle}>of total usage</Text>
              <View style={styles.modalStats}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Value:</Text>
                  <Text style={styles.statValue}>{selected?.value}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total:</Text>
                  <Text style={styles.statValue}>{total}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: selected?.color }]}
                onPress={closeModal}
              >
                <Text style={styles.modalButtonText}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const AnimatedG = Animated.createAnimatedComponent(G);

const styles = StyleSheet.create({
  // Original legend styles
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 20,
  },
  legendChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal styles (keeping improved version)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalCard: {
    width: '100%',
    maxWidth: 250,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight:400

  },
  modalHeader: {
    padding: 10,
    paddingBottom: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  modalContent: {
    padding: 25,
    alignItems: 'center',
  },
  modalPercentage: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#1e293b',
    // marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    // marginBottom: 25,
  },
  modalStats: {
    width: '100%',
    marginBottom: 25,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalButton: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default CustomDonutChartWithLegend;