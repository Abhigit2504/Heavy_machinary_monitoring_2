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
  Dimensions,
  StatusBar,
  Platform,
  ImageBackground,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { BASE_URL } from '../config';


const { width, height } = Dimensions.get('window');
const SPACING = 20;
const AVATAR_SIZE = 50;
const MACHINE_ICON_SIZE = 40;
const GRAPH_HEIGHT = 200;
const GRAPH_BAR_WIDTH = 40;
const GRAPH_SPACING = 15;

const COLORS = {
  primary: '#2A4D69',
  secondary: '#4B86B4',
  accent: '#63B3ED',
  background: '#F0F4F8',
  surface: '#FFFFFF',
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  success: '#48BB78',
  warning: '#ED8936',
  danger: '#F56565',
  info: '#4299E1',
  divider: '#E2E8F0',
  shadow: 'rgba(0,0,0,0.1)',
  shadowDark: 'rgba(0,0,0,0.2)',
  gradientPrimary: ['#2A4D69', '#4B86B4'],
  gradientSuccess: ['#48BB78', '#68D391'],
  gradientWarning: ['#ED8936', '#F6AD55'],
  gradientDanger: ['#F56565', '#FC8181'],
  statusActive: '#38A169',
  statusIdle: '#3182CE',
  statusOffline: '#718096',
  statusError: '#E53E3E',
  statusMaintenance: '#D69E2E'
};

const formatTimestamp = (ts) => {
  if (!ts) return 'Never updated';
  return dayjs(ts).format('MMM D, h:mm A');
};

const getStatusDetails = (statusValue) => {
  switch(statusValue) {
    case 1: // Active
      return {
        text: 'Active',
        icon: 'power',
        color: COLORS.statusActive,
        gradient: COLORS.gradientSuccess,
        iconColor: '#FFFFFF'
      };
    case 0: // Off
      return {
        text: 'Offline',
        icon: 'power-off',
        color: COLORS.statusOffline,
        gradient: COLORS.gradientDanger,
        iconColor: '#FFFFFF'
      };
    case 2: // Maintenance
      return {
        text: 'Maintenance',
        icon: 'tools',
        color: COLORS.statusMaintenance,
        gradient: COLORS.gradientWarning,
        iconColor: '#FFFFFF'
      };
    case 3: // Error
      return {
        text: 'Error',
        icon: 'alert-circle',
        color: COLORS.statusError,
        gradient: COLORS.gradientDanger,
        iconColor: '#FFFFFF'
      };
    default: // Idle
      return {
        text: 'Idle',
        icon: 'power-sleep',
        color: COLORS.statusIdle,
        gradient: COLORS.gradientPrimary,
        iconColor: '#FFFFFF'
      };
  }
};

const StatusSummary = ({ machines }) => {
  const statusCounts = machines.reduce((counts, machine) => {
    const status = machine.status;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const onlineCount = statusCounts[1] || 0; // Active machines
  const offlineCount = statusCounts[0] || 0; // Offline machines
  const otherCount = machines.length - onlineCount - offlineCount; // Other statuses

  return (
    <View style={styles.statusSummaryContainer}>
      <View style={styles.statusSummaryItem}>
        <View style={[styles.statusIndicator, { backgroundColor: COLORS.statusActive }]} />
        <Text style={styles.statusSummaryText}>Online: {onlineCount}</Text>
      </View>
      <View style={styles.statusSummaryItem}>
        <View style={[styles.statusIndicator, { backgroundColor: COLORS.statusOffline }]} />
        <Text style={styles.statusSummaryText}>Offline: {offlineCount}</Text>
      </View>
      {/* <View style={styles.statusSummaryItem}>
        <View style={[styles.statusIndicator, { backgroundColor: COLORS.statusMaintenance }]} />
        <Text style={styles.statusSummaryText}>Others: {otherCount}</Text>
      </View> */}
    </View>
  );
};

const UtilizationDistribution = ({ machines, machineStatusMap }) => {
  if (!machines || machines.length === 0) return null;

  // Calculate total active time across all machines (in seconds)
  const totalActiveSeconds = machines.reduce((total, machine) => {
    const usage = machineStatusMap[machine.gfrid] || {};
    return total + (usage.on_time_sec || 0);
  }, 0);

  // Convert to minutes
  const totalActiveMinutes = Math.round(totalActiveSeconds / 60);
  
  // Calculate total possible time (assuming all machines running for same period)
  // This assumes a fixed period for "total possible time" for overall utilization.
  // If this should be dynamic based on actual uptime of the dashboard, adjust this value.
  const totalPossibleMinutes = 60; // Assuming a 60-minute reference for overall utilization
  
  // Calculate overall utilization percentage
  const overallUtilization = Math.min(100, Math.round((totalActiveSeconds / (totalPossibleMinutes * 60)) * 100));

  // Calculate each machine's contribution to the total active time
  const machineContributions = machines.map(machine => {
    const usage = machineStatusMap[machine.gfrid] || {};
    const machineMinutes = Math.round((usage.on_time_sec || 0) / 60);
    const contribution = totalActiveSeconds > 0 
      ? (usage.on_time_sec / totalActiveSeconds) * 100 
      : 0;
      
    return {
      machine,
      minutes: machineMinutes,
      contribution: contribution,
      status: getStatusDetails(machine.status)
    };
  });

  // Sort by contribution (highest first)
  machineContributions.sort((a, b) => b.contribution - a.contribution);

  return (
    <View style={styles.distributionContainer}>
      <Text style={styles.sectionTitle}>Utilization Overview </Text>
        <Text>★Last 1 hour</Text>
      
      <View style={styles.overallUtilization}>
        <Text style={styles.overallText}>
          Total Active Time: {totalActiveMinutes} min ({overallUtilization}% utilization)
        </Text>
        <View style={styles.overallBar}>
          <LinearGradient
            colors={['#4FD1C5', '#38B2AC']}
            style={[styles.overallBarFill, { width: `${overallUtilization}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
      </View>
      
      <Text style={styles.sectionSubtitle}>Machine Contribution</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.distributionScroll}
      >
        {machineContributions.map((item) => (
          <View key={item.machine.gfrid} style={styles.contributionItem}>
            <View style={styles.contributionBarContainer}>
              <View 
                style={[
                  styles.contributionBar,
                  { 
                    height: `${item.contribution}%`,
                    backgroundColor: item.status.color
                  }
                ]}
              />
            </View>
            <View style={styles.contributionLabel}>
              <Text style={styles.contributionText} numberOfLines={1}>
                {item.machine.name || `M${item.machine.gfrid}`}
              </Text>
              <Text style={styles.contributionPercent}>
                {item.contribution.toFixed(1)}%
              </Text>
              <Text style={styles.contributionMinutes}>
                {item.minutes} min
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const MachineItem = memo(({ item, index, machineStatusMap, machineContributions, navigation }) => {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const status = getStatusDetails(item.status);
  const usage = machineStatusMap[item.gfrid] || {};
  const utilization = usage.on_time_percentage || 0;
  const activeMinutes = usage.on_time_sec ? Math.round(usage.on_time_sec / 60) : 0;

  // Find the contribution for this specific machine
  const machineContribution = machineContributions.find(
    (contrib) => contrib.machine.gfrid === item.gfrid
  );
  const contributionPercentage = machineContribution
    ? machineContribution.contribution.toFixed(1)
    : '0.0';

  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [item]);

  return (
    <Animated.View
      style={[
        styles.machineCardWrapper,
        {
          opacity: cardAnim,
          transform: [{
            translateY: cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            }),
          }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.machineCard}
        onPress={() => navigation.navigate('MachineDetail', { 
          gfrid: item.gfrid,
          machineData: item,
          statusData: status
        })}
        activeOpacity={0.9}
      >
        <View style={[styles.statusIndicator, { backgroundColor: status.color }]} />
        
        <View style={styles.machineContent}>
          <View style={styles.machineHeader}>
            <View style={styles.machineIcon}>
              <Icon name="precision-manufacturing" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.machineId}>ID: {item.gfrid}</Text>
              <Text style={styles.machineName}>
                {item.name || `Machine GFRID ${item.gfrid}`}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <LinearGradient
              colors={status.gradient}
              style={styles.statusBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons 
                name={status.icon} 
                size={18} 
                color={status.iconColor} 
              />
              <Text style={styles.statusText}>{status.text}</Text>
            </LinearGradient>
            
            <View style={styles.lastUpdated}>
              <Text>From :</Text>
              {/* <Feather name="clock" size={14} color={COLORS.textSecondary} /> */}
              <Text style={styles.lastUpdatedText}>
                
                {formatTimestamp(item.ts_off || item.ts)}
              </Text>
            </View>
          </View>
          
          <View style={styles.utilizationContainer}>
            <View style={styles.utilizationHeader}>
              <Text style={styles.utilizationLabel}>UTILIZATION</Text>
              <Text style={styles.utilizationPercent}>{utilization.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <LinearGradient
                colors={['#4FD1C5', '#38B2AC']}
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, utilization)}%` }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {/* Utilization Bar Markings */}
              <View style={styles.progressBarMarkings}>
                {[0, 25, 50, 75, 100].map((mark) => (
                  <View key={mark} style={[styles.progressBarMark, { left: `${mark}%` }]}>
                    <View style={styles.progressBarMarkLine} />
                    <Text style={styles.progressBarMarkText}>{mark}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <MaterialCommunityIcons 
                name="timer-outline" 
                size={20} 
                color={COLORS.textSecondary} 
              />
              <Text style={styles.metricText}>{activeMinutes} min active</Text>
            </View>
            <Text style={styles.machineContributionText}>
              Contribution:
              {contributionPercentage}%
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const MachineDashboard = ({ navigation }) => {
  const [machines, setMachines] = useState([]);
  const [machineStatusMap, setMachineStatusMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(true);
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  const fetchUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (e) {
      console.error("Failed to load user:", e);
    }
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
      console.error(`Failed fetching status for ${gfrid}:`, err);
      return null;
    }
  };
  
  const fetchMachines = async () => {
    setRefreshing(true);
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
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchUser();
    fetchMachines();
    
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 600,
        delay: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
    
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (showSearch) {
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setSearchQuery(''));
    }
  }, [showSearch]);

  const filteredMachines = machines.filter(machine =>
    machine.gfrid.toString().includes(searchQuery) ||
    (machine.name && machine.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate machine contributions for all machines once to pass to MachineItem
  const machineContributions = filteredMachines.map(machine => {
    const usage = machineStatusMap[machine.gfrid] || {};
    const totalActiveSeconds = filteredMachines.reduce((total, m) => {
      const u = machineStatusMap[m.gfrid] || {};
      return total + (u.on_time_sec || 0);
    }, 0);
    const contribution = totalActiveSeconds > 0 
      ? ((usage.on_time_sec || 0) / totalActiveSeconds) * 100 
      : 0;
    return {
      machine,
      contribution: contribution,
    };
  });
  
  const renderItem = ({ item, index }) => (
    <MachineItem
      item={item}
      index={index}
      machineStatusMap={machineStatusMap}
      machineContributions={machineContributions} // Pass contributions here
      navigation={navigation}
    />
  );
  
  if (loading && machines.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading machinery data...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header - Non-sticky */}
      <Animated.View style={[
        styles.headerContainer,
        {
          opacity: headerAnim,
          transform: [{
            translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0],
            }),
          }],
        },
      ]}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            {user?.avatar ? (
              <ImageBackground 
                source={{ uri: user.avatar }} 
                style={styles.avatar}
                imageStyle={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialIcons name="person" size={24} color="#FFF" />
              </View>
            )}
            <View>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.userName}>
                {user?.first_name || 'Operator'}
              </Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => setShowStats(!showStats)}
              style={styles.statsToggleButton}
            >
              <MaterialCommunityIcons 
                name={showStats ? "chart-areaspline" : "chart-areaspline-variant"} 
                size={24} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowSearch(!showSearch)}
              style={styles.searchButton}
            >
              <Ionicons 
                name={showSearch ? "close" : "search"} 
                size={24} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.dashboardTitle}>Machinery Dashboard</Text>
        <Text>★Last 1 hour</Text>
      </Animated.View>
      
      {/* Toggleable Search Bar */}
      {showSearch && (
        <Animated.View style={[
          styles.searchContainer,
          {
            opacity: searchAnim,
            transform: [{
              translateY: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            }],
          },
        ]}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search machines by ID or name..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </Animated.View>
      )}
      
      {/* Content */}
      <Animated.View style={[
        styles.contentContainer,
        { opacity: contentAnim }
      ]}>
        {filteredMachines.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="engine-outline" 
              size={60} 
              color={COLORS.textSecondary} 
            />
            <Text style={styles.emptyStateTitle}>No machines found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 
                'Try a different search term' : 
                'No machinery data available'}
            </Text>
            {searchQuery && (
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchButtonText}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredMachines}
            renderItem={renderItem}
            keyExtractor={item => item.gfrid.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={fetchMachines}
            ListHeaderComponent={
              <>
                {showStats && (
                  <>
                    <StatusSummary machines={filteredMachines} />
                    <UtilizationDistribution 
                      machines={filteredMachines} 
                      machineStatusMap={machineStatusMap} 
                    />
                  </>
                )}
              </>
            }
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  headerContainer: {
    paddingHorizontal: SPACING,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + SPACING : SPACING,
    paddingBottom: SPACING,
    backgroundColor: COLORS.background,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  avatarImage: {
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  statsToggleButton: {
    padding: 8,
    marginRight: 8,
  },
  searchButton: {
    padding: 8,
  },
  dashboardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: SPACING,
    marginBottom: SPACING,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: SPACING,
  },
  listContainer: {
    paddingBottom: SPACING * 2,
  },
  // Status Summary Styles
  statusSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusSummaryText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  // Utilization Distribution Styles
  distributionContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING,
    marginBottom: SPACING,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  overallUtilization: {
    marginBottom: 16,
  },
  overallText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  overallBar: {
    height: 10,
    backgroundColor: COLORS.divider,
    borderRadius: 5,
    overflow: 'hidden',
  },
  overallBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  distributionScroll: {
    marginHorizontal: -SPACING,
    paddingHorizontal: SPACING,
  },
  contributionItem: {
    width: 60,
    marginRight: 15,
    alignItems: 'center',
  },
  contributionBarContainer: {
    height: 100,
    width: 30,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  contributionBar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  contributionLabel: {
    marginTop: 8,
    alignItems: 'center',
  },
  contributionText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  contributionPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  contributionMinutes: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  // Machine Card Styles
  machineCardWrapper: {
    marginBottom: SPACING,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  machineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  // This statusIndicator is for the vertical bar on the left of the card
  statusIndicator: { 
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 6,
  },
  machineContent: {
    padding: SPACING,
    paddingLeft: SPACING + 10,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  machineIcon: {
    width: MACHINE_ICON_SIZE,
    height: MACHINE_ICON_SIZE,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  machineId: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  machineName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  utilizationContainer: {
    marginBottom: 16,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  utilizationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  utilizationPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: COLORS.divider,
    borderRadius: 6,
    overflow: 'visible', // Changed to 'visible' to allow markings to show
    marginBottom: 4,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressBarMarkings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarMark: {
    position: 'absolute',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  progressBarMarkText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    position: 'absolute',
    top: 15, // Position below the bar
    transform: [{ translateX: -10 }], // Adjust to center text
  },
  progressBarMarkLine: {
    width: 1,
    height: 8,
    backgroundColor: COLORS.textSecondary,
    position: 'absolute',
    top: '100%', // Starts from the bottom edge of the bar
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Aligns items to ends
    alignItems: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  machineContributionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING * 2,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  clearSearchButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  clearSearchButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
 
});

export default MachineDashboard;