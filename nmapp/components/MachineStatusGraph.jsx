import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';
import dayjs from 'dayjs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const theme = {
  primary: "#4a6da7",
  secondary: "#a8c6fa",
  success: "#4dc429",
  danger: "#dc3545",
  warning: "black",
  info: "#17a2b8",
  light: "#f8f9fa",
  dark: "#343a40",
  background: "#f5f7fa",
  cardBackground: "#ffffff",
  textPrimary: "#212529",
  textSecondary: "#6c757d",
};

import { BASE_URL } from '../config';

const MAX_POINTS_PER_PAGE = 50;
const pointWidth = 60;

const MachineStatusGraph = ({ gfrid, fromDate, toDate, range }) => {
  const [statusData, setStatusData] = useState([]);
  const [statusDetails, setStatusDetails] = useState({ onTime: 0, offTime: 0 });
  const [usageData, setUsageData] = useState({ labels: [], values: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        gfrid,
        from_date: dayjs(fromDate).utc().toISOString(),
        to_date: dayjs(toDate).utc().toISOString(),
        range: range || '1h',
      };

      const res = await axios.get(`${BASE_URL}/api/machine-status/`, { params });
      const { on_time_sec, off_time_sec, status_records } = res.data;
      const pulsePoints = [];
      const hourlyUsage = {};

      (status_records || []).forEach(({ start_time, end_time, status }) => {
        const start = dayjs(start_time);
        const end = dayjs(end_time);
        const safeStatus = status === 1 ? 1 : 0;

        pulsePoints.push({
          label1: start.format('HH:mm'),
          label2: start.format('DD/MM'),
          value: safeStatus,
        });
        pulsePoints.push({
          label1: end.format('HH:mm'),
          label2: end.format('DD/MM'),
          value: safeStatus,
        });

        if (safeStatus === 1) {
          let current = start;
          while (current.isBefore(end)) {
            const hourKey = `${current.hour().toString().padStart(2, '0')}:00`;
            const nextHour = current.startOf('hour').add(1, 'hour');
            const segEnd = end.isBefore(nextHour) ? end : nextHour;
            const durationMin = Math.max(segEnd.diff(current, 'second') / 60, 0);
            hourlyUsage[hourKey] = (hourlyUsage[hourKey] || 0) + durationMin;
            current = segEnd;
          }
        }
      });

      setStatusData(pulsePoints);
      setStatusDetails({ onTime: on_time_sec, offTime: off_time_sec });

      const fullLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
      const fullValues = fullLabels.map((label) =>
        parseFloat((hourlyUsage[label] || 0).toFixed(2))
      );

      setUsageData({ labels: fullLabels, values: fullValues });
    } catch (err) {
      console.error('Fetch error', err);
      setStatusData([]);
      setUsageData({ labels: [], values: [] });
      setStatusDetails({ onTime: 0, offTime: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [gfrid, fromDate, toDate, range]);

  const totalPages = Math.ceil(statusData.length / MAX_POINTS_PER_PAGE);
  const currentData = statusData.slice(page * MAX_POINTS_PER_PAGE, (page + 1) * MAX_POINTS_PER_PAGE);
  const chartValues = currentData.map((pt) => pt.value);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth, currentData.length * pointWidth);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#4a6da7" />;

  return (
    <ScrollView style={styles.container}>
      {/* Enhanced Runtime Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="time-outline" size={24} color="#fff" />
          <Text style={styles.summaryHeaderText}>Machine Runtime Summary</Text>
        </View>
        <View style={styles.summaryContent}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="toggle-switch-outline" size={24} color="green" />

              <Text style={styles.summaryLabel}>ON Time:</Text>
              <Text style={styles.summaryValue}>{formatTime(statusDetails.onTime)}</Text>
            </View>
            <View style={styles.summaryItem}>
             <MaterialCommunityIcons name="toggle-switch-off-outline" size={24} color="red" />
              <Text style={styles.summaryLabel}>OFF Time:</Text>
              <Text style={styles.summaryValue}>{formatTime(statusDetails.offTime)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Machine Status Graph in Card */}
      <View style={styles.graphCard}>
        <Text style={styles.chartTitle}>Machine Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {/* Y-Axis Labels */}
            <View style={styles.yAxisLabels}>
              <Text style={styles.yAxisLabelText}>ON</Text>
              <Text style={styles.yAxisLabelText}>OFF</Text>
            </View>

            {/* Chart */}
            <View>
              <LineChart
                data={{
                  labels: [],
                  datasets: [{ data: chartValues.length > 0 ? chartValues : [0] }],
                }}
                width={chartWidth}
                height={240}
                fromZero
                withDots={true}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={false}
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  color: () => '#0f172a',
                  labelColor: () => 'black',
                  decimalPlaces: 0,
                }}
                style={{ paddingRight: 0, paddingLeft: 0, marginBottom: 0 }}
              />

              <View style={[styles.labelContainer, { width: chartWidth }]}>
                {currentData.length > 0 ? currentData.map(({ label1, label2 }, idx) => (
                  <View key={idx} style={styles.labelItem}>
                    <Text style={styles.labelText}>{label1}</Text>
                    <Text style={styles.labelSubText}>{label2}</Text>
                  </View>
                )) : (
                  <View style={styles.labelItem}>
                    <Text style={styles.labelText}>--:--</Text>
                    <Text style={styles.labelSubText}>N/A</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.paginationContainer}>
          <TouchableOpacity
            disabled={page === 0}
            onPress={() => setPage((prev) => Math.max(prev - 1, 0))}
          >
            <Ionicons name="chevron-back-circle" size={36} color={page === 0 ? '#ccc' : '#1E3A8A'} />
          </TouchableOpacity>

          <Text style={styles.pageText}>{`Page ${page + 1} of ${totalPages}`}</Text>

          <TouchableOpacity
            disabled={page === totalPages - 1}
            onPress={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
          >
            <Ionicons name="chevron-forward-circle" size={36} color={page === totalPages - 1 ? '#ccc' : '#1E3A8A'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hourly Usage Graph in Card */}
      <View style={styles.graphCard}>
        <Text style={styles.chartTitle}>Hourly Usage</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{
              labels: usageData.labels,
              datasets: [{ data: usageData.values }],
            }}
            width={Math.max(screenWidth, usageData.labels.length * 50)}
            height={300}
            fromZero
            bezier
            yAxisSuffix="m"
            chartConfig={{
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 1,
              color: () => '#ff6b6b',
              labelColor: () => '#000',
            }}
          />
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 6,
  },
  summaryCard: {
    backgroundColor: '#4a6da7',
    borderRadius: 12,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    padding:16
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#3a5a8f',
  },
  summaryHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  summaryContent: {
    padding: 6,
  },
  sumaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  summaryLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 10,
    width: 90,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  graphCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    textAlign: 'center',
    marginBottom: 3,
  },
  yAxisLabels: {
    width: 40,
    height: 200,
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginRight:5,
    
    
  },
  yAxisLabelText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'right',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    // marginTop: 4,
    // marginBottom: 1,
  },
  labelItem: {
    width: 60,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
  },
  labelSubText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    gap: 16,
  },
  pageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
  },
});

export default MachineStatusGraph;

















// import React, { useEffect, useState } from 'react';
// import {
//   Text,
//   Dimensions,
//   ActivityIndicator,
//   ScrollView,
//   View,
//   StyleSheet
// } from 'react-native';
// import axios from 'axios';
// import { LineChart } from 'react-native-chart-kit';
// import dayjs from 'dayjs';
// import { buildDateParams } from '../utils/dateUtils';
// import Ionicons from 'react-native-vector-icons/Ionicons';

// const BASE_URL = 'http://192.168.1.5:8000';

// const theme = {
//   primary: "#4a6da7",
//   secondary: "#a8c6fa",
//   success: "#4dc429",
//   danger: "#dc3545",
//   warning: "black",
//   info: "#17a2b8",
//   light: "#f8f9fa",
//   dark: "#343a40",
//   background: "#f5f7fa",
//   cardBackground: "#ffffff",
//   textPrimary: "#212529",
//   textSecondary: "#6c757d",
// };

// const MachineStatusGraph = ({ gfrid, fromDate, toDate, range }) => {
//   const [statusPoints, setStatusPoints] = useState({ labels: [], values: [] });
//   const [usageData, setUsageData] = useState({ labels: [], values: [] });
//   const [loading, setLoading] = useState(true);
//   const [statusDetails, setStatusDetails] = useState({ onTime: 0, offTime: 0 });

//   const formatSecondsToHHMMSS = (totalSeconds) => {
//     const hours = Math.floor(totalSeconds / 3600);
//     const minutes = Math.floor((totalSeconds % 3600) / 60);
//     const seconds = totalSeconds % 60;
//     return [hours, minutes, seconds].map((v) => v.toString().padStart(2, '0')).join(':');
//   };

//   const sanitizeValues = (arr) =>
//     Array.isArray(arr)
//       ? arr.map(v => (typeof v === 'number' && isFinite(v) ? v : 0))
//       : [];

//   const isSafe = (arr) =>
//     Array.isArray(arr) &&
//     arr.length > 0 &&
//     arr.every(v => typeof v === 'number' && isFinite(v));

//   const fetchData = async () => {
//     try {
//       setLoading(true);
//       const params = buildDateParams(gfrid, fromDate, toDate, range);
//       const res = await axios.get(`${BASE_URL}/api/machine-status/`, { params });
//       const { on_time_sec, off_time_sec, status_records } = res.data;

//       setStatusDetails({
//         onTime: on_time_sec,
//         offTime: off_time_sec
//       });

//       const pulseLabels = [];
//       const pulseValues = [];
//       const hourlyUsage = {};

//       (status_records || []).forEach(({ start_time, end_time, status }) => {
//         const start = dayjs(start_time);
//         const end = dayjs(end_time);
//         const format = (d) => dayjs(d).format('HH:mm:ss');

//         pulseLabels.push(format(start));
//         pulseValues.push(+status || 0);
//         pulseLabels.push(format(end));
//         pulseValues.push(+status || 0);

//         if (status === 1) {
//           let current = start;
//           while (current.isBefore(end)) {
//             const hourKey = `${current.hour().toString().padStart(2, '0')}:00`;
//             const nextHour = current.startOf('hour').add(1, 'hour');
//             const segEnd = end.isBefore(nextHour) ? end : nextHour;
//             const durationMin = Math.max(segEnd.diff(current, 'second') / 60, 0);
//             hourlyUsage[hourKey] = (hourlyUsage[hourKey] || 0) + durationMin;
//             current = segEnd;
//           }
//         }
//       });

//       setStatusPoints({
//         labels: pulseLabels,
//         values: sanitizeValues(pulseValues)
//       });

//       const fullLabels = Array.from({ length: 24 }, (_, i) =>
//         `${i.toString().padStart(2, '0')}:00`
//       );
//       const fullValues = fullLabels.map((label) =>
//         parseFloat((hourlyUsage[label] || 0).toFixed(2))
//       );

//       setUsageData({
//         labels: fullLabels,
//         values: sanitizeValues(fullValues)
//       });

//     } catch (err) {
//       console.error('❌ Fetch error', err);
//       setStatusPoints({ labels: ['00:00', '01:00'], values: [0, 0] });
//       setUsageData({ labels: ['00:00'], values: [0] });
//       setStatusDetails({ onTime: 0, offTime: 0 });
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, [gfrid, fromDate, toDate, range]);

//   if (loading) return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;

//   const statusWidth = Math.max((statusPoints.labels.length || 1) * 80, Dimensions.get('window').width);
//   const usageWidth = Math.max((usageData.labels.length || 1) * 50, Dimensions.get('window').width);

//   return (
//     <ScrollView style={styles.container}>
//       <View style={styles.summaryContainer}>
//         <Text style={styles.summaryHeader}>
//           <Ionicons name="time" size={24} color={theme.primary} /> Machine Runtime Summary
//         </Text>
//         <View style={styles.summaryRow}>
//           <Text style={styles.summaryLabel}>
//             <Ionicons name="toggle-sharp" size={16} color={theme.success} />
//              ON Time:
//           </Text>
//           <Text style={styles.summaryValue}>
//             {statusDetails.onTime} sec ({formatSecondsToHHMMSS(statusDetails.onTime)})
//           </Text>
//         </View>
//         <View style={styles.summaryRow}>
//           <Text style={styles.summaryLabel}>
//             <Ionicons name="toggle-sharp" size={16} color={theme.danger} /> 
//             OFF Time:
//           </Text>
//           <Text style={styles.summaryValue}>
//             {statusDetails.offTime} sec ({formatSecondsToHHMMSS(statusDetails.offTime)})
//           </Text>
//         </View>
//       </View>

//       {isSafe(statusPoints.values) && (
//         <>
//           <Text style={styles.chartTitle}>
//             <Ionicons name="pulse-outline" size={18} color={theme.info} /> Machine Status
//           </Text>
//           <ScrollView horizontal>
//             <LineChart
//               data={{
//                 labels: statusPoints.labels,
//                 datasets: [{ data: statusPoints.values }]
//               }}
//               width={statusWidth}
//               height={280}
//               fromZero
//               chartConfig={{
//                 backgroundGradientFrom: 'white',
//                 backgroundGradientTo: '#b8d9e3',
//                 decimalPlaces: 0,
//                 color: () => 'black',
//                 labelColor: () => '#333'
//               }}
//             />
//           </ScrollView>
//         </>
//       )}

//       <Text style={styles.chartTitle}>
//         <Ionicons name="analytics" size={18} color={theme.warning} /> Hourly Usage
//       </Text>
//       {isSafe(usageData.values) && (
//         <ScrollView horizontal>
//           <LineChart
//             data={{
//               labels: usageData.labels,
//               datasets: [{ data: usageData.values }]
//             }}
//             width={usageWidth}
//             height={300}
//             fromZero
//             bezier
//             yAxisSuffix="m"
//             chartConfig={{
//               backgroundGradientFrom: '#fff',
//               backgroundGradientTo: '#fff',
//               decimalPlaces: 1,
//               color: () => '#247782',
//               labelColor: () => '#000'
//             }}
//             renderDotContent={({ x, y, index, indexData }) => (
//               <Text
//                 key={`label-${index}`}
//                 style={{
//                   position: 'absolute',
//                   left: x - 10,
//                   top: y - 20,
//                   fontSize: 10,
//                   color: '#333',
//                   fontWeight: 'bold'
//                 }}
//               >
//                 {indexData}
//               </Text>
//             )}
//           />
//         </ScrollView>
//       )}
//     </ScrollView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     padding: 10,
//     backgroundColor: '#fff'
//   },
//   summaryContainer: {
//     paddingHorizontal: 15,
//     backgroundColor: '#f0fafa',
//     marginBottom: 5,
//     borderRadius: 16,
//     shadowColor: '#000',
//     shadowOpacity: 0.15,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 8,
//     elevation: 5,
//     marginHorizontal: 12
//   },
//   summaryHeader: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#444',
//     marginBottom: 10,
//     textAlign: 'center'
//   },
//   summaryRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 8
//   },
//   summaryLabel: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#555'
//   },
//   summaryValue: {
//     fontSize: 16,
//     color: '#111',
//     fontWeight: '500'
//   },
//   chartTitle: {
//     textAlign: 'center',
//     fontWeight: 'bold',
//     fontSize: 18,
//     marginVertical: 10,
//     color: '#111'
//   }
// });

// export default MachineStatusGraph;
