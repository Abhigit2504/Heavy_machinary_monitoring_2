import React, { useEffect, useState, useRef, memo } from 'react';
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
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';

// Assuming BASE_URL is correctly configured in ../config.js
import { BASE_URL } from '../config';

const { width } = Dimensions.get('window');
const SPACING = 16; // Consistent spacing

// REVISED Color Palette: Vibrant & Focused Dashboard
const COLORS = {
  background: '#E8F0FE', // A very light, cool blue
  surface: '#FFFFFF', // Crisp white for cards
  textPrimary: '#2C3E50', // Dark blue-gray for main text
  textSecondary: '#627D98', // Muted blue for secondary text
  border: '#D0E4F5', // Light blue for subtle borders
  accent: '#3498DB', // Primary vibrant blue
  accentLight: '#5DADE2', // Lighter blue for gradients

  // Status Colors - Highly Visible & Intuitive
  statusOn: '#2ECC71', // Bright Green for ON
  statusOff: '#E74C3C', // Strong Red for OFF
  statusWarning: '#F1C40F', // Golden Yellow for Warning
  statusUnknown: '#95A5A6', // Muted Gray for Unknown

  // Gradient Backgrounds for Status Indicators
  gradientOn: ['#2ECC71', '#28B463'], // Green gradient
  gradientOff: ['#E74C3C', '#C0392B'], // Red gradient
  gradientWarning: ['#F1C40F', '#F39C12'], // Yellow gradient
  gradientUnknown: ['#95A5A6', '#7F8C8D'], // Gray gradient

  // Utilization Bar Colors
  utilizationFill: '#3498DB', // Bright blue for the fill
  utilizationBackground: '#EAEAEA', // Light gray for the empty part
  utilizationGradient: ['#3498DB', '#288ADB'], // Gradient for the fill

  shadow: 'rgba(0, 0, 0, 0.1)', // Standard shadow
  shadowStrong: 'rgba(0, 0, 0, 0.15)', // Stronger shadow for interactive elements
};

// Helper function for timestamp formatting
const formatTimestamp = (ts) => {
  if (!ts) return 'N/A';
  return dayjs(ts).format('DD MMM, hh:mm A');
};

// --- START: MachineItem COMPONENT ---
const MachineItem = memo(({ item, index, machineStatusMap, navigation }) => {
  const cardAnim = useRef(new Animated.Value(0)).current;

  // Animation for card entry
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 80,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [item]);

  const statusValue = item.status;
  let statusText, statusIconName, IconComponent, gradientColors;

  // Dynamic status text, icon, and colors
  if (statusValue === 1) { // ON
    statusText = 'ON';
    statusIconName = 'power'; // A general power icon from MaterialCommunityIcons
    IconComponent = MaterialCommunityIcons;
    gradientColors = COLORS.gradientOn;
  } else if (statusValue === 0) { // OFF
    statusText = 'OFF';
    statusIconName = 'power-off'; // MaterialCommunityIcons for off power icon
    IconComponent = MaterialCommunityIcons;
    gradientColors = COLORS.gradientOff;
  } else { // UNKNOWN
    statusText = 'UNKNOWN';
    statusIconName = 'help-circle-outline'; // MaterialCommunityIcons
    IconComponent = MaterialCommunityIcons;
    gradientColors = COLORS.gradientUnknown;
  }

  // Retrieve utilization data
  const usage = machineStatusMap[item.gfrid] || {};
  const onPercent = usage.on_time_percentage || 0;
  const onTimeMinutes = usage.on_time_sec ? Math.round(usage.on_time_sec / 60) : 0;

  return (
    <Animated.View
      style={[
        styles.machineTileWrapper,
        {
          opacity: cardAnim,
          transform: [{
            translateY: cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [40, 0],
            }),
          }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.machineTile}
        onPress={() => navigation.navigate('MachineDetail', { gfrid: item.gfrid })}
        activeOpacity={0.8}
      >
        {/* Status Pill with Icon and Text */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statusPill}
        >
          <IconComponent name={statusIconName} size={18} color={COLORS.surface} />
          <Text style={styles.statusPillText}>{statusText}</Text>
        </LinearGradient>

        {/* Main Content Area */}
        <View style={styles.tileContent}>
          <View style={styles.tileTitleContainer}>
            <MaterialCommunityIcons name="cog-box" size={24} color={COLORS.textPrimary} style={styles.titleIcon} />
            <Text style={styles.tileTitle}>Machine GFRID: {item.gfrid}</Text>
          </View>
          <Text style={styles.tileLastUpdate}>Last Update: {formatTimestamp(item.ts_off || item.ts)}</Text>

          {/* Utilization Graph (Progress Bar) */}
          <View style={styles.utilizationContainer}>
            <Text style={styles.utilizationLabel}>Utilization ({onPercent.toFixed(0)}%)</Text>
            <View style={styles.progressBarBackground}>
              <LinearGradient
                colors={COLORS.utilizationGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, onPercent)}%` }, // Cap at 100%
                ]}
              />
            </View>
          </View>

          {/* Run Time Metric */}
          <View style={styles.runTimeMetric}>
            <MaterialCommunityIcons name="timer-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.runTimeText}>{onTimeMinutes} minutes active</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
// --- END: MachineItem COMPONENT ---


// --- START: MachineDashboard COMPONENT ---
const MachineDashboard = ({ navigation }) => {
  const [machines, setMachines] = useState([]);
  const [machineStatusMap, setMachineStatusMap] = useState({});
  const [searchGfrid, setSearchGfrid] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false); // State for search bar visibility

  // Animated values for header, search, and list entry animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-50)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const searchBarTranslateY = useRef(new Animated.Value(-30)).current;
  const listFadeIn = useRef(new Animated.Value(0)).current;

  // New animated values for welcome text "pulling" animation
  const welcomeTextScale = useRef(new Animated.Value(0.8)).current;
  const welcomeTextOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTextTranslateX = useRef(new Animated.Value(-50)).current; // Start off-screen to the left

  // Function to run initial UI animations
  const animateIn = () => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1, duration: 800, delay: 200, useNativeDriver: true, easing: Easing.out(Easing.ease),
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0, duration: 800, delay: 200, useNativeDriver: true, easing: Easing.out(Easing.ease),
      }),
      Animated.timing(welcomeTextScale, {
        toValue: 1, duration: 1000, delay: 400, useNativeDriver: true, easing: Easing.elastic(1),
      }),
      Animated.timing(welcomeTextOpacity, {
        toValue: 1, duration: 800, delay: 400, useNativeDriver: true,
      }),
      Animated.timing(welcomeTextTranslateX, {
        toValue: 0, duration: 1000, delay: 400, useNativeDriver: true, easing: Easing.out(Easing.ease),
      }),
      Animated.timing(listFadeIn, {
        toValue: 1, duration: 1000, delay: 600, useNativeDriver: true, easing: Easing.out(Easing.ease),
      }),
    ]).start();
  };

  // Toggle search bar visibility animation
  const toggleSearchBar = () => {
    setIsSearchBarVisible(prev => !prev);
    Animated.parallel([
      Animated.timing(searchBarOpacity, {
        toValue: isSearchBarVisible ? 0 : 1, // If visible, fade out; if hidden, fade in
        duration: 300,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(searchBarTranslateY, {
        toValue: isSearchBarVisible ? -30 : 0, // If visible, move up; if hidden, move to original position
        duration: 300,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
    ]).start();
    // Clear search if hiding the bar
    if (isSearchBarVisible) {
      setSearchGfrid('');
    }
  };

  // Fetch user data from AsyncStorage
  const fetchUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setWelcomeMessage(`Hello, ${parsed.first_name || 'User'}`);
      } else {
        setWelcomeMessage('Welcome!');
      }
    } catch (e) {
      console.error("Failed to load user from AsyncStorage:", e);
      setWelcomeMessage('Welcome!');
    }
  };

  // Fetch status for a single machine from the API
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
      console.error(`Failed fetching status for GFRID ${gfrid}:`, err.message);
      return null;
    }
  };

  // Fetch all machines and their latest statuses
  const fetchMachines = async () => {
    setLoading(true);
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
      console.error("Failed to fetch machines:", err);
    } finally {
      setLoading(false);
    }
  };

  // Main useEffect: data fetching, animations, and refresh interval
  useEffect(() => {
    fetchUser();
    fetchMachines();
    animateIn();

    const refreshInterval = setInterval(fetchMachines, 10000); // Refresh every 10 seconds
    return () => clearInterval(refreshInterval); // Cleanup on unmount
  }, []);

  // Filter machines based on search input
  const filteredMachines = machines.filter((machine) =>
    machine.gfrid.toString().toLowerCase().includes(searchGfrid.toLowerCase())
  );

  // Render function for FlatList items
  const renderItem = ({ item, index }) => (
    <MachineItem
      item={item}
      index={index}
      machineStatusMap={machineStatusMap}
      navigation={navigation}
    />
  );

  // Display a loading indicator when initial data is being fetched
  if (loading && machines.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading machine data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={styles.headerTopRow}>
            <Animated.Text
              style={[
                styles.welcomeText,
                {
                  transform: [{ scale: welcomeTextScale }, { translateX: welcomeTextTranslateX }],
                  opacity: welcomeTextOpacity,
                }
              ]}
            >
              {welcomeMessage}
            </Animated.Text>
            <TouchableOpacity onPress={toggleSearchBar} style={styles.searchToggleIcon}>
              <Ionicons name="search" size={26} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.dashboardTitle}>Available Machines</Text>
        </Animated.View>

        {/* Search Bar Section (Conditionally rendered and animated) */}
        {isSearchBarVisible && (
          <Animated.View
            style={[
              styles.searchContainer,
              {
                opacity: searchBarOpacity,
                transform: [{ translateY: searchBarTranslateY }],
                // Ensures layout space is reserved even if hidden by opacity/translate
                height: isSearchBarVisible ? 55 : 0,
                marginBottom: isSearchBarVisible ? SPACING * 1.8 : 0,
              },
            ]}
          >
            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search by Machine ID..."
              value={searchGfrid}
              onChangeText={setSearchGfrid}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              maxLength={10}
            />
            {searchGfrid.length > 0 && (
              <TouchableOpacity onPress={() => setSearchGfrid('')} style={styles.clearSearchIcon}>
                <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Conditional rendering for no results or the machine list */}
        {filteredMachines.length === 0 && !loading ? (
          <View style={styles.noResultsContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.noResultsText}>No machines found matching "{searchGfrid}".</Text>
            {searchGfrid.length > 0 && (
              <TouchableOpacity onPress={() => setSearchGfrid('')} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Animated.View style={{ opacity: listFadeIn }}>
            <FlatList
              data={Array.isArray(filteredMachines) ? filteredMachines : []}
              keyExtractor={(item) => item.gfrid.toString()}
              renderItem={renderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              refreshing={loading && machines.length > 0}
              onRefresh={fetchMachines}
            />
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

// --- START: StyleSheet for the New Vision ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING,
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  headerContainer: {
    marginBottom: SPACING * 1.5,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING / 2, // Adjusted to decrease margin below welcome text
  },
  welcomeText: {
    fontSize: 24, // Increased font size
    fontWeight: '700', // Bolder
    color: COLORS.textSecondary,
    letterSpacing: -0.2,
    // Removed marginBottom here as it's handled by headerTopRow's marginBottom
  },
  searchToggleIcon: {
    padding: 5, // Make icon easier to tap
  },
  dashboardTitle: {
    fontSize: 24, // Slightly larger for prominence
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.8, // Tighter letter spacing
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12, // More rounded corners
    paddingHorizontal: SPACING,
    height: 55, // Taller search bar
    marginBottom: SPACING * 1.8, // More space below search
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadowStrong, // Stronger shadow
    shadowOffset: { width: 0, height: 4 }, // More pronounced shadow
    shadowOpacity: 0.15,
    shadowRadius: 10, // Larger shadow blur
    elevation: 6, // Increased elevation for Android
    overflow: 'hidden', // Crucial for height animation
  },
  searchIcon: {
    marginRight: SPACING / 2,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 17, // Slightly larger text input
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  clearSearchIcon: {
    marginLeft: SPACING / 2,
    padding: 5,
  },
  listContainer: {
    paddingBottom: SPACING, // Add some bottom padding to the list
  },
  machineTileWrapper: {
    marginBottom: SPACING,
    borderRadius: 15, // More rounded corners for tiles
    overflow: 'hidden',
    shadowColor: COLORS.shadowStrong,
    shadowOffset: { width: 0, height: 6 }, // More pronounced shadow
    shadowOpacity: 0.2, // Slightly more opaque shadow
    shadowRadius: 12, // Larger shadow blur
    elevation: 8, // Increased elevation for Android
  },
  machineTile: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    overflow: 'hidden',
    padding: SPACING * 1.2, // Slightly more padding inside the tile
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, // Wider pill
    paddingVertical: 7, // Taller pill
    borderRadius: 25, // More rounded pill shape
    alignSelf: 'flex-start',
    marginBottom: SPACING * 1.2, // More space below the pill
  },
  statusPillText: {
    fontSize: 15, // Slightly larger status text
    fontWeight: '700',
    color: COLORS.surface,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  tileContent: {
    // No changes needed here
  },
  tileTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleIcon: {
    marginRight: 8,
  },
  tileTitle: {
    fontSize: 20, // Larger title
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tileLastUpdate: {
    fontSize: 14, // Slightly larger last update text
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING * 1.8, // More space below
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING / 1.5, // More padding below border
  },
  utilizationContainer: {
    marginBottom: SPACING * 1.2, // More space below the bar
  },
  utilizationLabel: {
    fontSize: 15, // Slightly larger label
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10, // More space above the bar
  },
  progressBarBackground: {
    height: 14, // Thicker progress bar
    backgroundColor: COLORS.utilizationBackground,
    borderRadius: 7, // More rounded corners
    overflow: 'hidden',
    // Added shadow for better UI
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressBarFill: {
    height: '100%',
    // Background color is now handled by LinearGradient in the component
    borderRadius: 7,
  },
  runTimeMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING / 2,
  },
  runTimeText: {
    fontSize: 15, // Slightly larger runtime text
    color: COLORS.textSecondary,
    marginLeft: 10, // More space from icon
    fontWeight: '500',
  },
  noResultsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING * 2.5, // More vertical padding
    backgroundColor: COLORS.surface,
    borderRadius: 15, // More rounded corners
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    marginTop: SPACING * 1.5,
  },
  noResultsText: {
    fontSize: 18, // Larger no results text
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: SPACING,
    textAlign: 'center',
    paddingHorizontal: SPACING,
    lineHeight: 25, // Better line height
  },
  clearSearchButton: {
    marginTop: SPACING * 1.8, // More space above button
    paddingVertical: 14, // Taller button
    paddingHorizontal: 30, // Wider button
    backgroundColor: COLORS.accent,
    borderRadius: 30,
    shadowColor: COLORS.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, // More pronounced shadow for button
    shadowRadius: 8,
    elevation: 7, // Increased elevation
  },
  clearSearchButtonText: {
    color: COLORS.surface,
    fontSize: 17, // Larger button text
    fontWeight: '700',
  },
});

export default MachineDashboard;