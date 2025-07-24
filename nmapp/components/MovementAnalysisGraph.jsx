import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Image,
} from "react-native";
import axios from "axios";
import { LineChart, BarChart } from "react-native-chart-kit";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import Ionicons from "react-native-vector-icons/Ionicons";
import { buildDateParams } from "../utils/dateUtils";
import NoDataImage from "../assets/nodata.jpg";
import ViewShot from "react-native-view-shot";
import { BASE_URL } from '../config';

dayjs.extend(utc);

const screenWidth = Dimensions.get("window").width;
const MAX_DATA_POINTS = 100;  // Add this line
const LABEL_WIDTH = 100;

const theme = {
  primary: "#4a6da7",
  danger: "#dc3545",
  background: "#f5f7fa",
  text: "#333",
  textSecondary: "#666",
};

const MovementAnalysisGraph = ({ gfrid, fromDate, toDate, range }) => {
  const [movementData, setMovementData] = useState([]);
  const [prevMovementData, setPrevMovementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeGraph, setActiveGraph] = useState(null);
  const [currentTab, setCurrentTab] = useState("status");
  const [currentPage, setCurrentPage] = useState(0);
  
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const viewShotRef = useRef();
  
  const labelColors = {};

  const getRandomColorForLabel = (label) => {
    if (!labelColors[label]) {
      const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`;
      labelColors[label] = color;
    }
    return labelColors[label];
  };

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatLabelParts = (dt, dur = null) => {
    const date = dayjs(dt);
    const time = date.format("hh:mm A");
    const day = date.format("D MMM");
    return {
      label1: `${time}`,
      label2: `${day}${dur ? ` • ${formatDuration(dur)}` : ""}`,
    };
  };

  const fetchMovementData = async () => {
    try {
      setLoading(true);
      const params = buildDateParams(gfrid, fromDate, toDate, range);
      const res = await axios.get(`${BASE_URL}/api/movement-duration/`, { params });
      
      // Start transition animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Update data after fade out
        setPrevMovementData(movementData);
        setMovementData(res.data?.movements || []);
        
        // Fade in new data
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } catch {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

 useEffect(() => {
  fetchMovementData();

  const interval = setInterval(() => {
    fetchMovementData();
  }, 10000); // fetch every 10 seconds

  return () => clearInterval(interval); // cleanup on unmount
}, [gfrid, fromDate, toDate, range]);


  const grouped = useMemo(() => {
    const groups = {};
    for (const item of movementData) {
      const label = item?.movement || `alert_${item?.alertNotify_id || "unknown"}`;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return groups;
  }, [movementData]);

  const prevGrouped = useMemo(() => {
    const groups = {};
    for (const item of prevMovementData) {
      const label = item?.movement || `alert_${item?.alertNotify_id || "unknown"}`;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return groups;
  }, [prevMovementData]);

  const safeDownsample = (data, max) => {
    const step = Math.max(1, Math.floor(data.length / max));
    return data.filter((_, i) => i % step === 0).slice(0, max);
  };

  const buildStatusChartData = (data) => {
    const sampled = safeDownsample(data, MAX_DATA_POINTS / 4);
    const labels = [], values = [], custom = [];
    for (const item of sampled) {
      const dur = (new Date(item.end_time) - new Date(item.start_time)) / 1000;
      const start = formatLabelParts(item.start_time);
      const end = formatLabelParts(item.end_time, dur);
      labels.push("", "", "", "");
      values.push(0, 1, 1, 0);
      custom.push(start, start, end, end);
    }
    return { labels, values, custom };
  };

  const buildHourlyChartData = (data) => {
    const sampled = safeDownsample(data, MAX_DATA_POINTS);
    const hours = {};
    for (const item of sampled) {
      let cur = new Date(item.start_time);
      const end = new Date(item.end_time);
      while (cur < end) {
        const h = `${cur.getHours().toString().padStart(2, "0")}:00`;
        const next = new Date(cur);
        next.setHours(cur.getHours() + 1, 0, 0, 0);
        const segEnd = new Date(Math.min(end, next));
        const dur = (segEnd - cur) / 1000;
        hours[h] = (hours[h] || 0) + dur;
        cur = segEnd;
      }
    }
    const hKeys = Object.keys(hours).sort();
    return {
      labels: hKeys,
      values: hKeys.map(h => +(hours[h] / 3600).toFixed(2)),
      custom: hKeys.map(h => ({ label1: "", label2: `Dur: ${formatDuration(hours[h])}` }))
    };
  };

  const openGraph = (label) => {
    setActiveGraph(label);
    setCurrentTab("status");
    setCurrentPage(0);
    setModalVisible(true);

    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    translateYAnim.setValue(30);

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeGraph = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: 30, duration: 200, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  const paginatedData = useMemo(() => {
    const data = grouped[activeGraph] || [];
    const start = currentPage * MAX_DATA_POINTS;
    const end = start + MAX_DATA_POINTS;
    return data.slice(start, end);
  }, [grouped, activeGraph, currentPage]);

  const chartInfo = useMemo(() => {
    if (!activeGraph || !grouped[activeGraph]) return null;
    const data = paginatedData;
    if (currentTab === "status") return buildStatusChartData(data);
    return buildHourlyChartData(data);
  }, [activeGraph, currentTab, paginatedData]);

  if (loading && movementData.length === 0) {
    return <ActivityIndicator size="large" style={{ marginTop: 30 }} />;
  }

  if (error) return <Text style={{ color: theme.danger }}>{error}</Text>;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <ScrollView style={{ backgroundColor: theme.background }}>
        {movementData.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Image source={NoDataImage} style={styles.noDataImage} resizeMode="contain" />
            <Text style={styles.noDataText}>No movement data available</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([label]) => (
            <TouchableOpacity 
              key={label} 
              style={[styles.card, { borderLeftColor: getRandomColorForLabel(label) }]} 
              onPress={() => openGraph(label)}
            >
              <View style={styles.wholecard}>
                <Ionicons name="pulse-outline" size={24} color={getRandomColorForLabel(label)} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardText}>ID : {label.toUpperCase()}</Text>
                  <Ionicons name="chevron-forward" size={25} color={theme.textSecondary} style={styles.iconstyle} />
                </View>
              </View>
              <Text style={styles.cardSubtext}>{grouped[label].length} events recorded</Text>
            </TouchableOpacity>
          ))
        )}

        <Modal visible={modalVisible} transparent animationType="none">
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.popupCard, { 
              transform: [{ scale: scaleAnim }, { translateY: translateYAnim }], 
              opacity: opacityAnim 
            }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeGraph} style={styles.closeButton}>
                  <Ionicons name="close-circle-outline" size={32} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
                <Text style={styles.popupTitle}>{activeGraph?.toUpperCase()}</Text>
                <Text style={styles.popupSubtitle}>
                  {dayjs(fromDate).format("DD MMM YYYY")} → {dayjs(toDate).format("DD MMM YYYY")}
                </Text>

                <View style={styles.tabContainer}>
                  {["status", "analysis"].map(tab => (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setCurrentTab(tab)}
                      style={[styles.tabButton, { 
                        backgroundColor: tab === currentTab ? theme.primary : "#ccc" 
                      }]}
                    >
                      <Ionicons 
                        name={tab === "status" ? "pulse-outline" : "analytics-outline"} 
                        size={16} 
                        color="#fff" 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={styles.tabText}>{tab.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {chartInfo && (
                  <ScrollView horizontal>
                    <View>
                      <LineChart
                        data={{ 
                          labels: chartInfo.labels, 
                          datasets: [{ data: chartInfo.values }] 
                        }}
                        width={Math.max(screenWidth * 0.8, chartInfo.labels.length * LABEL_WIDTH)}
                        height={240}
                        chartConfig={{ 
                          backgroundGradientFrom: '#fff', 
                          backgroundGradientTo: '#fff', 
                          decimalPlaces: currentTab === "analysis" ? 2 : 0, 
                          color: () => 'black', 
                          labelColor: () => '#000' 
                        }}
                        yAxisSuffix={currentTab === "analysis" ? "h" : ""}
                        bezier={currentTab === "analysis"}
                        style={{ margin: 10, borderRadius: 12 }}
                        fromZero
                      />
                      <ScrollView horizontal>
                        <View style={{ flexDirection: 'row', paddingHorizontal: 10 }}>
                          {chartInfo.custom.map(({ label1, label2 }, i) => (
                            <View key={i} style={{ width: LABEL_WIDTH, alignItems: 'center' }}>
                              <Text style={{ fontSize: 11 }}>{label1}</Text>
                              <Text style={{ fontSize: 10, color: '#666' }}>{label2}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </ScrollView>
                )}
              </ViewShot>

              <View style={styles.paginationContainer}>
                <TouchableOpacity 
                  onPress={() => setCurrentPage(p => Math.max(0, p - 1))} 
                  disabled={currentPage === 0} 
                  style={{ 
                    padding: 10, 
                    opacity: currentPage === 0 ? 0.5 : 1 
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={{ paddingHorizontal: 10, fontWeight: '600' }}>
                  Page {currentPage + 1}
                </Text>
                <TouchableOpacity 
                  onPress={() => setCurrentPage(p => p + 1)} 
                  disabled={paginatedData.length < MAX_DATA_POINTS} 
                  style={{ 
                    padding: 10, 
                    opacity: paginatedData.length < MAX_DATA_POINTS ? 0.5 : 1 
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.movementScrollBar}
              >
                {Object.keys(grouped).map((label) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => { 
                      setActiveGraph(label); 
                      setCurrentPage(0); 
                    }}
                    style={[styles.movementSwitchButton, { 
                      backgroundColor: activeGraph === label ? theme.primary : "#ccc" 
                    }]}
                  >
                    <Text style={styles.tabText}>{label.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: "#dff5f3",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 4, height: 9 },
    shadowRadius: 9,
    borderBottomWidth: 4,
    borderBottomColor: "#545a91",
  },
  cardText: {
    fontWeight: "700",
    fontSize: 16,
    color: "#333",
  },
  wholecard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  iconstyle: {
    marginTop: 0
  },
  cardContent: {
    width: 260,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  noDataContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  noDataImage: {
    width: 220,
    height: 180,
    marginBottom: 12,
  },
  noDataText: {
    fontSize: 16,
    color: "#888",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  popupCard: {
    width: "92%",
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  popupSubtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 10,
  },
  closeButton: {
    // backgroundColor: "red",
    position: "absolute",
    right: 5,
    top: 5,
    zIndex: 1,
    // borderRadius: 23
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  tabButton: {
    padding: 10,
    margin: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  tabText: {
    color: "#fff",
    fontWeight: "600",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
   movementScrollBar: {
    flexDirection: 'row',
    paddingVertical: 8,
    // paddingHorizontal: 10,
    
    
  },
  movementSwitchButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginHorizontal: 6,
  },
});

export default MovementAnalysisGraph;













