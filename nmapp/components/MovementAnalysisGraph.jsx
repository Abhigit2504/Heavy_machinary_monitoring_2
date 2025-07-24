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


















// import React, { useEffect, useState, useMemo } from "react";
// import {
//   View,
//   Text,
//   ScrollView,
//   Dimensions,
//   ActivityIndicator,
//   TouchableOpacity,
//   StyleSheet,
// } from "react-native";
// import axios from "axios";
// import { LineChart } from "react-native-chart-kit";
// import { Image } from "react-native"; // 👈 Add this
// import { buildDateParams } from "../utils/dateUtils";
// import dayjs from 'dayjs';
// import utc from 'dayjs/plugin/utc';
// dayjs.extend(utc);

// import Ionicons from "react-native-vector-icons/Ionicons";


// const theme = {
//   primary: "#4a6da7",
//   secondary: "#a8c6fa",
//   success: "#4dc429",
//   danger: "#dc3545",
//   warning: "#ffc107",
//   info: "#17a2b8",
//   light: "#f8f9fa",
//   dark: "#343a40",
//   background: "#f5f7fa",
//   cardBackground: "#ffffff",
//   textPrimary: "#212529",
//   textSecondary: "#6c757d",
// };

// const BASE_URL = "http://192.168.1.5:8000";
// const screenWidth = Dimensions.get("window").width;
// const MAX_DATA_POINTS = 100;
// const LABEL_WIDTH = 100;

// const MovementAnalysisGraph = ({ gfrid, fromDate, toDate, range }) => {
//   const [movementData, setMovementData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [tab, setTab] = useState("status");
//   const [error, setError] = useState(null);
//   const [currentPage, setCurrentPage] = useState(0);
//   const [dataVersion, setDataVersion] = useState(0); // Add version to force re-render

//   const formatDuration = (totalSeconds) => {
//     const h = Math.floor(totalSeconds / 3600);
//     const m = Math.floor((totalSeconds % 3600) / 60);
//     const s = Math.floor(totalSeconds % 60);
//     return `${h}h ${m}m ${s}s`;
//   };

//  const formatLabelParts = (dateTime, durationSec = null) => {
//   try {
//     if (!dateTime) return { label1: "", label2: "" };
//     const utcDate = dayjs.utc(dateTime); // Parse as UTC
//     if (!utcDate.isValid()) return { label1: "", label2: "" };

//     const timeLabel = utcDate.format("HH:mm");
//     const dateLabel = utcDate.format("DD/MM");

//     return {
//       label1: `${timeLabel} ${dateLabel}`,
//       label2: durationSec !== null ? `Dur: ${formatDuration(durationSec)}` : ""
//     };
//   } catch (e) {
//     console.error("Error formatting label:", e);
//     return { label1: "", label2: "" };
//   }
// };


//   const fetchMovementData = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const params = buildDateParams(gfrid, fromDate, toDate, range);
//       const response = await axios.get(`${BASE_URL}/api/movement-duration/`, {
//         params,
//         timeout: 10000
//       });

//       if (response.data?.movements?.length > 500) {
//         setError("Large dataset detected. Showing limited data points.");
//       }

//       setMovementData(response.data?.movements || []);
//       setCurrentPage(0);
//       setDataVersion(prev => prev + 1); // Force re-render
//     } catch (err) {
//       console.error("API Error:", err);
//       setError("Failed to load movement data");
//       setMovementData([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchMovementData();
//   }, [gfrid, fromDate, toDate, range]);

//   const safeDownsample = (data, maxPoints) => {
//     try {
//       if (!Array.isArray(data)) return [];
//       if (data.length <= maxPoints) return data;
      
//       const step = Math.max(1, Math.floor(data.length / maxPoints));
//       const result = [];
      
//       for (let i = 0; i < data.length; i += step) {
//         if (i < data.length && data[i]) {
//           result.push(data[i]);
//         }
//         if (result.length >= maxPoints) break;
//       }
      
//       return result;
//     } catch (error) {
//       console.error("Downsampling error:", error);
//       return [];
//     }
//   };

//   const totalPages = useMemo(() => {
//     if (!Array.isArray(movementData) || movementData.length === 0) return 1;
//     return Math.max(1, Math.ceil(movementData.length / MAX_DATA_POINTS));
//   }, [movementData]);

//   const paginatedData = useMemo(() => {
//     try {
//       if (!Array.isArray(movementData) || movementData.length === 0) return [];
      
//       const start = Math.min(currentPage * MAX_DATA_POINTS, movementData.length - 1);
//       const end = Math.min(start + MAX_DATA_POINTS, movementData.length);
      
//       return movementData.slice(start, end);
//     } catch (error) {
//       console.error("Pagination error:", error);
//       return [];
//     }
//   }, [movementData, currentPage, dataVersion]);

//   const grouped = useMemo(() => {
//     const groups = {};
//    if (!Array.isArray(paginatedData)) return groups;

//     for (const item of paginatedData) {
//       if (!item) continue;
      
//       try {
//         const label = item.movement || `alert_${item.alertNotify_id || "unknown"}`;
//         if (!groups[label]) {
//           groups[label] = [];
//         }
//         groups[label].push(item);
//       } catch (error) {
//         console.error("Grouping error:", error);
//       }
//     }

//     return groups;
//   }, [paginatedData]);

//   const buildStatusChartData = (data) => {
//     const labels = [];
//     const values = [];
//     const customLabels = [];

//     const sampledData = safeDownsample(data, MAX_DATA_POINTS / 4);
    
//     for (const item of sampledData) {
//       try {
//         if (!item?.start_time || !item?.end_time) continue;

//         const duration = (new Date(item.end_time) - new Date(item.start_time)) / 1000;
//         const startLabel = formatLabelParts(item.start_time);
//         const endLabel = formatLabelParts(item.end_time, duration);

//         labels.push("", "", "", "");  // replaces internal X-axis labels with blank


//         values.push(0, 1, 1, 0);
//         customLabels.push(startLabel, startLabel, endLabel, endLabel);
//       } catch (error) {
//         console.error("Chart data processing error:", error);
//       }
//     }

//     return {
//       chartData: {
//         labels,
//         datasets: [{ data: values }]
//       },
//       customLabels
//     };
//   };

//   const buildHourlyChartData = (data) => {
//     const hourMap = {};
//     const sampledData = safeDownsample(data, MAX_DATA_POINTS);

//     for (const item of sampledData) {
//       try {
//         if (!item?.start_time || !item?.end_time) continue;

//         let current = new Date(item.start_time);
//         const end = new Date(item.end_time);

//         while (current < end) {
//           const hour = `${current.getHours().toString().padStart(2, "0")}:00`;
//           const nextHour = new Date(current);
//           nextHour.setHours(current.getHours() + 1, 0, 0, 0);
//           const segmentEnd = new Date(Math.min(end, nextHour));
//           const duration = (segmentEnd - current) / 1000;

//           hourMap[hour] = (hourMap[hour] || 0) + duration;
//           current = segmentEnd;
//         }
//       } catch (error) {
//         console.error("Hourly chart processing error:", error);
//       }
//     }

//     const hours = Object.keys(hourMap).sort();
//     return {
//       chartData: {
//         labels: hours,
//         datasets: [{
//           data: hours.map(h => parseFloat((hourMap[h] / 3600).toFixed(2)))
//         }]
//       },
//       customLabels: hours.map(h => ({
//         label1: h,
//         label2: `Dur: ${formatDuration(hourMap[h])}`
//       }))
//     };
//   };

//   const handlePageChange = (newPage) => {
//     try {
//       if (newPage >= 0 && newPage < totalPages) {
//         setCurrentPage(newPage);
//         setDataVersion(prev => prev + 1); // Force re-render
//       }
//     } catch (error) {
//       console.error("Page change error:", error);
//     }
//   };

//   if (loading) {
//     return (
//       <View style={styles.centerContainer}>
//         <ActivityIndicator size="large" />
//       </View>
//     );
//   }

//   if (error) {
//     return (
//       <View style={styles.centerContainer}>
//         <Text style={styles.errorText}>{error}</Text>
//         <TouchableOpacity onPress={fetchMovementData} style={styles.retryButton}>
//           <Text style={styles.retryText}>Retry</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   if (!movementData.length) {
//     return (
//       <View style={styles.centerContainer}>
//            <Image
//         source={require("../assets/nodata.jpg")} // 👈 path based on your folder structure
//         style={{ width: 200, height: 200, marginBottom: 20 }}
//         resizeMode="contain"
//       />
//       <Ionicons name="alert-circle-outline" size={36} color={theme.textSecondary} />
//       <Text style={styles.noDataText}>No data available for the selected period</Text>
//       </View>
//     );
//   }

//  return (
//   <View style={styles.container}>
//     <View style={styles.tabContainer}>
//       {["status", "analysis"].map((t) => (
//         <TouchableOpacity
//           key={t}
//           onPress={() => setTab(t)}
//           style={[styles.tabButton, tab === t && styles.activeTabButton]}
//         >
//           <Ionicons
//             name={t === "status" ? "pulse-outline" : "analytics-outline"}
//             size={16}
//             color={tab === t ? "#fff" : "#333"}
//             style={styles.tabIcon}
//           />
//           <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
//             {t.toUpperCase()}
//           </Text>
//         </TouchableOpacity>
//       ))}
//     </View>

//     <ScrollView key={`scroll-view-${dataVersion}`} style={{ flex: 1 }}>
//       {Object.entries(grouped).map(([label, data]) => {
//         if (!data?.length) return null;

//         const { chartData, customLabels } = tab === "status"
//           ? buildStatusChartData(data)
//           : buildHourlyChartData(data);

//         if (!chartData?.labels?.length) {
//           return (
//             <View key={`${label}-empty`} style={styles.chartContainer}>
//               <Text style={styles.chartTitle}>{label.toUpperCase()} {tab.toUpperCase()}</Text>
//               <Text style={styles.noDataText}>Not enough data to display chart</Text>
//             </View>
//           );
//         }

//         const chartWidth = Math.max(screenWidth, chartData.labels.length * LABEL_WIDTH);

//         return (
//           <View key={`${label}-${dataVersion}`} style={styles.chartContainer}>
//             <Text style={styles.chartTitle}>
//               {label.toUpperCase()} {tab.toUpperCase()}
//             </Text>

//             <ScrollView horizontal>
//               <View>
//                 <LineChart
//                   data={chartData}
//                   width={chartWidth}
//                   height={220}
//                   yAxisSuffix={tab === "analysis" ? "h" : ""}
//                   chartConfig={{
//                     backgroundGradientFrom: "#fff",
//                     backgroundGradientTo: "#fff",
//                     decimalPlaces: tab === "analysis" ? 2 : 0,
//                     color: () => "#399e9e",
//                     labelColor: () => "#000",
//                     propsForDots: {
//                       r: "3",
//                       strokeWidth: "2",
//                       stroke: "#399e9e",
//                     },
//                   }}
//                   bezier={tab === "analysis"}
//                   fromZero
//                   withDots={chartData.labels.length < 50}
//                   style={styles.chartStyle}
//                 />

//                 {customLabels?.length > 0 && (
//                   <ScrollView
//                     horizontal
//                     style={[styles.labelContainer, { width: chartWidth }]}
//                     contentContainerStyle={styles.labelContent}
//                   >
//                     {customLabels.map(({ label1, label2 }, idx) => (
//                       <View key={`label-${idx}-${dataVersion}`} style={styles.labelItem}>
//                         <Text style={styles.labelText}>{label1}</Text>
//                         <Text style={styles.durationText}>{label2}</Text>
//                       </View>
//                     ))}
//                   </ScrollView>
//                 )}
//               </View>
//             </ScrollView>
//           </View>
//         );
//       })}
//     </ScrollView>

//     {/* ✅ PAGINATION OUTSIDE SCROLLVIEW */}
//     {totalPages > 1 && (
//       <View style={styles.paginationContainer}>
//         <TouchableOpacity
//           onPress={() => handlePageChange(currentPage - 1)}
//           disabled={currentPage === 0}
//           style={[styles.paginationButton, currentPage === 0 && { opacity: 0.5 }]}
//         >
//           <Ionicons name="chevron-back" size={24} color="#399e9e" />
//         </TouchableOpacity>
//         <Text style={styles.pageText}>
//           Page {currentPage + 1} of {totalPages}
//         </Text>
//         <TouchableOpacity
//           onPress={() => handlePageChange(currentPage + 1)}
//           disabled={currentPage === totalPages - 1}
//           style={[styles.paginationButton, currentPage === totalPages - 1 && { opacity: 0.5 }]}
//         >
//           <Ionicons name="chevron-forward" size={24} color="#399e9e" />
//         </TouchableOpacity>
//       </View>
//     )}
//   </View>
// );

// };

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: "#f8f9fa" },
//   centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
//   errorText: { color: "#dc3545", fontSize: 16, marginBottom: 10, textAlign: "center" },
//   noDataText: { color: "#6c757d", fontSize: 16, textAlign: "center" },
//   retryButton: { marginTop: 10, padding: 10, backgroundColor: "#007bff", borderRadius: 5 },
//   retryText: { color: "#fff", fontWeight: "bold" },
//   tabContainer: { flexDirection: "row", justifyContent: "center", marginVertical: 10 },
//   tabButton: {
//     flexDirection: "row",
//     alignItems: "center",
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     marginHorizontal: 5,
//     borderRadius: 20,
//     backgroundColor: "#e9ecef"
//   },
//   activeTabButton: { backgroundColor: "#399e9e" },
//   tabIcon: { marginRight: 5 },
//   tabText: { fontWeight: "bold", color: "#495057" },
//   activeTabText: { color: "#fff" },
//   chartContainer: { marginBottom: 30, paddingHorizontal: 10 },
//   chartTitle: { fontWeight: "bold", fontSize: 16, textAlign: "center", marginBottom: 8, color: "#212529" },
//   chartStyle: { borderRadius: 8, marginBottom: 5 },
//   labelContainer: { marginTop: 6 },
//   labelContent: { flexDirection: "row" },
//   labelItem: { width: LABEL_WIDTH, alignItems: "center" },
//   labelText: { fontSize: 10, fontWeight: "600", color: "#333", textAlign: "center" },
//   durationText: { fontSize: 9, color: "#6c757d", textAlign: "center" },
//   paginationContainer: {
//   flexDirection: "row",
//   justifyContent: "center",
//   alignItems: "center",
//   paddingVertical: 10,
//   backgroundColor: "#f1f3f5"
// },
// paginationButton: {
//   marginHorizontal: 10
// },
// pageText: {
//   fontSize: 14,
//   color: "#333"
// }

// });

// export default MovementAnalysisGraph;
















