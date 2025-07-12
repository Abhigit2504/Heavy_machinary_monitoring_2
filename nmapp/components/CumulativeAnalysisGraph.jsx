


import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import axios from "axios";
import { PieChart } from "react-native-chart-kit";
import { buildDateParams } from "../utils/dateUtils";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BASE_URL } from '../config';

const screenWidth = Dimensions.get("window").width;

const theme = {
  primary: "#4a6da7",
  primaryLight: "#e8f0fe",
  secondary: "#a8c6fa",
  success: "#28a745",
  successLight: "#e6f7eb",
  danger: "#dc3545",
  dangerLight: "#fce8e8",
  warning: "#ffc107",
  warningLight: "#fff8e6",
  info: "#17a2b8",
  light: "#f8f9fa",
  dark: "#343a40",
  background: "#f5f7fa",
  cardBackground: "#ffffff",
  textPrimary: "#212529",
  textSecondary: "#6c757d",
  border: "#e9ecef",
};

const generateColorPalette = (count) => {
  const baseColors = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
    "#8cd17d", "#86bcb6", "#e19d1a", "#79706e", "#d37295"
  ];
  return [...Array(count)].map((_, i) => baseColors[i % baseColors.length]);
};

const CumulativeAnalysisGraph = ({ gfrid, fromDate, toDate, range }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [slideAnim] = useState(new Animated.Value(30));
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalScale] = useState(new Animated.Value(0.8));
  const [modalOpacity] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchCumulativeData();
  }, [gfrid, fromDate, toDate, range]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const fetchCumulativeData = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      slideAnim.setValue(30);
      const params = buildDateParams(gfrid, fromDate, toDate, range);
      const res = await axios.get(`${BASE_URL}/api/cumulative-analysis/`, { params });
      setData(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item) => {
    setSelected(item);
    setModalVisible(true);
    modalScale.setValue(0.8);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setSelected(null);
    });
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );

  if (!data || (data.on_time_hr === 0 && data.off_time_hr === 0))
    return (
      <View style={styles.noDataContainer}>
        <Image
          source={require("../assets/nodata.jpg")}
          style={styles.noDataImage}
          resizeMode="contain"
        />
        <View style={styles.noDataContent}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.textSecondary} />
          <Text style={styles.noDataText}>No data available for the selected period</Text>
        </View>
      </View>
    );

  const totalDuration = data.movements_by_alertNotify.reduce((sum, d) => sum + d.duration_hr, 0);
  const colors = generateColorPalette(data.movements_by_alertNotify.length);

  const pieData = data.movements_by_alertNotify.map((item, index) => ({
    name: `ID ${item.alertNotify_id}`,
    duration: item.duration_hr,
    color: colors[index],
    legendFontColor: theme.textPrimary,
    legendFontSize: 13,
    id: item.alertNotify_id,
  }));

  const pieDataWithColor = pieData.map((item) => ({
    ...item,
    color: item.color,
  }));

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View 
        style={[
          styles.summaryRow, 
          { 
            opacity: fadeAnim, 
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }] 
          }
        ]}
      >
        <View style={[styles.card, styles.onTimeCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, styles.onTimeIcon]}>
              <Ionicons name="power" size={18} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>ON Time</Text>
          </View>
          <Text style={styles.cardValue}>{data.on_time_hr.toFixed(2)} hrs</Text>
          <Text style={styles.cardPercentage}>
            {((data.on_time_hr / (data.on_time_hr + data.off_time_hr)) * 100).toFixed(1)}%
          </Text>
        </View>
        
        <View style={[styles.card, styles.offTimeCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, styles.offTimeIcon]}>
              <Ionicons name="power" size={18} color="#fff" />
            </View>
            <Text style={styles.cardTitle}>OFF Time</Text>
          </View>
          <Text style={styles.cardValue}>{data.off_time_hr.toFixed(2)} hrs</Text>
          <Text style={styles.cardPercentage}>
            {((data.off_time_hr / (data.on_time_hr + data.off_time_hr)) * 100).toFixed(1)}%
          </Text>
        </View>
      </Animated.View>

      <Animated.View 
        style={[
          styles.chartBox, 
          { 
            opacity: fadeAnim, 
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }] 
          }
        ]}
      >
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleContainer}>
            <Ionicons name="pie-chart" size={20} color={theme.primary} />
            <Text style={styles.chartTitle}>Movement Time by ID</Text>
          </View>
          <Text style={styles.chartSubtitle}>Total: {totalDuration.toFixed(2)} hours</Text>
        </View>
        
        <PieChart
          data={pieDataWithColor}
          width={screenWidth - 40}
          height={220}
          accessor="duration"
          backgroundColor="transparent"
          paddingLeft="15"
          center={[10, 0]}
          chartConfig={{
            color: () => theme.textPrimary,
            labelColor: () => theme.textPrimary,
            propsForLabels: { 
              fontSize: 11, 
              fontWeight: "500" 
            },
          }}
          absolute
          style={styles.pieChart}
          hasLegend={false}
        />
      </Animated.View>

      <Animated.View 
        style={[
          styles.legendContainer, 
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }
        ]}
      >
        <Text style={styles.legendTitle}>Alert IDs</Text>
        <View style={styles.legendGrid}>
          {pieDataWithColor.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.legendItem, 
                { 
                  backgroundColor: `${item.color}10`,
                  borderLeftColor: item.color 
                }
              ]}
              onPress={() => openModal(item)}
            >
              <View style={[styles.colorBox, { backgroundColor: item.color }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>{item.name}</Text>
                <Text style={styles.legendDuration}>{item.duration.toFixed(2)}h</Text>
              </View>
              <Ionicons 
                name="chevron-forward" 
                size={16} 
                color={theme.textSecondary} 
                style={styles.legendChevron}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Enhanced Modal */}
      <Modal 
        visible={modalVisible} 
        transparent 
        animationType="fade"
        statusBarTranslucent
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ scale: modalScale }],
                opacity: modalOpacity,
              },
            ]}
          >
            <View style={[
              styles.modalHeader, 
              { 
                backgroundColor: selected?.color ? `${selected.color}20` : theme.primaryLight,
                borderBottomColor: selected?.color || theme.primary 
              }
            ]}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="information-circle" size={24} color={selected?.color || theme.primary} />
                <Text style={styles.modalTitle}>Alert Details</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalChartContainer}>
                <PieChart
                  data={[
                    {
                      name: `ID ${selected?.id}`,
                      duration: selected?.duration,
                      color: selected?.color,
                      legendFontColor: theme.textPrimary,
                      legendFontSize: 0,
                    },
                    {
                      name: "Other",
                      duration: totalDuration - selected?.duration,
                      color: theme.border,
                      legendFontColor: "transparent",
                      legendFontSize: 0,
                    },
                  ]}
                  width={screenWidth - 100}
                  height={180}
                  accessor="duration"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  hasLegend={false}
                  center={[0, 0]}
                  chartConfig={{
                    color: () => theme.textPrimary,
                    labelColor: () => theme.textPrimary,
                  }}
                  absolute
                />
                <View style={styles.modalChartLabel}>
                  <View style={styles.modalChartLabelItem}>
                    <View style={[
                      styles.modalChartColorBox, 
                      { backgroundColor: selected?.color || theme.primary }
                    ]} />
                    <Text style={styles.modalChartLabelText}>
                      {((selected?.duration / totalDuration) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="barcode" size={18} color={theme.textSecondary} />
                  </View>
                  <Text style={styles.detailLabel}>Alert ID:</Text>
                  <Text style={styles.detailValue}>{selected?.id}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="time" size={18} color={theme.textSecondary} />
                  </View>
                  <Text style={styles.detailLabel}>Duration:</Text>
                  <Text style={styles.detailValue}>{selected?.duration?.toFixed(2)} hours</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="pie-chart" size={18} color={theme.textSecondary} />
                  </View>
                  <Text style={styles.detailLabel}>Percentage:</Text>
                  <Text style={styles.detailValue}>
                    {((selected?.duration / totalDuration) * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[
                styles.actionButton, 
                { 
                  backgroundColor: selected?.color || theme.primary,
                  borderTopColor: theme.border,
                  borderTopWidth: 1
                }
              ]}
              onPress={closeModal}
            >
              <Text style={styles.actionButtonText}>Close Details</Text>
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.background,
  },
  noDataImage: {
    width: 180,
    height: 180,
    marginBottom: 24,
    opacity: 0.8,
  },
  noDataContent: {
    alignItems: 'center',
  },
  noDataText: {
    marginTop: 12,
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  card: {
    flex: 0.48,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  onTimeCard: {
    backgroundColor: theme.successLight,
    borderWidth: 1,
    borderColor: `${theme.success}20`,
  },
  offTimeCard: {
    backgroundColor: theme.dangerLight,
    borderWidth: 1,
    borderColor: `${theme.danger}20`,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  onTimeIcon: {
    backgroundColor: theme.success,
  },
  offTimeIcon: {
    backgroundColor: theme.danger,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.textPrimary,
    marginBottom: 4,
  },
  cardPercentage: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  chartBox: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textPrimary,
    marginLeft: 8,
  },
  chartSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },
  pieChart: {
    marginVertical: 8,
  },
  legendContainer: {
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 12,
    marginLeft: 4,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: '48%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.light,
    borderLeftWidth: 3,
  },
  colorBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 10,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  legendDuration: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  legendChevron: {
    marginLeft: 8,
  },
  // Enhanced Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textPrimary,
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalChartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalChartLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalChartLabelItem: {
    alignItems: 'center',
  },
  modalChartColorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginBottom: 8,
  },
  modalChartLabelText: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  detailCard: {
    backgroundColor: theme.light,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  detailIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 15,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 36,
  },
  actionButton: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
});

export default CumulativeAnalysisGraph;




















// import React, { useEffect, useState } from "react";
// import { View, Text, ScrollView, Dimensions, StyleSheet } from "react-native";
// import axios from "axios";
// import { PieChart } from "react-native-chart-kit";
// import { buildDateParams } from "../utils/dateUtils";
// import {
//   AnimatedCard,
//   LoadingScreen,
//   NoDataScreen,
//   sharedStyles,
// } from "./SharedUI.js";

// const BASE_URL = "http://192.168.1.5:8000";
// const screenWidth = Dimensions.get("window").width;

// const generateColorPalette = (count) => {
//   const baseColors = [
//     "#FF6F61",
//     "#6B5B95",
//     "#88B04B",
//     "#F7CAC9",
//     "#92A8D1",
//     "#955251",
//     "#B565A7",
//     "#009B77",
//     "#DD4124",
//     "#45B8AC",
//     "#D65076",
//     "#EFC050",
//     "#5B5EA6",
//     "#9B2335",
//     "#DFCFBE",
//   ];
//   return [...Array(count)].map((_, i) => baseColors[i % baseColors.length]);
// };

// const CumulativeAnalysisGraph = ({ gfrid, fromDate, toDate, range }) => {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         const params = buildDateParams(gfrid, fromDate, toDate, range);
//         const res = await axios.get(`${BASE_URL}/api/cumulative-analysis/`, {
//           params,
//         });
//         setData(res.data);
//       } catch (err) {
//         console.error("Fetch error", err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, [gfrid, fromDate, toDate, range]);

//   if (loading) return <LoadingScreen />;
//   if (!data || (data.on_time_hr === 0 && data.off_time_hr === 0))
//     return <NoDataScreen />;

//   const colors = generateColorPalette(data.movements_by_alertNotify.length);
//   const pieData = data.movements_by_alertNotify.map((item, index) => ({
//     name: `ID ${item.alertNotify_id}`,
//     duration: item.duration_hr,
//     color: colors[index],
//     legendFontColor: "#444",
//     legendFontSize: 13,
//   }));

//   return (
//     <ScrollView style={{ backgroundColor: "#f4f6f8", padding: 16 }}>
//       <AnimatedCard
//         icon="flash"
//         title="ON Time"
//         value={`${data.on_time_hr.toFixed(2)} hrs`}
//         color="#00796B"
//       />
//       <AnimatedCard
//         icon="power"
//         title="OFF Time"
//         value={`${data.off_time_hr.toFixed(2)} hrs`}
//         color="#D32F2F"
//       />

//       <View style={[sharedStyles.card]}>
//         <Text style={sharedStyles.sectionTitle}>
//           Movement Time by AlertNotify ID
//         </Text>
//         <PieChart
//           data={pieData}
//           width={screenWidth - 32}
//           height={300}
//           accessor="duration"
//           backgroundColor="transparent"
//           paddingLeft="15"
//           chartConfig={{
//             backgroundGradientFrom: "#e0f2f1",
//             backgroundGradientTo: "#ffffff",
//             color: () => "#000",
//             labelColor: () => "#444",
//           }}
//           absolute
//         />
//       </View>
//     </ScrollView>
//   );
// };

// export default CumulativeAnalysisGraph;
