import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation } from '@react-navigation/native';
import { Easing } from 'react-native';
import CustomDonutChartWithLegend from '../components/CustomDonutChartWithLegend';
import { BASE_URL } from '../config';
import { recordVisit } from '../api/LogsApi';


const screenWidth = Dimensions.get('window').width;
const MAX_POINTS_PER_PAGE = 50;
const pointWidth = 60;

dayjs.extend(utc);
dayjs.extend(timezone);

const CustomBarChart = ({ data }) => {
  const barHeights = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = data.map((_, i) =>
      Animated.timing(barHeights[i], {
        toValue: data[i].value,
        duration: 600,
        delay: i * 120,
        useNativeDriver: false,
      })
    );
    Animated.stagger(100, animations).start();
  }, [data]);
  

  return (
    <ScrollView
      horizontal
      contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 10 }}
      showsHorizontalScrollIndicator={false}
    >
      {data.map((item, i) => (
        <View key={i} style={{ alignItems: 'center', marginHorizontal: 10 }}>
          <Animated.View
            style={{
              height: barHeights[i].interpolate({
                inputRange: [0, 100],
                outputRange: [0, 180],
              }),
            
            }}
          />
          <Text style={{ fontSize: 12, marginTop: 6, color: '#1F2937' }}>{item.label}</Text>
          <Text style={{ fontSize: 12, color: '#475569' }}>{item.value}%</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const InfoWrapper = () => {
  const [priorityUsage, setPriorityUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [machineData, setMachineData] = useState([]);
  const [range, setRange] = useState('1w');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [pageState, setPageState] = useState({});
  const chartAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  useEffect(() => {
  recordVisit("InfoWrapper", {
    range,
    fromDate: fromDate ? fromDate.toISOString() : null,
    toDate: toDate ? toDate.toISOString() : null,
  });
}, []);

  const checkAndRedirectHeavyLoad = (from, to) => {
    const diffInDays = dayjs(to).diff(dayjs(from), 'day');
    if (diffInDays > 31) {
      Alert.alert(
        '⚠ Heavy Load',
        'The selected range is more than 1 month. Please download the data report.',
        [{ text: 'Go to Download', onPress: () => navigation.navigate('DownloadScreen') }]
      );
      return true;
    }
    return false;
  };

  const fetchPieAndMachines = async (customFrom, customTo) => {
    if (checkAndRedirectHeavyLoad(customFrom, customTo)) return;

    try {
      setLoading(true);
      const params = {
        from_date: customFrom.toISOString(),
        to_date: customTo.toISOString(),
      };

      const [priorityRes, machinesRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/priority-usage/`, { params }),
        axios.get(`${BASE_URL}/api/machines/`),
      ]);

      setPriorityUsage(priorityRes.data);
      const limitedMachines = machinesRes.data.slice(0, 10);
      const statusPromises = limitedMachines.map((machine) =>
        axios
          .get(`${BASE_URL}/api/machine-status/`, {
            params: { gfrid: machine.gfrid, ...params },
          })
          .then((res) => ({ ...res.data, gfrid: machine.gfrid }))
          .catch(() => null)
      );

      const allMachineStatus = await Promise.all(statusPromises);
      setMachineData(allMachineStatus.filter(Boolean));

      chartAnim.setValue(0);
      Animated.timing(chartAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }).start();
    } catch (err) {
      console.error('❌ Fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    let from;
    if (range === '1d') from = new Date(now.getTime() - 1 * 86400 * 1000);
    else if (range === '1w') from = new Date(now.getTime() - 7 * 86400 * 1000);
    else if (range === '1m') from = new Date(now.getTime() - 30 * 86400 * 1000);

    if (from) {
      setFromDate(from);
      setToDate(now);
      fetchPieAndMachines(from, now);
    }
  }, [range]);

  useEffect(() => {
    if (fromDate && toDate && range === null) {
      fetchPieAndMachines(fromDate, toDate);
    }
  }, [fromDate, toDate]);

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

  const getBarChartData = () => {
    const total = priorityUsage.length || 1;
    return priorityUsage.map((item, index) => {
      const hue = (index * 360) / total;
      const percent = parseFloat(item.on_percent.toFixed(2));
      return {
        label: `GFRID${item.gfrid}`,
        value: percent > 0 ? percent : 0.01,
        color: `hsl(${hue}, 65%, 55%)`,
      };
    });
  };

  const renderPaginatedGraph = (records, gfrid) => {
    const page = pageState[gfrid] || 0;
    const totalPages = Math.ceil(records.length / MAX_POINTS_PER_PAGE);
    const currentData = records.slice(page * MAX_POINTS_PER_PAGE, (page + 1) * MAX_POINTS_PER_PAGE);
    const chartWidth = Math.max(currentData.length * pointWidth, screenWidth);

    return (
      <>
        <Animated.View style={{ transform: [{ scale: chartAnim }], opacity: chartAnim }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: currentData.map((r) => r.status) }],
              }}
              width={chartWidth}
              height={180}
              fromZero
              withDots={false}
              withInnerLines
              withVerticalLabels={false}
              chartConfig={{
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                color: () => '#1E3A8A',
                labelColor: () => '#334155',
                decimalPlaces: 0,
              }}
            />
          </ScrollView>
        </Animated.View>

        <View style={styles.labelRow}>
          {currentData.map(({ start_time }, idx) => {
            const time = dayjs(start_time).tz('Asia/Kolkata').format('HH:mm');
            const date = dayjs(start_time).tz('Asia/Kolkata').format('DD/MM');
            return (
              <View key={idx} style={styles.labelItem}>
                <Text style={styles.labelText}>{time}</Text>
                <Text style={styles.labelSubText}>{date}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.paginationRow}>
          <TouchableOpacity
            disabled={page === 0}
            onPress={() =>
              setPageState((prev) => ({ ...prev, [gfrid]: Math.max(prev[gfrid] - 1, 0) }))}>
            <Ionicons name="chevron-back-circle" size={30} color={page === 0 ? '#ccc' : '#1E3A8A'} />
          </TouchableOpacity>
          <Text style={styles.pageText}>{`Page ${page + 1} of ${totalPages}`}</Text>
          <TouchableOpacity
            disabled={page === totalPages - 1}
            onPress={() =>
              setPageState((prev) => ({
                ...prev,
                [gfrid]: Math.min((prev[gfrid] || 0) + 1, totalPages - 1),
              }))}>
            <Ionicons name="chevron-forward-circle" size={30} color={page === totalPages - 1 ? '#ccc' : '#1E3A8A'} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Range Buttons */}
      <View style={styles.rangeButtons}>
        {['1d', '1w', '1m', 'custom'].map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.rangeBtn, range === opt && styles.rangeBtnActive]}
            onPress={() => {
              if (opt === 'custom') {
                setRange(null);
                setFromDate(null);
                setToDate(null);
                setShowFromPicker(true);
              } else {
                setRange(opt);
              }
            }}>
            <Text style={[styles.rangeText, range === opt && styles.rangeTextActive]}>
              {opt.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => navigation.navigate('DownloadScreen')}
          style={[styles.rangeBtn, { backgroundColor: '#7ce846' }]}
        >
          <Text style={{ color: 'black', fontWeight: 'bold' }}>
            <Ionicons name="cloud-download-outline" size={16} /> Download
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time Range Info */}
      {fromDate && toDate && (
        <View style={styles.timeCard}>
          <Text style={styles.timeTitle}><Ionicons name="calendar" size={18} /> Selected Time Range</Text>
          <Text style={styles.timeRange}>From: {dayjs(fromDate).tz("Asia/Kolkata").format('DD MMM YYYY, hh:mm A')}</Text>
          <Text style={styles.timeRange}>To: {dayjs(toDate).tz("Asia/Kolkata").format('DD MMM YYYY, hh:mm A')}</Text>
        </View>
      )}

      {/* Bar Chart */}
      {priorityUsage.length > 0 && (
        <Animated.View style={[styles.chartCard, { transform: [{ scale: chartAnim }], opacity: chartAnim }]}>
          <Text style={styles.chartTitle}>Overall</Text>
          <CustomDonutChartWithLegend data={getBarChartData()} />
        </Animated.View>
      )}

      {/* Machine Data Cards */}
      {machineData.map((machine) => (
        <View key={machine.gfrid} style={styles.machineCard}>
          <Text style={styles.machineTitle}>GFRID: {machine.gfrid}</Text>
          {machine.status_records.length > 0
            ? renderPaginatedGraph(machine.status_records, machine.gfrid)
            : <Text style={{ color: '#999' }}>No status records available.</Text>}
        </View>
      ))}

      {/* Date Pickers */}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F0F4F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  rangeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  rangeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    elevation: 2,
  },
  rangeBtnActive: {
    backgroundColor: '#1E3A8A',
  },
  rangeText: {
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 14,
  },
  rangeTextActive: {
    color: '#FFFFFF',
  },
  timeCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 16,
    borderRadius: 20,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#1E40AF',
  },
  timeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1E293B',
    textAlign: 'center',
  },
  timeRange: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1E3A8A',
    textAlign: 'center',
  },
  machineCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 22,
    borderRadius: 18,
    elevation: 5,
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  machineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginTop: 10,

    marginBottom: 10,
  },
  labelItem: {
    width: pointWidth,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  labelSubText: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 16,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  pieRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
pieLegend: {
  flex: 1,
  paddingLeft: 10,
  justifyContent: 'center',
},
legendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 8,
},
legendColorBox: {
  width: 14,
  height: 14,
  borderRadius: 3,
  marginRight: 8,
},
legendLabel: {
  fontSize: 13,
  color: '#1E293B',
},

});

export default InfoWrapper;
