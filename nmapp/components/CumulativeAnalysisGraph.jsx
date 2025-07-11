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
  secondary: "#a8c6fa",
  success: "#4dc429",
  danger: "#dc3545",
  warning: "#ffc107",
  info: "#17a2b8",
  light: "#c3e0dd",
  dark: "#343a40",
  background: "#f5f7fa",
  cardBackground: "#ffffff",
  textPrimary: "#212529",
  textSecondary: "#6c757d",
};

const generateColorPalette = (count) => {
  const baseColors = [
    "#FF6F61", "#6B5B95", "#88B04B", "#F7CAC9", "#92A8D1",
    "#955251", "#B565A7", "#009B77", "#DD4124", "#45B8AC",
    "#D65076", "#EFC050", "#5B5EA6", "#9B2335", "#DFCFBE"
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
          style={{ width: 200, height: 200, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Ionicons name="alert-circle-outline" size={36} color={theme.textSecondary} />
        <Text style={styles.noDataText}>No data available for the selected period</Text>
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
    <ScrollView style={styles.container}>
      <Animated.View style={[styles.summaryRow, { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: slideAnim }] }]}>
        <View style={[styles.card, { backgroundColor: theme.success }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="power-outline" size={20} color="#fff" />
            <Text style={styles.cardTitle}>ON Time</Text>
          </View>
          <Text style={styles.cardValue}>{data.on_time_hr.toFixed(2)} hrs</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.danger }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="power-outline" size={20} color="#fff" />
            <Text style={styles.cardTitle}>OFF Time</Text>
          </View>
          <Text style={styles.cardValue}>{data.off_time_hr.toFixed(2)} hrs</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.chartBox, { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: slideAnim }] }]}>
        <View style={styles.chartTitleContainer}>
          <Ionicons name="pie-chart-outline" size={20} color={theme.primary} />
          <Text style={styles.chartTitle}>Movement Time by ID (Hours)</Text>
        </View>
        <PieChart
          data={pieDataWithColor}
          width={screenWidth - 32}
          height={263}
          accessor="duration"
          backgroundColor="transparent"
          marginLeft={0}
          paddingLeft="15"
          chartConfig={{
            color: () => theme.textPrimary,
            labelColor: () => theme.textPrimary,
            propsForLabels: { fontSize: 12, fontWeight: "bold" },
          }}
          absolute
          style={styles.pieChart}
        />
      </Animated.View>

      <Animated.View style={[styles.legendRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {pieDataWithColor.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.legendItem, { backgroundColor: `${item.color}20` }]}
            onPress={() => openModal(item)}
          >
            <View style={[styles.colorBox, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Enhanced Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
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
            <View style={[styles.modalHeader, { borderBottomColor: selected?.color || theme.primary }]}>
              <Text style={styles.modalTitle}>Alert Details</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
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
                    color: "#f0f0f0",
                    legendFontColor: "transparent",
                    legendFontSize: 0,
                  },
                ]}
                width={screenWidth - 80}
                height={180}
                accessor="duration"
                backgroundColor="transparent"
                paddingLeft="15"
                hasLegend={false}
                chartConfig={{
                  color: () => theme.textPrimary,
                  labelColor: () => theme.textPrimary,
                }}
                absolute
                style={styles.modalPieChart}
              />

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="barcode-outline" size={20} color={theme.textSecondary} />
                  <Text style={styles.detailLabel}>Alert ID:</Text>
                  <Text style={styles.detailValue}>{selected?.id}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                  <Text style={styles.detailLabel}>Duration:</Text>
                  <Text style={styles.detailValue}>{selected?.duration?.toFixed(2)} hours</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="pie-chart-outline" size={20} color={theme.textSecondary} />
                  <Text style={styles.detailLabel}>Percentage:</Text>
                  <Text style={styles.detailValue}>
                    {((selected?.duration / totalDuration) * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: selected?.color || theme.primary }]}
              onPress={closeModal}
            >
              <Text style={styles.actionButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    padding: 16,
    marginBottom:20
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 10,
    color: theme.textSecondary,
    fontSize: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  noDataText: {
    marginTop: 15,
    color: theme.textSecondary,
    fontSize: 18,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  card: {
    flex: 0.48,
    borderRadius: 14,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 8,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  chartBox: {
    backgroundColor: theme.cardBackground,
    borderRadius: 14,
    padding: 16,
    elevation: 4,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  chartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.textPrimary,
    marginLeft: 8,
  },
  pieChart: {
    marginVertical: 8,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: theme.textPrimary,
  },
  // Enhanced Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    width: "100%",
    maxWidth: 300,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    maxHeight:600
  },
  modalHeader: {
    padding: 10,
    borderBottomWidth: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(248, 249, 250, 0.9)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.textPrimary,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  modalBody: {
    padding: 10,
  },
  modalPieChart: {
    // alignSelf: "center",
    marginVertical: 2,
    marginLeft:45
  },
  detailCard: {
    backgroundColor: theme.light,
    borderRadius: 12,
    padding: 10,
    // marginTop: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  detailLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.textSecondary,
    marginLeft: 10,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  actionButton: {
    padding: 16,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
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
