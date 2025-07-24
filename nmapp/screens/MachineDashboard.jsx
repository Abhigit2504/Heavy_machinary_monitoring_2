import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { BASE_URL } from '../config';

const { width } = Dimensions.get('window');

// Sophisticated color palette
const COLORS = {
  primaryDark: '#1A365D',       // Deep navy (trust, intelligence)
  primaryLight: '#2C5282',      // Medium navy
  success: '#2F855A',           // Forest green
  successLight: '#38A169',      // Emerald green
  warning: '#C05621',           // Burnt orange
  warningLight: '#DD6B20',      // Bright orange
  error: '#9B2C2C',            // Deep red
  errorLight: '#C53030',       // Bright red
  neutral: '#4A5568',          // Slate gray
  neutralLight: '#718096',     // Light slate
  background: '#F8FAFC',       // Very light gray
  cardBg: '#FFFFFF',           // Pure white
  textDark: '#1A202C',         // Near black
  textMedium: '#4A5568',       // Medium gray
  textLight: '#718096',        // Light gray
  border: '#E2E8F0',           // Light border
};

const MachineDashboard = ({ navigation }) => {
  const [machines, setMachines] = useState([]);
  const [machineStatusMap, setMachineStatusMap] = useState({});
  const [searchGfrid, setSearchGfrid] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [typedText, setTypedText] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const cardAnimations = useRef([]).current;
  const fullTextRef = useRef('');
  const refreshIntervalRef = useRef(null);

  const fetchUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      fullTextRef.current = `Welcome, ${parsed.first_name} ${parsed.last_name}!`;
      typeText();
      animateWelcome();
    }
  };

  const typeText = () => {
    let i = 0;
    const fullText = fullTextRef.current;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
  };

  const animateWelcome = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchStatusData = async (gfrid) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/machine-status/?gfrid=${gfrid}`);
      const { time_periods } = response.data;
      if (time_periods?.last_1_hours) {
        return {
          ...time_periods.last_1_hours,
          on_time_percentage: time_periods.last_1_hours.on_time_percentage || 0,
          on_time_sec: time_periods.last_1_hours.on_time_sec || 0,
        };
      }
      return null;
    } catch (err) {
      console.error(`Failed fetching status for GFRID ${gfrid}`, err.message);
      return null;
    }
  };

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/machines/`);
      const machineList = res.data;

      setMachines(machineList);

      const statusMap = {};
      await Promise.all(machineList.map(async (m) => {
        const status = await fetchStatusData(m.gfrid);
        if (status) statusMap[m.gfrid] = status;
      }));

      setMachineStatusMap(statusMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchMachines();

    refreshIntervalRef.current = setInterval(fetchMachines, 3000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    return dayjs(ts).format('DD-MMM-YYYY, hh:mm A');
  };

  const filteredMachines = machines.filter((machine) =>
    machine.gfrid.toString().includes(searchGfrid)
  );

  const renderItem = ({ item, index }) => {
    if (!cardAnimations[index]) {
      cardAnimations[index] = new Animated.Value(0);
      Animated.timing(cardAnimations[index], {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }

    const statusValue = item.status;
    let statusText, statusIcon, bgColor, statusColor, borderColor, gradientColors;

    if (statusValue === 1) {
      statusText = 'ACTIVE';
      statusIcon = 'rocket-launch';
      bgColor = '#EBF8F2';
      statusColor = COLORS.success;
      borderColor = '#BEE3D8';
      gradientColors = [COLORS.success, COLORS.successLight];
    } else if (statusValue === 0) {
      statusText = 'INACTIVE';
      statusIcon = 'power-off';
      bgColor = '#FFF5F5';
      statusColor = COLORS.error;
      borderColor = '#FED7D7';
      gradientColors = [COLORS.error, COLORS.errorLight];
    } else {
      statusText = 'UNKNOWN';
      statusIcon = 'help-circle';
      bgColor = '#EDF2F7';
      statusColor = COLORS.neutral;
      borderColor = '#E2E8F0';
      gradientColors = [COLORS.neutral, COLORS.neutralLight];
    }

    const usage = machineStatusMap[item.gfrid] || {};
    const onPercent = usage.on_time_percentage || 0;
    const onTimeMinutes = usage.on_time_sec ? Math.round(usage.on_time_sec / 60) : 0;


    return (
      <Animated.View
        style={{
          opacity: cardAnimations[index],
          transform: [
            {
              translateY: cardAnimations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={[styles.card, { borderColor }]}
          onPress={() => navigation.navigate('MachineDetail', { gfrid: item.gfrid })}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <LinearGradient
              colors={[bgColor, '#FFFFFF']}
              style={styles.machineIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons 
                name="robot-industrial" 
                size={28} 
                color={statusColor} 
              />
            </LinearGradient>
            <View style={styles.titleContainer}>
              <Text style={styles.cardTitle}>Machine GFRID {item.gfrid}</Text>
              <Text style={styles.cardSubtitle}>Last updated: {formatTimestamp(item.last_seen)}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: bgColor }]}>
              <MaterialCommunityIcons 
                name={statusIcon} 
                size={16} 
                color={statusColor} 
              />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>

          <View style={styles.usageContainer}>
            <Text style={styles.usageTitle}>UTILIZATION METRICS</Text>
            <View style={styles.usageBarContainer}>
              <View style={styles.percentageDisplay}>
                <Text style={[styles.percentageValue, { color: statusColor }]}>
                  {onPercent.toFixed(0)}%
                </Text>
                <Text style={styles.percentageLabel}>Active time</Text>
              </View>
              <View style={styles.usageBarWrapper}>
                <View style={styles.usageBarBackground}>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.usageBarFill, 
                      { 
                        width: `${onPercent}%`,
                      }
                    ]}
                  >
                    {onPercent > 15 && (
                      <Text style={styles.usageBarText}>{onTimeMinutes}m</Text>
                    )}
                  </LinearGradient>
                </View>
                <View style={styles.usageBarLabels}>
                  <Text style={styles.usageBarLabel}>0%</Text>
                  <Text style={styles.usageBarLabel}>50%</Text>
                  <Text style={styles.usageBarLabel}>100%</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryDark} />
        <Text style={styles.loadingText}>Loading machine data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
    >
      {typedText !== '' && (
        <Animated.Text
          style={[
            styles.welcomeText,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {typedText}
        </Animated.Text>
      )}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMedium} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search by machine ID..."
          value={searchGfrid}
          onChangeText={setSearchGfrid}
          placeholderTextColor={COLORS.textLight}
        />
      </View>

      <FlatList
        data={filteredMachines}
        keyExtractor={(item) => item.gfrid.toString()}
        renderItem={renderItem}
        scrollEnabled={false}
        contentContainerStyle={styles.listContainer}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  listContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textMedium,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    color: COLORS.primaryDark,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: COLORS.textDark,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    padding: 24,
    marginBottom: 20,
    borderRadius: 18,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  machineIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usageContainer: {
    marginTop: 16,
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  usageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMedium,
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  usageBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageDisplay: {
    width: 80,
    alignItems: 'center',
    marginRight: 20,
  },
  percentageValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  percentageLabel: {
    fontSize: 13,
    color: COLORS.textMedium,
    fontWeight: '600',
  },
  usageBarWrapper: {
    flex: 1,
  },
  usageBarBackground: {
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  usageBarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  usageBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  usageBarLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
  },
});

export default MachineDashboard;