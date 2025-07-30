import React, { useEffect, useState, useRef } from 'react';
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

import { BASE_URL } from '../config';

const MAX_POINTS_PER_PAGE = 50;
const pointWidth = 60;

const MachineStatusGraph = ({ gfrid, fromDate, range }) => {
  const [toDate, setToDate] = useState(new Date());
  const [statusData, setStatusData] = useState([]);
  const [statusDetails, setStatusDetails] = useState({ onTime: 0, offTime: 0 });
  const [usageData, setUsageData] = useState({ labels: [], values: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const intervalRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [showUpdatedNotification, setShowUpdatedNotification] = useState(false);

  const formatTimeLabel = (date) => {
    return dayjs(date).format('h:mm A');
  };

  const formatDateLabel = (date) => {
    return dayjs(date).format('D MMM');
  };

  const formatHourlyLabel = (hour) => {
    const [h] = hour.split(':');
    const hourNum = parseInt(h, 10);
    return dayjs().hour(hourNum).minute(0).format('h A');
  };

  const updateLastUpdatedTime = () => {
    const now = dayjs();
    setLastUpdated(now.format('h:mm A'));
    setShowUpdatedNotification(true);
    setTimeout(() => setShowUpdatedNotification(false), 3000);
  };

  const fetchData = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

      const params = {
        gfrid,
        from_date: dayjs(fromDate).utc().toISOString(),
        to_date: dayjs(toDate).utc().toISOString(),
        range: range || '1h',
      };

      const res = await axios.get(`${BASE_URL}/api/machine-status/`, { params });
      const { on_time_sec, off_time_sec, status_records } = res.data;

      // Calculate accurate on/off times from the records
      let calculatedOnTime = 0;
      let calculatedOffTime = 0;

      const pulsePoints = [];
      const hourlyUsage = {};

      (status_records || []).forEach(({ start_time, end_time, status }) => {
        const start = dayjs(start_time);
        const end = dayjs(end_time);
        const duration = end.diff(start, 'second');
        const safeStatus = status === 1 ? 1 : 0;

        if (safeStatus === 1) {
          calculatedOnTime += duration;
        } else {
          calculatedOffTime += duration;
        }

        pulsePoints.push({
          label1: formatTimeLabel(start),
          label2: formatDateLabel(start),
          value: safeStatus,
        });
        pulsePoints.push({
          label1: formatTimeLabel(end),
          label2: formatDateLabel(end),
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

      // Use calculated times instead of API times for more accuracy
      setStatusData(pulsePoints);
      setStatusDetails({ 
        onTime: calculatedOnTime, 
        offTime: calculatedOffTime 
      });

      console.log('Interval:', dayjs(fromDate).format('YYYY-MM-DD HH:mm:ss'), 'to', dayjs(toDate).format('YYYY-MM-DD HH:mm:ss'));
console.log('Calculated ON Time (seconds):', calculatedOnTime);
console.log('Calculated OFF Time (seconds):', calculatedOffTime);
console.log('Formatted ON Time:', formatTime(calculatedOnTime));
console.log('Formatted OFF Time:', formatTime(calculatedOffTime));


      const fullLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
      const fullValues = fullLabels.map((label) =>
        parseFloat((hourlyUsage[label] || 0).toFixed(2))
      );

      setUsageData({ 
        labels: fullLabels.map(formatHourlyLabel),
        values: fullValues 
      });
      setRefreshTick((tick) => tick + 1);
      updateLastUpdatedTime();
    } catch (err) {
      console.error('Fetch error', err);
      setStatusData([]);
      setUsageData({ labels: [], values: [] });
      setStatusDetails({ onTime: 0, offTime: 0 });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    // Refresh data every 30 seconds
    intervalRef.current = setInterval(() => {
      setToDate(new Date());
    }, 3000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [toDate]);

  const totalPages = Math.ceil(statusData.length / MAX_POINTS_PER_PAGE);
  const currentData = statusData.slice(page * MAX_POINTS_PER_PAGE, (page + 1) * MAX_POINTS_PER_PAGE);
  const chartValues = currentData.map((pt) => pt.value);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(screenWidth, currentData.length * pointWidth);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };
  

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#4a6da7" />;

  return (
    <ScrollView style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Ionicons name="time-outline" size={24} color="#fff" />
          <Text style={styles.summaryHeaderText}>MACHINE RUNTIME</Text>
        </View>
        
        <View style={styles.summaryContent}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="power" size={24} color="#4ade80" />
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryLabel}>ON TIME</Text>
                <Text style={styles.summaryValue}>{formatTime(statusDetails.onTime)}</Text>
              </View>
            </View>
            
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="power-off" size={24} color="#f87171" />
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryLabel}>OFF TIME</Text>
                <Text style={styles.summaryValue}>{formatTime(statusDetails.offTime)}</Text>
              </View>
            </View>
          </View>

          {showUpdatedNotification && (
            <View style={styles.updatedNotification}>
              <Text style={styles.updatedText}>Updated</Text>
            </View>
          )}
        </View>
      </View>

      {/* Machine Status Graph */}
      <View style={styles.graphCard}>
        <Text style={styles.chartTitle}>Machine Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.yAxisLabels}>
              <Text style={styles.yAxisLabelText}>ON</Text>
              <Text style={styles.yAxisLabelText}>OFF</Text>
            </View>
            <View>
              <LineChart
                key={refreshTick}
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
                    <Text style={styles.labelText}>--:-- --</Text>
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

      {/* Hourly Usage Graph */}
      <View style={styles.graphCard}>
        <Text style={styles.chartTitle}>Hourly Usage</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            key={`hourly-${refreshTick}`}
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
    marginBottom: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3a5a8f',
  },
  summaryHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  summaryContent: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryTextContainer: {
    marginLeft: 12,
  },
  summaryLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  graphCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    elevation: 2,
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
    marginRight: 5,
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
  updatedNotification: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  updatedText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default MachineStatusGraph;
