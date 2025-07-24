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
  SafeAreaView
} from "react-native";
import axios from "axios";
import { PieChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import moment from "moment-timezone";

const BASE_URL = "http://192.168.1.3:8000";
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
  return [...Array(Math.max(0, count))].map((_, i) => baseColors[i % baseColors.length]);
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
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState({ on_time_hr: 0, off_time_hr: 0 });

  CumulativeAnalysisGraph.defaultProps = {
    range: 'last_hour',
    fromDate: null,
    toDate: null
  };

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

  const fetchMachineStatus = async (fromDateStr, toDateStr) => {
    try {
      // console.log("Fetching machine status...");
      // console.log("From Date:", fromDateStr);
      // console.log("To Date:", toDateStr);

      const res = await axios.get(`${BASE_URL}/api/machine-status/`, {
        params: {
          gfrid,
          from_date: fromDateStr,
          to_date: toDateStr,
        },
      });

      const on_time_hr = res.data.on_time_sec ? res.data.on_time_sec / 3600 : 0;
      const off_time_hr = res.data.off_time_sec ? res.data.off_time_sec / 3600 : 0;

      console.log("ON Time (hr):", on_time_hr);
      console.log("OFF Time (hr):", off_time_hr);

      setStatusData({ on_time_hr, off_time_hr });
    } catch (err) {
      console.error("Failed to fetch machine status", err);
    }
  };

  const fetchCumulativeData = async () => {
    try {
      setLoading(true);
      setError(null);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      slideAnim.setValue(30);

      let params = { gfrid };
      const effectiveRange = (!range && !fromDate && !toDate) ? 'last_hour' : range;

      if (effectiveRange === 'last_hour') {
        params.from_date = moment().subtract(1, 'hour').utc().format();
        params.to_date = moment().utc().format();
      } else if (effectiveRange === 'last_6_hours') {
        params.from_date = moment().subtract(6, 'hours').utc().format();
        params.to_date = moment().utc().format();
      } else if (effectiveRange === 'last_24_hours') {
        params.from_date = moment().subtract(24, 'hours').utc().format();
        params.to_date = moment().utc().format();
      } else if (fromDate && toDate) {
        params.from_date = moment(fromDate).utc().format();
        params.to_date = moment(toDate).utc().format();
      } else {
        params.from_date = moment().subtract(1, 'hour').utc().format();
        params.to_date = moment().utc().format();
      }

      const fromDateStr = params.from_date;
      const toDateStr = params.to_date;

      // console.log("Fetching cumulative data...");
      // console.log("From Date:", fromDateStr);
      // console.log("To Date:", toDateStr);

      const [cumulativeRes, _] = await Promise.all([
        axios.get(`${BASE_URL}/api/cumulative-analysis/`, { params }),
        fetchMachineStatus(fromDateStr, toDateStr)
      ]);

      const processedData = {
        ...cumulativeRes.data,
        on_off_records: cumulativeRes.data.on_off_records?.map(record => ({
          ...record,
          start_time: moment(record.start_time).local().format(),
          end_time: moment(record.end_time).local().format()
        })) || [],
        time_range: {
          ...cumulativeRes.data.time_range,
          from: moment(cumulativeRes.data.time_range?.from).local().format(),
          to: moment(cumulativeRes.data.time_range?.to).local().format()
        }
      };

      setData(processedData);
    } catch (err) {
      console.error("Fetch error", err);
      setError("Failed to load data. Please try again.");
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

  const refreshData = () => {
    fetchCumulativeData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading data...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="warning-outline" size={48} color={theme.danger} />
        <Text style={[styles.loadingText, { color: theme.danger }]}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={refreshData}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!data || (data.on_time_hr === 0 && data.off_time_hr === 0 && 
      (!data.movements_by_alertNotify || data.movements_by_alertNotify.length === 0))) {
    return (
      <SafeAreaView style={styles.noDataContainer}>
        <Image
          source={require("../assets/nodata.jpg")}
          style={styles.noDataImage}
          resizeMode="contain"
        />
        <View style={styles.noDataContent}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.textSecondary} />
          <Text style={styles.noDataText}>No data available for the selected period</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={refreshData}
          >
            <Ionicons name="refresh" size={20} color={theme.primary} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalDuration = data.movements_by_alertNotify?.reduce(
    (sum, d) => sum + (d.duration_hr || 0), 0
  ) || 0;
  const colors = generateColorPalette(data.movements_by_alertNotify?.length || 0);

  const pieData = (data.movements_by_alertNotify || [])
    .filter(item => item.alertNotify_id != null)
    .map((item, index) => ({
      name: `ID ${item.alertNotify_id}`,
      duration: item.duration_hr || 0,
      color: colors[index],
      legendFontColor: theme.textPrimary,
      legendFontSize: 13,
      id: item.alertNotify_id,
      duration_min: item.duration_min || 0
    }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Equipment Analysis</Text>
          <TouchableOpacity onPress={refreshData} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

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
  <Text style={styles.cardValue}>{statusData.on_time_hr.toFixed(2)} hrs</Text>
  <Text style={styles.cardPercentage}>
    {(
      (statusData.on_time_hr / (statusData.on_time_hr + statusData.off_time_hr)) *
        100 || 0
    ).toFixed(1)}%
  </Text>
</View>

          
         <View style={[styles.card, styles.offTimeCard]}>
  <View style={styles.cardHeader}>
    <View style={[styles.cardIconContainer, styles.offTimeIcon]}>
      <Ionicons name="power" size={18} color="#fff" />
    </View>
    <Text style={styles.cardTitle}>OFF Time</Text>
  </View>
  <Text style={styles.cardValue}>{statusData.off_time_hr.toFixed(2)} hrs</Text>
  <Text style={styles.cardPercentage}>
    {(
      (statusData.off_time_hr / (statusData.on_time_hr + statusData.off_time_hr)) *
        100 || 0
    ).toFixed(1)}%
  </Text>
</View>

        </Animated.View>

        {pieData.length > 0 && (
          <>
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
                  <Text style={styles.chartTitle}>Movement Time by Alert ID</Text>
                </View>
                <Text style={styles.chartSubtitle}>Total: {totalDuration.toFixed(2)} hours</Text>
              </View>
              
              <PieChart
                data={pieData}
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
              <View style={styles.legendHeader}>
                <Text style={styles.legendTitle}>Alert IDs</Text>
                <Text style={styles.legendCount}>{pieData.length} alerts</Text>
              </View>
              <View style={styles.legendGrid}>
                {pieData.map((item, idx) => (
                  <TouchableOpacity
                    key={`${item.id}-${idx}`}
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
                      <Text style={styles.legendDuration}>
                        {item.duration.toFixed(2)}h ({item.duration_min.toFixed(0)}m)
                      </Text>
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
          </>
        )}

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
                {selected && (
                  <>
                    <View style={styles.modalChartContainer}>
                      <PieChart
                        data={[
                          {
                            name: `ID ${selected.id}`,
                            duration: selected.duration,
                            color: selected.color,
                            legendFontColor: theme.textPrimary,
                            legendFontSize: 0,
                          },
                          {
                            name: "Other",
                            duration: totalDuration - selected.duration,
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
                            { backgroundColor: selected.color }
                          ]} />
                          <Text style={styles.modalChartLabelText}>
                            {((selected.duration / totalDuration) * 100).toFixed(1)}%
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
                        <Text style={styles.detailValue}>{selected.id}</Text>
                      </View>

                      <View style={styles.detailDivider} />

                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Ionicons name="time" size={18} color={theme.textSecondary} />
                        </View>
                        <Text style={styles.detailLabel}>Duration:</Text>
                        <Text style={styles.detailValue}>
                          {selected.duration.toFixed(2)} hours ({selected.duration_min.toFixed(0)} minutes)
                        </Text>
                      </View>

                      <View style={styles.detailDivider} />

                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Ionicons name="pie-chart" size={18} color={theme.textSecondary} />
                        </View>
                        <Text style={styles.detailLabel}>Percentage:</Text>
                        <Text style={styles.detailValue}>
                          {((selected.duration / totalDuration) * 100).toFixed(1)}%
                        </Text>
                      </View>

                      <View style={styles.detailDivider} />

                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Ionicons name="calendar" size={18} color={theme.textSecondary} />
                        </View>
                        <Text style={styles.detailLabel}>Time Range:</Text>
                        <Text style={styles.detailValue}>
                          {(!range && !fromDate && !toDate) ? 'Last Hour' : 
                           range === 'last_hour' ? 'Last Hour' : 
                           range === 'last_6_hours' ? 'Last 6 Hours' : 
                           range === 'last_24_hours' ? 'Last 24 Hours' : 
                           'Custom Range'}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  { 
                    backgroundColor: selected?.color || theme.primary,
                    borderTopColor: theme.border,
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: theme.textPrimary,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: theme.primary,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 20,
  },
  noDataImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  noDataContent: {
    alignItems: 'center',
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    backgroundColor: theme.light,
  },
  refreshText: {
    marginLeft: 5,
    color: theme.primary,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  onTimeCard: {
    backgroundColor: theme.successLight,
  },
  offTimeCard: {
    backgroundColor: theme.dangerLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 5,
  },
  cardPercentage: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  chartBox: {
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginLeft: 10,
  },
  chartSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  pieChart: {
    marginVertical: 8,
  },
  legendContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  legendCount: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    borderLeftWidth: 4,
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 10,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  legendDuration: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  legendChevron: {
    marginLeft: 5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth - 40,
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 15,
  },
  modalChartContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalChartLabel: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalChartLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  modalChartColorBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 5,
  },
  modalChartLabelText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  detailCard: {
    backgroundColor: theme.light,
    borderRadius: 8,
    padding: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 10,
  },
  detailLabel: {
    width: 100,
    fontSize: 14,
    color: theme.textSecondary,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 5,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 10,
  },
});

export default CumulativeAnalysisGraph;

















