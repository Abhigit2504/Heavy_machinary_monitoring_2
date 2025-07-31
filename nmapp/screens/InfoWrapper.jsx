import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Platform,
  Animated,
  Easing,
  Dimensions,
  Alert,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Import the UptimeBarChart component
import UptimeBarChart from '../components/UptimeBarChart ';

// Assume logPageVisit and BASE_URL are defined elsewhere
import { logPageVisit } from '../api/LogsApi';
import { BASE_URL } from '../config';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const PRIMARY_COLOR = '#5279a8';
const SECONDARY_COLOR = '#4a8c7e';
const LIGHT_BACKGROUND = '#f8f9fa';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const InfoWrapper = () => {
  const navigation = useNavigation();

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const chartScale = useState(new Animated.Value(0.9))[0];
  const searchBarAnim = useState(new Animated.Value(0))[0];

  // State management for date/time and range
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 3600000));
  const [toDate, setToDate] = useState(new Date());
  const [range, setRange] = useState('1h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Other state management
  const [machines, setMachines] = useState([]);
  const [machineData, setMachineData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 1000);
  const [isSearchBarEnabled, setIsSearchBarEnabled] = useState(false);
  const searchInputRef = useRef(null);

  // Refs for tracking changes and automatic refresh
  const refreshIntervalRef = useRef(null);
  const isInitialLoad = useRef(true);
  const lastSearchQuery = useRef('');
  const lastRange = useRef('');

  // Run animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.spring(chartScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, chartScale]);

  // Handle search bar toggle
  useEffect(() => {
    Animated.timing(searchBarAnim, {
      toValue: isSearchBarEnabled ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (isSearchBarEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchBarEnabled]);

  // Handle refresh action from pull-to-refresh or explicit button
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((prevKey) => prevKey + 1);
  }, []);

  // Update dates based on predefined range
  useEffect(() => {
    if (range === '1h' || range === '6h' || range === '1d') {
      const now = new Date();
      let newFromDate;
      if (range === '1h') {
        newFromDate = new Date(now.getTime() - 3600000);
      } else if (range === '6h') {
        newFromDate = new Date(now.getTime() - 6 * 3600000);
      } else {
        newFromDate = new Date(now.getTime() - 24 * 3600000);
      }
      setFromDate(newFromDate);
      setToDate(now);
    }
  }, [range, refreshKey]);

  // Fetch all machines
  const fetchAllMachines = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/machines/`);
      if (!response.ok) throw new Error('Failed to fetch machines');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching machines:', error);
      throw error;
    }
  };

  // Fetch machine status for specific time range
  const fetchMachineStatus = async (machineId, from, to) => {
    try {
      if (!machineId) throw new Error('Machine ID is undefined');

      const fromISO = encodeURIComponent(dayjs(from).toISOString());
      const toISO = encodeURIComponent(dayjs(to).toISOString());
      const url = `${BASE_URL}/api/machine-status/?gfrid=${machineId}&from_date=${fromISO}&to_date=${toISO}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      const currentMachineInfoResponse = await fetch(
        `${BASE_URL}/api/machines/?gfrid=${machineId}`
      );
      let currentMachineInfo = {};
      if (currentMachineInfoResponse.ok) {
        const currentData = await currentMachineInfoResponse.json();
        if (Array.isArray(currentData) && currentData.length > 0) {
          currentMachineInfo = currentData[0];
        }
      }

      return {
        ...data,
        gfrid: machineId,
        on_time_sec: data.on_time_sec || 0,
        off_time_sec: data.off_time_sec || 0,
        status_records: data.status_records || [],
        status: currentMachineInfo.status !== undefined ? currentMachineInfo.status : 0,
        time_periods: data.time_periods || {
          '1h': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
          '6h': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
          '1d': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
        },
      };
    } catch (error) {
      console.error(`Error fetching status for machine ${machineId}:`, error);
      return {
        gfrid: machineId,
        on_time_sec: 0,
        off_time_sec: 0,
        status_records: [],
        status: 0,
        time_periods: {
          '1h': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
          '6h': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
          '1d': { on_time_sec: 0, off_time_sec: 0, on_time_percentage: 0 },
        },
        error: error.message,
      };
    }
  };

  // Load data for current time range
  const loadData = useCallback(
    async (isAutoRefresh = false) => {
      if (!isAutoRefresh) {
        setLoading(true);
        setError(null);
      }

      if (!fromDate || !toDate) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const machinesList = await fetchAllMachines();
        if (!machinesList.length) {
          throw new Error('No machines available. Please add machines to view data.');
        }
        setMachines(machinesList);

        const statusPromises = machinesList.map((machine) => {
          const machineId = machine.gfrid || machine.id;
          return fetchMachineStatus(machineId, fromDate, toDate);
        });

        const statusData = (await Promise.all(statusPromises)).filter(Boolean);
        setMachineData(statusData);
        setFilteredData(statusData);

        if (!isAutoRefresh) {
          Animated.sequence([
            Animated.timing(chartScale, {
              toValue: 1.02,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(chartScale, {
              toValue: 1,
              friction: 4,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (err) {
        setError(err.message);
        setMachineData([]);
        setFilteredData([]);
      } finally {
        if (!isAutoRefresh) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fromDate, toDate, chartScale]
  );

  // Automatic data refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (range !== 'custom' || (fromDate && toDate)) {
        loadData(true);
      }
    }, 5000);

    refreshIntervalRef.current = interval;

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadData, fromDate, toDate, range]);

  // Filter data based on search query
  useEffect(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredData(machineData);
    } else {
      const filtered = machineData.filter((machine) =>
        machine.gfrid.toString().includes(debouncedSearchQuery.trim())
      );
      setFilteredData(filtered);
    }
  }, [debouncedSearchQuery, machineData]);

  // Initial data load or when date range changes
  useEffect(() => {
    if (fromDate && toDate) {
      loadData();
    }
  }, [fromDate, toDate, loadData, refreshKey]);

  // Log page visit only when:
  // 1. Initial load
  // 2. Search query changes
  // 3. Range changes (to custom or between predefined ranges)
  // 4. Manual refresh
  useEffect(() => {
    if (!loading && machines.length > 0 && fromDate && toDate) {
      const shouldLog = 
        isInitialLoad.current || 
        debouncedSearchQuery !== lastSearchQuery.current || 
        range !== lastRange.current ||
        refreshing;
      
      if (shouldLog) {
        const gfrid = machines.map((m) => m.gfrid || m.id).join(',');
        const fromDateLog = dayjs(fromDate).format('D MMM YYYY, hh:mm A');
        const toDateLog = dayjs(toDate).format('D MMM YYYY, hh:mm A');

        logPageVisit('Info Page', {
          gfrid: gfrid || 'all',
          from: fromDateLog,
          to: toDateLog,
          range: range || 'custom',
          searchQuery: debouncedSearchQuery || '',
        }).catch((err) => {
          console.error('Visit log failed:', err.message);
        });

        // Update refs
        lastSearchQuery.current = debouncedSearchQuery;
        lastRange.current = range;
        isInitialLoad.current = false;
      }
    }
  }, [range, machines, fromDate, toDate, loading, debouncedSearchQuery, refreshing]);

  // Calculate aggregates
  const calculateAggregates = useCallback(() => {
    if (!filteredData.length) return null;

    let totalOnTime = 0;
    let totalOffTime = 0;
    const totalMachines = filteredData.length;

    filteredData.forEach((machine) => {
      const machineOnTime = machine.on_time_sec || 0;
      const machineOffTime = machine.off_time_sec || 0;

      totalOnTime += machineOnTime;
      totalOffTime += machineOffTime;
    });

    const totalTime = totalOnTime + totalOffTime;
    const onTimePercentage = totalTime > 0 ? (totalOnTime / totalTime) * 100 : 0;

    return {
      totalOnTime,
      totalOffTime,
      onTimePercentage,
      offTimePercentage: 100 - onTimePercentage,
      totalMachines,
    };
  }, [filteredData]);

  const aggregates = calculateAggregates();

  // Handle time range changes
  const handleTimeRangeChange = useCallback(
    (selectedRange) => {
      setRange(selectedRange);
      if (selectedRange === 'custom') {
        setShowFromPicker(true);
      } else {
        handleRefresh();
      }
    },
    [handleRefresh]
  );

  // Format duration for display
  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Format date for display
  const formatDate = (date) => {
    return date ? dayjs(date).format('DD MMM YYYY, hh:mm A') : 'Not set';
  };

  // Date picker handlers
  const handleFromConfirm = (date) => {
    setShowFromPicker(false);
    if (date) {
      if (toDate && date > toDate) {
        Alert.alert(
          'Invalid Date Range',
          'From Date cannot be after To Date. Please re-select To Date.'
        );
        setFromDate(date);
        setToDate(null);
        setShowToPicker(true);
      } else {
        setFromDate(date);
        setShowToPicker(true);
      }
      setRange('custom');
    }
  };

  const handleToConfirm = (date) => {
    setShowToPicker(false);
    if (date) {
      if (date < fromDate) {
        Alert.alert(
          'Invalid Date Range',
          'To Date cannot be before From Date.'
        );
        return;
      }
      if (date > new Date()) {
        Alert.alert(
          'Invalid Date',
          'To Date cannot be in the future.'
        );
        return;
      }
      setToDate(date);
      setRange('custom');
      handleRefresh();
    }
  };

  const handlePickerCancel = (pickerType) => {
    if (pickerType === 'from') {
      setShowFromPicker(false);
    } else {
      setShowToPicker(false);
    }
  };

  // Prepare data for bar chart
  const prepareChartData = useCallback(() => {
    const relevantMachines = filteredData.filter((machine) => {
      return (machine.on_time_sec || 0) > 0 || (machine.off_time_sec || 0) > 0;
    });

    const dataForChart = relevantMachines.map((machine) => {
      const machineOnTime = machine.on_time_sec || 0;
      const machineOffTime = machine.off_time_sec || 0;
      const machineTotalTime = machineOnTime + machineOffTime;
      return machineTotalTime > 0 ? (machineOnTime / machineTotalTime) * 100 : 0;
    });

    return {
      labels: relevantMachines.map((machine) => `M${machine.gfrid || '?'}`),
      datasets: [
        {
          data: dataForChart,
          colors: dataForChart.map(
            (percentage, i) =>
              (opacity = 1) => {
                if (percentage > 90) return `rgba(76, 175, 80, ${opacity})`;
                if (percentage > 70) return `rgba(255, 193, 7, ${opacity})`;
                return `rgba(244, 67, 54, ${opacity})`;
              }
          ),
        },
      ],
    };
  }, [filteredData]);

  const chartData = prepareChartData();

  const navigateToDownload = () => {
    navigation.navigate('DownloadScreen', {
      machineData: filteredData,
      timeRange: range,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
    });
  };

  const handleSearchIconPress = () => {
    setIsSearchBarEnabled(!isSearchBarEnabled);
    if (!isSearchBarEnabled) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading machine data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Icon name="error-outline" size={50} color="#E74C3C" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Icon name="refresh" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}>
      {/* Unified Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.header}>Machine Uptime</Text>
        <View style={styles.navbarIcons}>
          <TouchableOpacity onPress={handleSearchIconPress} style={styles.searchIconButton}>
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadButton} onPress={navigateToDownload}>
            <Icon name="download" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar - Animated */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            height: searchBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
            opacity: searchBarAnim,
            marginBottom: searchBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 20],
            }),
          },
        ]}>
        {isSearchBarEnabled && (
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by Machine ID"
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType="numeric"
          />
        )}
      </Animated.View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleRefresh()}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
            progressViewOffset={Platform.OS === 'android' ? 50 : 0}
          />
        }
        showsVerticalScrollIndicator={false}>
        {/* Time Range Selector */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}>
            {['1h', '6h', '1d', 'custom'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.filterButton,
                  range === option && styles.activeFilterButton,
                ]}
                onPress={() => handleTimeRangeChange(option)}>
                <Text
                  style={[
                    styles.filterButtonText,
                    range === option && styles.activeFilterButtonText,
                  ]}>
                  {option === '1h'
                    ? '1 Hour'
                    : option === '6h'
                    ? '6 Hours'
                    : option === '1d'
                    ? '24 Hours'
                    : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Selected Time Range Display */}
          <View style={styles.timeRangeDisplay}>
            <Icon name="calendar-today" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.timeRangeText}>
              {range === 'custom' && fromDate && toDate
                ? `From: ${formatDate(fromDate)}\nTo: ${formatDate(toDate)}`
                : `From ${formatDate(fromDate)}\nto: ${formatDate(toDate)}`}
            </Text>
          </View>

          {range === 'custom' && (
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFromPicker(true)}>
                <Text style={styles.dateButtonText}>From: {`\n${formatDate(fromDate)}`}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowToPicker(true)}>
                <Text style={styles.dateButtonText}>To: {`\n${formatDate(toDate)}`}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* DateTimePickerModal for From Date */}
          <DateTimePickerModal
            isVisible={showFromPicker}
            mode="datetime"
            date={fromDate || new Date()}
            onConfirm={handleFromConfirm}
            onCancel={() => handlePickerCancel('from')}
            maximumDate={toDate || new Date()}
          />

          {/* DateTimePickerModal for To Date */}
          <DateTimePickerModal
            isVisible={showToPicker}
            mode="datetime"
            date={toDate || new Date()}
            onConfirm={handleToConfirm}
            onCancel={() => handlePickerCancel('to')}
            minimumDate={fromDate || new Date()}
            maximumDate={new Date()}
          />
        </View>

        {/* Summary Statistics */}
        {aggregates && (
          <Animated.View style={[styles.summaryContainer, { opacity: fadeAnim }]}>
            <View style={styles.summaryCard1}>
              <Icon name="precision-manufacturing" size={30} color="#000" />
              <Text style={styles.summaryLabel}>Total Machines</Text>
              <Text style={styles.summaryValue}>{aggregates.totalMachines}</Text>
            </View>
            <View style={styles.summaryCard2}>
              <Icon name="play-circle-outline" size={30} color="#000000ff" />
              <Text style={styles.summaryLabel}>Total On Time</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(aggregates.totalOnTime)}
              </Text>
            </View>
            <View style={styles.summaryCard3}>
              <Icon name="pause-circle-outline" size={30} color="#000000ff" />
              <Text style={styles.summaryLabel}>Total Off Time</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(aggregates.totalOffTime)}
              </Text>
            </View>
            <View style={styles.summaryCard4}>
              <Icon
                name="timeline"
                size={30}
                color={
                  aggregates.onTimePercentage > 90
                    ? '#000000ff'
                    : aggregates.onTimePercentage > 70
                    ? '#050400ff'
                    : '#100000ff'
                }
              />
              <Text style={styles.summaryLabel}>Overall Uptime</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      aggregates.onTimePercentage > 90
                        ? '#34C759'
                        : aggregates.onTimePercentage > 70
                        ? '#FFCC00'
                        : '#fffefeff',
                  },
                ]}>
                {aggregates.onTimePercentage.toFixed(1)}%
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Bar Chart Component */}
        {filteredData.length > 0 && fromDate && toDate ? (
          <View style={styles.chartContainer}>
            <UptimeBarChart
              chartData={chartData}
              chartScale={chartScale}
              timeRange={range}
              filteredData={filteredData}
            />
          </View>
        ) : (
          <View style={styles.noDataChartContainer}>
            <Icon name="bar-chart" size={60} color="#BFBFBF" />
            <Text style={styles.noResultsText}>No chart data available for this selection.</Text>
          </View>
        )}

        {/* Machine Data Table */}
        {filteredData.length > 0 ? (
          <Animated.View style={[styles.tableContainer, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>Machine Details</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>GFR ID</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>OnTime</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Uptime %</Text>
            </View>

            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => `${item.gfrid}-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const machineOnTime = item.on_time_sec || 0;
                const machineOffTime = item.off_time_sec || 0;
                const machineTotalTime = machineOnTime + machineOffTime;
                const onTimePercentage =
                  machineTotalTime > 0 ? (machineOnTime / machineTotalTime) * 100 : 0;

                const isRunning = item.status === 1;

                return (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]}>
                      {item.gfrid || '?'}
                    </Text>
                    <View
                      style={[
                        styles.statusIndicator,
                        {
                          backgroundColor: isRunning ? '#34C759' : '#E74C3C',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.tableCell,
                          { flex: 1, color: '#fff', fontSize: 14, textAlign: 'center' },
                        ]}>
                        {isRunning ? 'ON' : 'OFF'}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                      {formatDuration(machineOnTime)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        {
                          flex: 1,
                          color:
                            onTimePercentage > 90
                              ? '#34C759'
                              : onTimePercentage > 70
                              ? '#FFCC00'
                              : '#E74C3C',
                          fontWeight: '600',
                        },
                      ]}>
                      {onTimePercentage.toFixed(1)}%
                    </Text>
                  </View>
                );
              }}
            />
          </Animated.View>
        ) : (
          <View style={styles.noResultsContainer}>
            <Icon name="info-outline" size={60} color="#BFBFBF" />
            <Text style={styles.noResultsText}>
              No machine data available for the selected range or search.
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BACKGROUND,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LIGHT_BACKGROUND,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 20,
    fontSize: 18,
    color: '#E74C3C',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 24,
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 5,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderBottomLeftRadius:16,
    borderBottomRightRadius:16,
    marginBottom:5
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  navbarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconButton: {
    marginRight: 15,
  },
  downloadButton: {
    backgroundColor:'#5279a8',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    height: 50,
    fontSize: 18,
    color: '#333',
  },
  filterContainer: {
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  filterScroll: {
    paddingBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 25,
    backgroundColor: '#e9ecef',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  activeFilterButton: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: '#5287c7ff',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterButtonText: {
    color: '#495057',
    fontWeight: '600',
    fontSize: 15,
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  timeRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f3f5',
    height: 'auto',
  },
  timeRangeText: {
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    marginLeft: 12,
    color: '#343a40',
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    height: 'auto',
  },
  dateButtonText: {
    color: '#343a40',
    fontSize: 16,
    fontWeight: '500',
  },
  summaryContainer: {

    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 15,
    // borderTopWidth:1,
    
  },
  summaryCard1: {
    width: '48%',
    backgroundColor: '#b3c5d3ff',
    borderRadius: 12,
    padding: 20,
    marginTop:10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
    summaryCard2: {
    width: '48%',
    backgroundColor: '#dfe2aeff',
    borderRadius: 12,
    padding: 20,
    marginTop:10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
    summaryCard3: {
    width: '48%',
    backgroundColor: '#e4bab7ff',
    borderRadius: 12,
    padding: 20,
    marginTop:10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
    summaryCard4: {
    width: '48%',
    backgroundColor: '#97e8e1ff',
    borderRadius: 12,
    padding: 20,
    marginTop:10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#000000ff',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '900',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000ff',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 10,
    marginLeft: 5,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  noDataChartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 15,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 20,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 10,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: '#495057',
    fontSize: 16,
    textAlign: 'center',
    // marginHorizontal:2
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    alignItems: 'center',
  },
  tableCell: {
    color: '#343a40',
    fontSize: 13,
    textAlign: 'center',
  },
  statusIndicator: {
    borderRadius: 15,
    paddingHorizontal: 7,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 15,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    minHeight: 200,
  },
  noResultsText: {
    marginTop: 20,
    color: '#6c757d',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
});

export default InfoWrapper;