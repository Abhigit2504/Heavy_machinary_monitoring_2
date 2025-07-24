
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking,
  TextInput,
  FlatList,
  Dimensions,
  SafeAreaView
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ScreenOrientation from 'expo-screen-orientation';
import axios from 'axios';
import * as Animatable from 'react-native-animatable';

const LogsScreen = ({ navigation }) => {
  const [logsByDate, setLogsByDate] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [backgroundAnimation] = useState(new Animated.Value(0));
  const [isDownloading, setIsDownloading] = useState(false);
  const [filteredVisits, setFilteredVisits] = useState([]);
  const [searchText, setSearchText] = useState('');
 const [startDate, setStartDate] = useState(null);
const [endDate, setEndDate] = useState(null);
const [startTime, setStartTime] = useState(null);
const [endTime, setEndTime] = useState(null);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [error, setError] = useState(null);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const modalScale = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const modalOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalBackgroundOpacity = backgroundAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const getAuthHeaders = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (!user) return null;
      
      const parsedUser = JSON.parse(user);
      if (!parsedUser || !parsedUser.token) return null;
      
      return {
        headers: {
          'Authorization': `Bearer ${parsedUser.token}`,
          'Content-Type': 'application/json'
        }
      };
    } catch (error) {
      return null;
    }
  };

  const loadLogs = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error('Authentication required');
      }

      const response = await axios.get(`${BASE_URL}/api/auth/logs/`, headers);
      
      if (typeof response.data !== 'object' || response.data === null) {
        throw new Error('Invalid logs format received from API');
      }

      const formattedLogs = {};
      Object.keys(response.data).forEach(date => {
        formattedLogs[date] = response.data[date].map(log => ({
          ...log,
          id: log.id || Math.random().toString(36).substring(7),
          login_time: log.login_time,
          logout_time: log.logout_time || null,
          ip_address: log.ip_address || 'Unknown IP',
          device_info: log.device_info || 'Unknown Device',
          visits: (log.visits || []).sort((a, b) => 
            new Date(b.visited_at) - new Date(a.visited_at)
          ),
          active: log.is_active || false
        }));
      });

      setLogsByDate(formattedLogs);
    } catch (err) {
      setError(err.message || 'Failed to load logs');
      setLogsByDate({});
    } finally {
      setIsRefreshing(false);
    }
  };

  const filterVisits = () => {
    if (!selectedLog) return;
    
    let visits = [...(selectedLog.visits || [])];
    
 if (!startDate || !endDate || !startTime || !endTime) {
  setFilteredVisits(visits); // Skip date/time filtering
  return;
}

const startDateTime = new Date(
  startDate.getFullYear(),
  startDate.getMonth(),
  startDate.getDate(),
  startTime.getHours(),
  startTime.getMinutes()
);

const endDateTime = new Date(
  endDate.getFullYear(),
  endDate.getMonth(),
  endDate.getDate(),
  endTime.getHours(),
  endTime.getMinutes()
);

    
    visits = visits.filter(visit => {
      const visitDate = new Date(visit.visited_at);
      return visitDate >= startDateTime && visitDate <= endDateTime;
    });

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      visits = visits.filter(visit => {
        const visitDate = formatDate(visit.visited_at).toLowerCase();
        if (visitDate.includes(searchLower)) return true;
        
        if (visit.grid_id && visit.grid_id.toLowerCase().includes(searchLower)) return true;
        if (visit.grid_name && visit.grid_name.toLowerCase().includes(searchLower)) return true;
        if (visit.grid_location && visit.grid_location.toLowerCase().includes(searchLower)) return true;
        
        return (
          (visit.page_name && visit.page_name.toLowerCase().includes(searchLower)) ||
          (visit.filters_applied && JSON.stringify(visit.filters_applied).toLowerCase().includes(searchLower))
        );
      });
    }

    setFilteredVisits(visits);
  };

  useEffect(() => {
    if (selectedLog) {
      filterVisits();
    }
  }, [selectedLog, startDate, endDate, startTime, endTime, searchText]);

  const formatFilters = (filters) => {
    if (!filters) return 'None';
    
    try {
      const filtersObj = typeof filters === 'string' ? JSON.parse(filters) : filters;
      
      if (filtersObj.time) {
        switch(filtersObj.time) {
          case 'all': return 'All Time';
          case 'today': return 'Today';
          case 'week': return 'This Week';
          case 'month': return 'This Month';
          case 'year': return 'This Year';
          default: 
            if (Array.isArray(filtersObj.time)) {
              return `Time Range: ${filtersObj.time[0]} to ${filtersObj.time[1]}`;
            }
        }
      }
      
      return Object.entries(filtersObj)
        .map(([key, value]) => {
          if (key === 'time') return null;
          return `${key}: ${JSON.stringify(value)}`;
        })
        .filter(Boolean)
        .join(', ') || 'No additional filters';
    } catch (e) {
      return typeof filters === 'string' ? filters : 'Complex filters';
    }
  };

  const handleDownloadPress = (logId) => {
    navigation.navigate('DownloadScreen', {
      sessionId: logId,
      searchText,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  };

  const handleDeleteLog = async (logId) => {
    Alert.alert('Delete Log', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            if (!headers) {
              throw new Error('Authentication required');
            }
            
            await axios.delete(`${BASE_URL}/api/auth/logs/${logId}/`, headers);
            await loadLogs();
            closeLogModal();
          } catch (err) {
            Alert.alert("Error", "Failed to delete log");
          }
        },
      },
    ]);
  };

  const openLogModal = async (log) => {
    try {
      if (Platform.OS !== 'web') {
        await ScreenOrientation.unlockAsync();
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      
      setSelectedLog(log);
      setFilteredVisits(log.visits || []);
      setModalVisible(true);
      setShowFilters(false);
      setShowSearch(false);
      modalAnimation.setValue(0);
      backgroundAnimation.setValue(0);
      Animated.parallel([
        Animated.spring(modalAnimation, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
        }),
        Animated.timing(backgroundAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } catch (error) {
      Alert.alert("Error", "Failed to open log details");
    }
  };

  const closeLogModal = async () => {
    try {
      if (Platform.OS !== 'web') {
        await ScreenOrientation.unlockAsync();
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      }
      
      Animated.parallel([
        Animated.timing(modalAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        setModalVisible(false);
        setSelectedLog(null);
        setSearchText('');
        setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        setEndDate(new Date());
        setShowFilters(false);
        setShowSearch(false);
      });
    } catch (error) {
      Alert.alert("Error", "Failed to close log details");
    }
  };

  const formatDuration = (start, end, log) => {
    if (!end || log?.active) return 'Active Session';
    
    const diff = Math.abs(new Date(end) - new Date(start));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${days > 0 ? days + 'd ' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const Timeline = ({ log }) => {
    const animValue = new Animated.Value(0);
    const lineWidth = Dimensions.get('window').width - 100;
    
    useEffect(() => {
      if (log.active || !log.logout_time) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        Animated.timing(animValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start();
      }
    }, []);

    const translateX = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, lineWidth - 20],
    });

    const scale = animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.3, 1],
    });

    return (
      <View style={styles.timelineWrapper}>
        <View style={styles.timelineRow}>
          <View style={[styles.timelineNode, styles.startNode]}>
            <Ionicons name="log-in" size={12} color="white" />
          </View>
          <View style={styles.timelineLineContainer}>
            <View style={[styles.timelineLine, !log.logout_time && styles.timelineLinePartial]} />
            <Animated.View 
              style={[
                styles.animatedCircle,
                { 
                  backgroundColor: log.logout_time ? '#FF6B6B' : '#FFD700',
                  transform: [
                    { translateX: log.logout_time ? translateX : lineWidth / 2 - 10 },
                    { scale: !log.logout_time ? scale : 1 }
                  ],
                }
              ]}
            >
              {!log.logout_time && (
                <Ionicons name="pulse" size={10} color="#000" />
              )}
            </Animated.View>
          </View>
          {log.logout_time && (
            <View style={[styles.timelineNode, styles.endNode]}>
              <Ionicons name="log-out" size={12} color="white" />
            </View>
          )}
        </View>
        <View style={styles.timelineLabels}>
          <Text style={styles.timelineLabel}>{new Date(log.login_time).toLocaleTimeString()}</Text>
          <Text style={styles.timelineDuration}>
            {formatDuration(log.login_time, log.logout_time, log)}
          </Text>
          {log.logout_time && (
            <Text style={styles.timelineLabel}>
              {new Date(log.logout_time).toLocaleTimeString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderVisitItem = ({ item }) => (
    <View style={styles.visitRow}>
      <Text style={[styles.visitCell, styles.pageNameCell]} numberOfLines={1}>
        {item.page_name || 'Unknown Page'}
      </Text>
      <Text style={[styles.visitCell, styles.dateCell]} numberOfLines={1}>
        {formatDate(item.visited_at)} {formatTime(item.visited_at)}
      </Text>
      <Text style={[styles.visitCell, styles.filtersCell]} numberOfLines={2}>
        {formatFilters(item.filters_applied)}
      </Text>
    </View>
  );

  const renderLog = (log, index) => (
    <Animatable.View 
      animation="fadeInUp" 
      duration={600} 
      delay={index * 100} 
      key={log.id}
      style={styles.logCardContainer}
    >
      <TouchableOpacity 
        onPress={() => openLogModal(log)} 
        activeOpacity={0.8}
        style={[
          styles.logCard, 
          log.active && styles.activeLogCard
        ]}
      >
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <MaterialIcons 
              name={log.active ? "wifi" : "wifi"} 
              size={19} 
              color={log.active ? "#4CAF50" : "black"} 
              style={styles.wifiIcon}
            />
            
            <Text style={styles.sessionText}>
              {log.ip_address} | {log.device_info}
            </Text>
          </View>
          
          <View style={styles.logHeaderRight}>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                handleDownloadPress(log.id);
              }}
              style={styles.downloadButton}
            >
              <Ionicons name="download-outline" size={20} color="#4A6FA5" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteLog(log.id);
              }}
              style={styles.deleteButton}
            >
              <Ionicons name="trash" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
        <View>
          <Text style={styles.sessionidstyle}>Session ID: {log.id}</Text>
        </View>
        
        <Timeline log={log} />
        
        <View style={styles.visitsCount}>
          <Ionicons name="document-text" size={16} color="#4A6FA5" />
          <Text style={styles.visitsCountText}>
            {log.visits?.length || 0} page{(log.visits?.length || 0) !== 1 ? 's' : ''} visited
          </Text>
          {log.active && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderModalContent = () => (
    <View style={styles.modalContent}>
      <View style={styles.sessionInfo}>
        <View>
          <Text style={styles.sessionidstyle}>
            <Ionicons name="key" size={18} color="#4A6FA5" />
            Session ID: {selectedLog?.id}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={18} color="#4A6FA5" />
          <Text style={styles.infoText}>
            Login: {formatDate(selectedLog?.login_time)} {formatTime(selectedLog?.login_time)}
          </Text>
        </View>
        
        {selectedLog?.logout_time && (
          <View style={styles.infoRow}>
            <Ionicons name="time" size={18} color="#4A6FA5" />
            <Text style={styles.infoText}>
              Logout: {formatDate(selectedLog.logout_time)} {formatTime(selectedLog.logout_time)}
            </Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Ionicons name="desktop" size={18} color="#4A6FA5" />
          <Text style={styles.infoText}>Device: {selectedLog?.device_info}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="hourglass" size={18} color="#4A6FA5" />
          <Text style={styles.infoText}>
            Duration: {formatDuration(selectedLog?.login_time, selectedLog?.logout_time, selectedLog)}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons name="search" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Search</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by date, grid ID, location, or page..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#999"
          />
        </View>
      )}

      {showFilters && (
        <View style={styles.dateFilterContainer}>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
  From: {startDate ? `${formatDate(startDate)} ${formatTime(startTime)}` : 'Select start date & time'}
</Text>

          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowEndDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
  To: {endDate ? `${formatDate(endDate)} ${formatTime(endTime)}` : 'Select end date & time'}
</Text>

          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.visitRow, styles.tableHeader]}>
        <Text style={[styles.visitCell, styles.pageNameCell, styles.headerCell]}>Pages Visited</Text>
        <Text style={[styles.visitCell, styles.dateCell, styles.headerCell]}>Date & Time</Text>
        <Text style={[styles.visitCell, styles.filtersCell, styles.headerCell]}>Filters</Text>
      </View>

      <FlatList
        data={filteredVisits}
        renderItem={renderVisitItem}
        keyExtractor={(item, index) => `visit-${index}`}
        style={styles.tableBody}
        contentContainerStyle={styles.tableBodyContent}
        ListEmptyComponent={
          <View style={styles.noVisitsContainer}>
            <Ionicons name="folder-open" size={32} color="#CCC" />
            <Text style={styles.noVisitsText}>No matching visits found</Text>
          </View>
        }
      />
    </View>
  );

  const renderDateGroup = ({ item: [date, logs] }) => {
    return (
      <View key={date} style={styles.dateGroup}>
        <View style={styles.dateHeader}>
          <Ionicons name="calendar" size={18} color="#4A6FA5" />
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>
        {logs.map(renderLog)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>
          <FontAwesome name="gears" size={24} color="white" /> User Activity Logs
        </Text>
      </View>
      
      <FlatList
        style={styles.scrollContainer}
        data={Object.entries(logsByDate).sort(([dateA], [dateB]) => 
          new Date(dateB) - new Date(dateA)
        )}
        keyExtractor={(item) => item[0]}
        renderItem={renderDateGroup}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadLogs}
            colors={['#4A6FA5']}
            tintColor="#4A6FA5"
          />
        }
        ListEmptyComponent={
          <View style={styles.noLogsContainer}>
            <Ionicons name="file-tray" size={48} color="#CCC" />
            <Text style={styles.noLogs}>No activity logs found</Text>
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <TouchableOpacity onPress={loadLogs} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#4A6FA5" />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeLogModal}
        supportedOrientations={['landscape']}
      >
        <Animated.View style={[styles.modalBackground, { opacity: modalBackgroundOpacity }]} />
        
        <Animated.View 
          style={[
            styles.modalContainer, 
            { 
              opacity: modalOpacity,
              transform: [
                { scale: modalScale },
                { translateY: modalTranslateY }
              ],
              width: dimensions.width,
              height: dimensions.height,
            }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Session Details - {selectedLog?.ip_address}</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                onPress={() => handleDownloadPress(selectedLog?.id)} 
                style={styles.downloadButtonModal}
              >
                <Ionicons name="download-outline" size={20} color="#FFF" />
                <Text style={styles.downloadButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeLogModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <FlatList
            data={[1]}
            renderItem={renderModalContent}
            keyExtractor={() => 'modal-content'}
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
          />
        </Animated.View>
      </Modal>

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
              setShowStartTimePicker(true);
            }
          }}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) setStartTime(selectedTime);
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
              setShowEndTimePicker(true);
            }
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) setEndTime(selectedTime);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf3f6ff',
  },
  header: {
    backgroundColor: '#4A6FA5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  sessionidstyle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: "900",
    textAlign: 'center'
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateGroup: {
    marginBottom: 10,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#4d3671ff',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a4976ff',
    marginLeft: 8,
  },
  logCardContainer: {
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  logCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0ff',
  },
  activeLogCard: {
    borderColor: '#4CAF50',
    borderWidth: 1.5,
    backgroundColor: '#F5FFF5',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wifiIcon: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 4, 4, 0.11)',
  },
  sessionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  downloadButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  activeBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  activeBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  visitsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  visitsCountText: {
    fontSize: 13,
    color: '#2d4a76ff',
    marginLeft: 8,
    fontWeight: '500',
  },
  noLogsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noLogs: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(74,111,165,0.1)',
  },
  refreshText: {
    fontSize: 14,
    color: '#4A6FA5',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  modalContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: '#4A6FA5',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 15,
  },
  downloadButtonText: {
    color: '#FFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sessionInfo: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4A6FA5',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateButton: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#1976D2',
    fontWeight: '500',
  },
  tableBody: {
    flex: 1,
  },
  tableBodyContent: {
    flexGrow: 1,
  },
  tableHeader: {
    backgroundColor: '#4A6FA5',
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  visitRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  visitCell: {
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4
  },
  pageNameCell: {
    flex: 2,
    fontWeight: '500',
  },
  filtersCell: {
    flex: 3,
    fontSize: 12,
    color: '#666',
    paddingRight: 8,
    marginLeft:30
  },
  gridCell: {
    flex: 1.5,
    fontSize: 12,
    color: '#4A6FA5',
  },
  noVisitsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noVisitsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  timelineWrapper: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  timelineLineContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginHorizontal: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  startNode: {
    backgroundColor: '#4CAF50',
  },
  endNode: {
    backgroundColor: '#F44336',
  },
  timelineLine: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  timelineLinePartial: {
    width: '100%',
    backgroundColor: '#E0E0E0',
  },
  animatedCircle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timelineLabel: {
    fontSize: 12,
    color: '#757575',
    flex: 1,
    textAlign: 'center',
  },
  timelineDuration: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#424242',
    flex: 2,
    textAlign: 'center',
  },
});

export default LogsScreen;