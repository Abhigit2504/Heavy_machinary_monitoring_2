import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';

const screenWidth = Dimensions.get('window').width;
const chartHeight = 180;

const UptimeBarChart = ({ chartData, chartScale }) => {
  const safeChartData = () => {
    if (!chartData || !chartData.labels || !chartData.datasets) {
      return {
        labels: [],
        values: [],
        formatted: [],
      };
    }

    const values = chartData.datasets[0].data || [];
    return {
      labels: chartData.labels,
      values,
      formatted: values.map((val) => `${val.toFixed(2)}%`),
    };
  };

  const { labels, values, formatted } = safeChartData();
  const maxValue = Math.max(...values, 1);
  const roundedMax = Math.ceil(maxValue / 25) * 25 || 100;

  const animatedHeights = useRef(values.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = values.map((val, i) =>
      Animated.timing(animatedHeights[i], {
        toValue: val === 0 ? 2 : (val / roundedMax) * chartHeight,
        duration: 1000,
        useNativeDriver: false,
      })
    );
    Animated.stagger(100, anims).start();
  }, [chartData]);

  const yTicks = [0, 1, 2, 3, 4, 5].map(i => {
    const value = (roundedMax / 5) * i;
    return {
      label: Math.round(value),
      top: (1 - value / roundedMax) * chartHeight,
    };
  });

  return (
    <Animated.View
      style={[
        styles.chartContainer,
        styles.cardShadow,
        { transform: [{ scale: chartScale || new Animated.Value(1) }] },
      ]}
    >
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Machine Utilization</Text>
        <Text style={styles.chartSubtitle}>Machines sorted by work %</Text>
      </View>

      <View style={[styles.yAxisContainer, { height: chartHeight }]}>
        {yTicks.map((tick, index) => (
          <View key={index} style={[styles.yAxisTick, { top: tick.top }]}>
            <Text style={styles.yAxisText}>{tick.label}%</Text>
            <View style={styles.yAxisLine} />
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.chartAreaWrapper}>
          <View style={[styles.chartArea, { height: chartHeight + 40 }]}>
            <View style={[styles.xAxisLine, { top: chartHeight }]} />
            <View style={styles.barArea}>
              {labels.map((label, i) => {
                const barHeight = animatedHeights[i];
                return (
                  <View key={i} style={styles.barWrapper}>
                    <Animated.Text
                      style={[
                        styles.valueLabel,
                        {
                          bottom: Animated.add(barHeight, 8),
                          opacity: 1,
                        },
                      ]}
                    >
                      {formatted[i]}
                    </Animated.Text>

                    <Animated.View
                      style={[
                        styles.animatedBar,
                        {
                          height: barHeight,
                          backgroundColor: 'rgba(51, 102, 153, 0.86)',
                        },
                      ]}
                    >
                      <Text style={styles.barLabel}>{label}</Text>
                    </Animated.View>

                    <Text style={styles.xAxisLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 16,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  titleContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  scrollViewContent: {
    paddingLeft: 50,
    paddingRight: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  chartAreaWrapper: {
    marginTop: 10,
  },
  chartArea: {
    position: 'relative',
  },
  yAxisContainer: {
    position: 'absolute',
    left: 10,
    top: 85,
    width: 50,
    zIndex: 1,
  },
  yAxisTick: {
    position: 'absolute',
    left: 0,
    width:'60',
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisText: {
    fontSize: 10,
    color: '#666',
    width: 30,
    textAlign: 'right',
    fontWeight:700
  },
  yAxisLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
    flex: 1,
    marginLeft: 4,
  },
  xAxisLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: chartHeight,
  },
  barWrapper: {
    alignItems: 'center',
    marginHorizontal: 10,
    justifyContent: 'flex-end',
    position: 'relative',
    height: chartHeight + 40, // allows space for label
  },
  animatedBar: {
    width: 40,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    transform: [{ rotate: '270deg' }],
    width: 100,
    textAlign: 'center',
    
  },
  valueLabel: {
    fontSize: 11,
    color: '#333',
    fontWeight: 'bold',
    position: 'absolute',
    textAlign: 'center',
    marginBottom:10
  },
  xAxisLabel: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    width: 60,
    marginTop: 6,
  },
});

export default UptimeBarChart;
