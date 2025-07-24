import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useNavigation } from "@react-navigation/native";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as Animatable from "react-native-animatable";
import MachineStatusGraph from "../components/MachineStatusGraph";
import MovementAnalysisGraph from "../components/MovementAnalysisGraph";
import CumulativeAnalysisGraph from "../components/CumulativeAnalysisGraph";
import { logPageVisit } from '../api/LogsApi';
import { BASE_URL } from "../config";

const Tab = createMaterialTopTabNavigator();
dayjs.extend(utc);
dayjs.extend(timezone);

const theme = {
  primary: "#4a6da7",
  secondary: "#a8c6fa",
  accent: "#ff6b6b",
  background: "#f8f9fa",
  cardBg: "#ffffff",
  textPrimary: "#2d3748",
  textSecondary: "#4a5568",
  success: "#48bb78",
  warning: "#ed8936",
  danger: "#f56565",
  info: "#4299e1",
};

const MachineDetail = ({ route }) => {
  const navigation = useNavigation();
  const gfrid = route?.params?.gfrid;
  const initialFrom = route?.params?.fromDate ? new Date(route.params.fromDate) : null;
  const initialTo = route?.params?.toDate ? new Date(route.params.toDate) : null;
  const initialRange = route?.params?.range || (initialFrom && initialTo ? null : "1h");

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [range, setRange] = useState(initialRange);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const prevGfridRef = useRef(null);
  const prevRangeRef = useRef(null);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Handle range button logic
  useEffect(() => {
    if (range === "1h" || range === "1d") {
      const now = new Date();
      const deltaHours = range === "1h" ? 1 : 24;
      const newFromDate = new Date(now.getTime() - deltaHours * 60 * 60 * 1000);
      setFromDate(newFromDate);
      setToDate(now);
    }
  }, [range, refreshKey]);

  const handleFromConfirm = (date) => {
    setFromDate(date);
    setShowFromPicker(false);
    setShowToPicker(true);
  };

  const handleToConfirm = (date) => {
    setToDate(date);
    setShowToPicker(false);
    setRange(null);
  };

  // Log visit only when gfrid or range changes
  useEffect(() => {
    const prevGfrid = prevGfridRef.current;
    const prevRange = prevRangeRef.current;

    const shouldLog =
      (gfrid !== prevGfrid || range !== prevRange) &&
      gfrid &&
      fromDate &&
      toDate;

    if (shouldLog) {
      logPageVisit("MachineDetail", {
        gfrid,
        from: dayjs(fromDate).format("D MMM YYYY, hh:mm A"),
        to: dayjs(toDate).format("D MMM YYYY, hh:mm A"),
        range: range || "custom",
      }).catch((err) => {
        console.error("Visit log failed:", err.message);
      });

      prevGfridRef.current = gfrid;
      prevRangeRef.current = range;
    }
  }, [gfrid, range, fromDate, toDate]);

  const formatDate = (date) =>
    date ? dayjs(date).format("DD MMM YYYY, hh:mm A") : "Not set";

  const rangeOptions = ["1h", "1d", "Custom"];



  return (
    <View style={styles.container}>
      <Animatable.View animation="fadeInDown" duration={1000} style={styles.header}>
        <Text style={styles.title}>
          <Ionicons name="hardware-chip-outline" size={22} color="#fff" /> Machine GFRID: {gfrid}
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </Animatable.View>

      <View style={styles.rangeContainer}>
        {rangeOptions.map((option, index) => (
          <Animatable.View animation="bounceIn" duration={700} delay={index * 150} key={option}>
            <TouchableOpacity
              style={[styles.rangeButton, (range === option || (!range && option === "Custom")) && styles.rangeButtonActive]}
              onPress={() => {
                if (option === "Custom") {
                  setRange(null);
                  setFromDate(null);
                  setToDate(null);
                  setShowFromPicker(true);
                } else {
                  setRange(option);
                  handleRefresh();
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={option === "Custom" ? "calendar-outline" : "time-outline"}
                size={16}
                color={(range === option || (!range && option === "Custom")) ? "#fff" : "#213957"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.rangeButtonText, (range === option || (!range && option === "Custom")) && styles.rangeButtonTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        ))}
      </View>

      <Animatable.View animation="fadeIn" duration={800} style={styles.debugCard}>
        <Text style={styles.debugTitle}>
          <Ionicons name="swap-vertical" size={20} color="#1F2937" /> Selected Time Range
        </Text>
        <View style={styles.debugRow}>
          <Text style={styles.debugText}>From:</Text>
          <Text style={styles.debugValue}>{formatDate(fromDate)}</Text>
        </View>
        <View style={styles.debugRow}>
          <Text style={styles.debugText}>To:</Text>
          <Text style={styles.debugValue}>{formatDate(toDate)}</Text>
        </View>
      </Animatable.View>

      {fromDate && toDate && (
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            screenOptions={{
              swipeEnabled: false,
              tabBarLabelStyle: {
                fontWeight: "bold",
                fontSize: 14,
                textTransform: "uppercase",
              },
              tabBarStyle: {
                backgroundColor: "#77aec9",
                // borderRadius: 12,
                borderTopLeftRadius:36,
                borderTopRightRadius:36
              },
              tabBarActiveTintColor: "#000000",
              tabBarInactiveTintColor: "#191a5c",
              tabBarIndicatorStyle: {
                backgroundColor: "#000000",
                height: 5,
                borderRadius: 5,
              },
            }}
          >
            <Tab.Screen name="Status">
              {() => (
                <MachineStatusGraph
                  key={refreshKey}
                  gfrid={gfrid}
                  fromDate={fromDate}
                  toDate={toDate}
                  range={range}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Movement">
              {() => (
                <MovementAnalysisGraph
                  key={refreshKey}
                  gfrid={gfrid}
                  fromDate={fromDate}
                  toDate={toDate}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Cumulative">
              {() => (
                <CumulativeAnalysisGraph
                  key={refreshKey}
                  gfrid={gfrid}
                  fromDate={fromDate}
                  toDate={toDate}
                  range={range}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </View>
      )}

      <DateTimePickerModal
        isVisible={showFromPicker}
        mode="datetime"
        is24Hour
        onConfirm={handleFromConfirm}
        onCancel={() => setShowFromPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showToPicker}
        mode="datetime"
        is24Hour
        minimumDate={fromDate || new Date()}
        onConfirm={handleToConfirm}
        onCancel={() => setShowToPicker(false)}
      />

      <GfridScroller currentGfrid={gfrid} fromDate={fromDate} toDate={toDate} range={range} />
    </View>
  );
};

const GfridScroller = ({ currentGfrid, fromDate, toDate, range }) => {
  const [gfrids, setGfrids] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetch(`${BASE_URL}/api/machines/`)
      .then((res) => res.json())
      .then((data) => setGfrids(data))
      .catch((err) => console.error("GFRID Fetch Error", err));
  }, []);

  const goToMachine = (gfrid) => {
    if (gfrid === currentGfrid) return;
    navigation.replace("MachineDetail", {
      gfrid,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      range,
    });
  };

  return (
    <View style={styles.gfridContainer}>
      <Text style={styles.gfridTitle}>Available Machines</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gfridScrollContent}
      >
        {gfrids.map(({ gfrid }, index) => (
          <Animatable.View 
            animation="bounceIn" 
            duration={800} 
            delay={index * 100} 
            key={gfrid}
          >
            <TouchableOpacity
              onPress={() => goToMachine(gfrid)}
              style={[
                styles.gfridButton,
                gfrid === currentGfrid && styles.gfridButtonActive
              ]}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="hardware-chip-outline" 
                size={18} 
                color={gfrid === currentGfrid ? "#fff" : theme.primary} 
                style={styles.gfridIcon}
              />
              <Text style={[
                styles.gfridText,
                gfrid === currentGfrid && styles.gfridTextActive
              ]}>
                {gfrid}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  header: {
    backgroundColor: "#5279a8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 6,
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: "#E0E7FF",
    borderRadius: 24,
    marginHorizontal: 6,
    marginBottom: 6,
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  rangeButtonActive: {
    backgroundColor: "#213957",
    borderColor: "#213957",
  },
  rangeButtonText: {
    color: "#1F2937",
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: 14,
  },
  rangeButtonTextActive: { color: "#ffffff" },
  debugCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 3,
    padding: 5,
    borderRadius: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 5,
  },
  debugTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  debugText: { fontSize: 15, fontWeight: "600", color: "black" },
  debugValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
    maxWidth: "70%",
    textAlign: "right",
  },
  gfridContainer: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom:14
  },
  gfridTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  gfridScrollContent: {
    paddingHorizontal: 8,
  },
  gfridButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gfridButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  gfridIcon: {
    marginRight: 8,
  },
  gfridText: {
    fontWeight: "600",
    color: theme.textPrimary,
  },
  gfridTextActive: {
    color: "#fff",
  },
});

export default MachineDetail;












// import React, { useState, useEffect } from 'react';
// import { View, Text, StyleSheet } from 'react-native';
// import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

// import MachineStatusGraph from '../components/MachineStatusGraph';
// import HourlyUsageGraph from '../components/HourlyUsageGraph';
// import MovementAnalysisGraph from '../components/MovementAnalysisGraph';
// import CumulativeAnalysisGraph from '../components/CumulativeAnalysisGraph';

// const Tab = createMaterialTopTabNavigator();
// const MachineDetailTabs = ({ gfrid, range }) => {
//   return (
//     <Tab.Navigator
//       screenOptions={{
//         swipeEnabled: false, // ⛔ disables swipe between tabs
//         tabBarScrollEnabled: false,
//         tabBarIndicatorStyle: { backgroundColor: '#2196F3' },
//         tabBarStyle: { backgroundColor: '#f0f0f0' },
//       }}
//     >
//       <Tab.Screen name="Status">
//         {() => <MachineStatusGraph gfrid={gfrid} range={range} />}
//       </Tab.Screen>
//       <Tab.Screen name="Usage">
//         {() => <HourlyUsageGraph gfrid={gfrid} range={range} />}
//       </Tab.Screen>
//       <Tab.Screen name="Movement">
//         {() => <MovementAnalysisGraph gfrid={gfrid} range={range} />}
//       </Tab.Screen>
//       <Tab.Screen name="Cumulative">
//         {() => <CumulativeAnalysisGraph gfrid={gfrid} range={range} />}
//       </Tab.Screen>
//     </Tab.Navigator>
//   );
// };

// const MachineDetail = ({ route }) => {
//   const gfrid = route?.params?.gfrid;
//   const [range, setRange] = useState('1d');

//   useEffect(() => {
//     console.log('Route Params:', route?.params); // Debug: check if gfrid is passed
//   }, []);

//   if (!gfrid) {
//     return (
//       <View style={styles.errorContainer}>
//         <Text style={styles.errorText}>Error: GFRID not provided.</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={{ flex: 1 }}>
//       <Text style={styles.title}>Machine GFRID: {gfrid}</Text>

//       <View style={styles.rangeContainer}>
//         {['1h', '1d', '1w', '1m'].map((r) => (
//           <Text
//             key={r}
//             style={[
//               styles.rangeButton,
//               range === r && styles.selectedRangeButton,
//             ]}
//             onPress={() => setRange(r)}
//           >
//             {r.toUpperCase()}
//           </Text>
//         ))}
//       </View>

//       <MachineDetailTabs gfrid={gfrid} range={range} />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   title: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     padding: 12,
//     textAlign: 'center',
//   },
//   rangeContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     marginBottom: 10,
//     paddingHorizontal: 10,
//   },
//   rangeButton: {
//     padding: 8,
//     backgroundColor: '#e0e0e0',
//     borderRadius: 6,
//     fontWeight: 'bold',
//     color: '#000',
//   },
//   selectedRangeButton: {
//     backgroundColor: '#2196F3',
//     color: 'white',
//   },
//   errorContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   errorText: {
//     color: 'red',
//     fontSize: 16,
//   },
// });

// export default MachineDetail;












// import React, { useState, useEffect } from "react";
// import { View, Text, Button, StyleSheet } from "react-native";
// import DateTimePickerModal from "react-native-modal-datetime-picker";
// import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
// import dayjs from "dayjs";
// import utc from "dayjs/plugin/utc";
// import timezone from "dayjs/plugin/timezone";
// import MachineStatusGraph from "../components/MachineStatusGraph";
// import MovementAnalysisGraph from "../components/MovementAnalysisGraph";
// import CumulativeAnalysisGraph from "../components/CumulativeAnalysisGraph";


// dayjs.extend(utc);
// dayjs.extend(timezone);

// const Tab = createMaterialTopTabNavigator();

// // Temporary placeholder components
// const PlaceholderGraph = ({ title }) => (
//   <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//     <Text>{title} Graph Placeholder</Text>
//     <Text>Component will be displayed here</Text>
//   </View>
// );

// const MachineDetail = ({ route }) => {
//   const gfrid = route?.params?.gfrid;
//   const [fromDate, setFromDate] = useState(null);
//   const [toDate, setToDate] = useState(null);
//   const [range, setRange] = useState("1h");

//   const [showFromPicker, setShowFromPicker] = useState(false);
//   const [showToPicker, setShowToPicker] = useState(false);

//   const tz = "Asia/Kolkata";

//   useEffect(() => {
//     if (!range && fromDate && toDate) {
//       const payload = {
//         gfrid,
//         from_date: dayjs(fromDate).tz(tz).format(),
//         to_date: dayjs(toDate).tz(tz).format(),
//         range: null,
//       };
//       console.log("📌 Sending Final API params:", JSON.stringify(payload));
//     }
//   }, [fromDate, toDate, range]);

//   const handleFromConfirm = (date) => {
//     const localDate = dayjs(date).tz(tz).toDate();
//     setFromDate(localDate);
//     console.log("✅ FromDate selected (Asia/Kolkata):", dayjs(localDate).format());
//     setShowFromPicker(false);
//     setShowToPicker(true);
//   };

//   const handleToConfirm = (date) => {
//     const localDate = dayjs(date).tz(tz).toDate();
//     setToDate(localDate);
//     console.log("✅ ToDate selected (Asia/Kolkata):", dayjs(localDate).format());
//     setShowToPicker(false);
//   };

//   const formatDate = (date) =>
//     date ? dayjs(date).tz(tz).format("YYYY-MM-DDTHH:mm:ssZ") : "Not set";

//   const defaultToDate = fromDate
//     ? dayjs(fromDate).add(1, "hour").toDate()
//     : new Date();

//   return (
//     <View style={{ flex: 1 }}>
//       <Text style={styles.title}>Machine GFRID: {gfrid}</Text>

//       <View style={styles.rangeContainer}>
//         <Button
//           title="1H"
//           onPress={() => {
//             setRange("1h");
//             setFromDate(null);
//             setToDate(null);
//             console.log("📌 Sending API params:", JSON.stringify({
//               from_date: null,
//               to_date: null,
//               gfrid,
//               range: "1h",
//             }));
//           }}
//         />
//         <Button
//           title="1D"
//           onPress={() => {
//             setRange("1d");
//             setFromDate(null);
//             setToDate(null);
//             console.log("📌 Sending API params:", JSON.stringify({
//               from_date: null,
//               to_date: null,
//               gfrid,
//               range: "1d",
//             }));
//           }}
//         />
//         <Button
//           title="Custom"
//           onPress={() => {
//             setRange(null);
//             setFromDate(null);
//             setToDate(null);
//             setShowFromPicker(true);
//           }}
//         />
//       </View>

//       <Text style={styles.debugText}>FromDate: {formatDate(fromDate)}</Text>
//       <Text style={styles.debugText}>ToDate: {formatDate(toDate)}</Text>

//   {(range || (fromDate && toDate)) && (
//   <Tab.Navigator>
//     <Tab.Screen name="Status">
//       {() => (
//         <MachineStatusGraph gfrid={gfrid} fromDate={fromDate} toDate={toDate} range={range} />
//       )}
//     </Tab.Screen>
//     <Tab.Screen name="Movement">
//       {() => (
//         <MovementAnalysisGraph gfrid={gfrid} fromDate={fromDate} toDate={toDate} range={range} />
//       )}
//     </Tab.Screen>
//     <Tab.Screen name="Cumulative">
//       {() => (
//         <CumulativeAnalysisGraph gfrid={gfrid} fromDate={fromDate} toDate={toDate} range={range} />
//       )}
//     </Tab.Screen>
//   </Tab.Navigator>
// )}


//       <DateTimePickerModal
//         isVisible={showFromPicker}
//         mode="datetime"
//         is24Hour
//         onConfirm={handleFromConfirm}
//         onCancel={() => setShowFromPicker(false)}
//       />

//       <DateTimePickerModal
//         isVisible={showToPicker}
//         mode="datetime"
//         is24Hour
//         date={toDate || defaultToDate}
//         minimumDate={fromDate || new Date()}
//         onConfirm={handleToConfirm}
//         onCancel={() => setShowToPicker(false)}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   title: {
//     fontSize: 20,
//     fontWeight: "bold",
//     padding: 12,
//     textAlign: "center",
//   },
//   rangeContainer: {
//     flexDirection: "row",
//     justifyContent: "space-around",
//     marginBottom: 10,
//   },
//   debugText: {
//     textAlign: "center",
//     fontSize: 12,
//     color: "#888",
//   },
// });

// export default MachineDetail;
