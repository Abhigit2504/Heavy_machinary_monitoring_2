import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { fetchLogs, deleteLogById } from '../api/LogsApi';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';

const LogsScreen = () => {
  const [logsByDate, setLogsByDate] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [isDownloading, setIsDownloading] = useState(false);

  // Load logs on mount
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsRefreshing(true);
    try {
      const logs = await fetchLogs();
      setLogsByDate(logs);
    } catch (err) {
      Alert.alert("Error", "Failed to load logs");
      console.error('Error fetching logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const downloadLogs = async (sessionId = null) => {
    setIsDownloading(true);
    try {
      const user = await AsyncStorage.getItem('user');
      const parsedUser = JSON.parse(user);
      const token = parsedUser?.token;

      if (!token) {
        Alert.alert("Error", "Authentication required");
        return;
      }

      let url = `${BASE_URL}/api/auth/logs/download/pdf/`;
      if (sessionId) {
        url += `?session_id=${sessionId}`;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        FileSystem.documentDirectory + (sessionId ? `session_${sessionId}.pdf` : 'all_logs.pdf'),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: sessionId ? 'Share Session Report' : 'Share All Logs',
          mimeType: 'application/pdf',
        });
      } else {
        Alert.alert(
          "Download Complete",
          `PDF saved to: ${uri}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Download Failed",
        error.message || "Could not download PDF",
        [{ text: "OK" }]
      );
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    Alert.alert('Delete Log', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLogById(logId);
            await loadLogs();
          } catch (err) {
            Alert.alert("Error", "Failed to delete log");
            console.error('Delete failed:', err);
          }
        },
      },
    ]);
  };

  const openLogModal = (log) => {
    setSelectedLog(log);
    setModalVisible(true);
    modalAnimation.setValue(0);
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const closeLogModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedLog(null);
    });
  };

  const formatDuration = (start, end, log) => {
    if (!end || log.active) return 'Active Session';
    
    const diff = Math.abs(new Date(end) - new Date(start));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${days > 0 ? days + 'd ' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVisit = (visit, i) => (
    <Animatable.View 
      key={i} 
      style={styles.visit}
      animation="fadeInRight"
      duration={600}
      delay={i * 100}
    >
      <View style={styles.visitHeader}>
        <Ionicons name="document-text" size={18} color="#4A6FA5" />
        <Text style={styles.visitText}>{visit.page_name}</Text>
      </View>
      <Text style={styles.timestampText}>
        <Ionicons name="time" size={14} color="#666" /> 
        {new Date(visit.visited_at).toLocaleString()}
      </Text>
      {visit.filters_applied && Object.keys(visit.filters_applied).length > 0 && (
        <View style={styles.filtersBox}>
          <Text style={styles.filtersTitle}>FILTERS APPLIED</Text>
          {Object.entries(visit.filters_applied).slice(0, 3).map(([key, value]) => (
            <View key={key} style={styles.filterItem}>
              <Ionicons name="options" size={12} color="#666" />
              <Text style={styles.filtersText}>
                {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
              </Text>
            </View>
          ))}
          {Object.keys(visit.filters_applied).length > 3 && (
            <Text style={styles.moreFilters}>+{Object.keys(visit.filters_applied).length - 3} more</Text>
          )}
        </View>
      )}
    </Animatable.View>
  );

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
                  backgroundColor: log.logout_time ? '#FF6B6B' : '#4CAF50',
                  transform: [
                    { translateX: log.logout_time ? translateX : lineWidth / 2 - 10 },
                    { scale: !log.logout_time ? scale : 1 }
                  ],
                }
              ]}
            >
              {!log.logout_time && (
                <Ionicons name="pulse" size={10} color="#FFF" />
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
            <Ionicons 
              name={log.active ? "wifi" : "wifi-outline"} 
              size={19} 
              color={log.active ? "#4CAF50" : "#666"} 
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
                downloadLogs(log.id);
              }}
              style={styles.downloadButton}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#4A6FA5" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#4A6FA5" />
              )}
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
        <Timeline log={log} />
        <View style={styles.visitsCount}>
          <Ionicons name="document-text" size={16} color="#4A6FA5" />
          <Text style={styles.visitsCountText}>
            Visited {log.visits.length} page{log.visits.length !== 1 ? 's' : ''}
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

  // Animation styles for modal
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

  const modalBackgroundOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>
          <Ionicons name="analytics" size={24} color="#FFF" /> User Activity Logs
        </Text>
        <Text style={styles.subHeading}>Last 30 Days</Text>
        <TouchableOpacity 
          onPress={() => downloadLogs()}
          style={styles.downloadAllButton}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="download" size={20} color="#FFF" />
              <Text style={styles.downloadAllText}>Download All</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadLogs}
            colors={['#4A6FA5']}
            tintColor="#4A6FA5"
          />
        }
      >
        {Object.keys(logsByDate).length === 0 ? (
          <View style={styles.noLogsContainer}>
            <Ionicons name="file-tray" size={48} color="#CCC" />
            <Text style={styles.noLogs}>No activity logs found</Text>
            <TouchableOpacity onPress={loadLogs} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#4A6FA5" />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(logsByDate).map(([date, logs]) => {
            const d = new Date(date);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedDate = `${d.getDate().toString().padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

            return (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Ionicons name="calendar" size={18} color="#4A6FA5" />
                  <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
                {logs.map(renderLog)}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeLogModal}
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
              ] 
            }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Session Details</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                onPress={() => downloadLogs(selectedLog?.id)} 
                style={styles.downloadButtonModal}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                    <Text style={styles.downloadButtonText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeLogModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView style={styles.modalScroll}>
            <View style={styles.sessionInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={18} color="#4A6FA5" />
                <Text style={styles.infoText}>
                  Login: {new Date(selectedLog?.login_time).toLocaleString()}
                </Text>
              </View>
              
              {selectedLog?.logout_time && (
                <View style={styles.infoRow}>
                  <Ionicons name="time" size={18} color="#4A6FA5" />
                  <Text style={styles.infoText}>
                    Logout: {new Date(selectedLog.logout_time).toLocaleString()}
                  </Text>
                </View>
              )}
              
              <View style={styles.infoRow}>
                <Ionicons name="desktop" size={18} color="#4A6FA5" />
                <Text style={styles.infoText}>Device: {selectedLog?.device_info}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="globe" size={18} color="#4A6FA5" />
                <Text style={styles.infoText}>IP: {selectedLog?.ip_address}</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="hourglass" size={18} color="#4A6FA5" />
                <Text style={styles.infoText}>
                  Duration: {formatDuration(selectedLog?.login_time, selectedLog?.logout_time, selectedLog)}
                </Text>
              </View>
            </View>
            
            <View style={styles.visitsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text" size={20} color="#4A6FA5" />
                <Text style={styles.sectionTitle}>Pages Visited ({selectedLog?.visits?.length || 0})</Text>
              </View>
              
              {selectedLog?.visits?.length > 0 ? (
                selectedLog.visits.map(renderVisit)
              ) : (
                <View style={styles.noVisitsContainer}>
                  <Ionicons name="folder-open" size={32} color="#CCC" />
                  <Text style={styles.noVisitsText}>No page visits recorded</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#4A6FA5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  subHeading: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  downloadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 20,
    marginTop: 5,
    alignSelf: 'center',
  },
  downloadAllText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A6FA5',
    marginLeft: 8,
  },
  logCardContainer: {
    marginBottom: 16,
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
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    marginBottom: 12,
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
    backgroundColor: 'rgba(0,0,0,0.05)',
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
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  activeBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  visitsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  visitsCountText: {
    fontSize: 13,
    color: '#4A6FA5',
    marginLeft: 8,
    fontWeight: '500',
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
  visit: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4A6FA5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 24,
    marginBottom: 6,
  },
  filtersBox: {
    backgroundColor: '#F5F7FA',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  filtersTitle: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#4A6FA5',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  filtersText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
  },
  moreFilters: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
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
    flex: 1,
    backgroundColor: '#F8F9FA',
    margin: 20,
    borderRadius: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
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
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  sessionInfo: {
    backgroundColor: '#FFF',
    borderRadius: 12,
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
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  visitsSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
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
});

export default LogsScreen;