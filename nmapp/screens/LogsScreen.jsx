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
} from 'react-native';
import {
  fetchLogs,
  deleteLogById,
} from '../api/LogsApi';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';

const LogsScreen = () => {
  const [logsByDate, setLogsByDate] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const logs = await fetchLogs();
      setLogsByDate(logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
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
            console.error('Delete failed:', err);
          }
        },
      },
    ]);
  };

  const openLogModal = (log) => {
    setSelectedLog(log);
    setModalVisible(true);
  };

  const closeLogModal = () => {
    setSelectedLog(null);
    setModalVisible(false);
  };

 const formatDuration = (start, end, log) => {
  if (!end || log.active) return 'Active Session';


    
    const diff = Math.abs(new Date(end) - new Date(start));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${days.toString().padStart(2, '0')} days ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVisit = (visit, i) => (
    <View key={i} style={styles.visit}>
      <Text style={styles.visitText}><Ionicons name="arrow-forward-circle" size={14} /> {visit.page_name}</Text>
      <Text style={styles.timestampText}>Visited at: {new Date(visit.visited_at).toLocaleString()}</Text>
      {visit.filters_applied && Object.keys(visit.filters_applied).length > 0 && (
        <View style={styles.filtersBox}>
          <Text style={styles.filtersTitle}>Filters:</Text>
          {Object.entries(visit.filters_applied).map(([key, value]) => (
            <Text key={key} style={styles.filtersText}>
              • {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  const Timeline = ({ log }) => {
    const animValue = new Animated.Value(0);
    const lineWidth = Dimensions.get('window').width - 80; // Adjusted to prevent overflow
    
    useEffect(() => {
      if (log.active || !log.logout_time) {
 
        // Active session - pulse animation in the middle
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
        // Completed session - slide from left to right
        Animated.timing(animValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start();
      }
    }, []);

    const translateX = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, lineWidth - 20], // Adjusted to stay within container
    });

    const scale = animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.2, 1],
    });

    return (
      <View style={styles.timelineWrapper}>
        <View style={styles.timelineRow}>
          <View style={[styles.timelineNode, styles.startNode]} />
          <View style={styles.timelineLineContainer}>
            <View style={[styles.timelineLine, !log.logout_time && styles.timelineLinePartial]} />
            <Animated.View 
              style={[
                styles.animatedCircle,
                { 
                  backgroundColor: log.logout_time ? '#FF0000' : '#FFD700',
                  transform: [
                    { translateX: log.logout_time ? translateX : lineWidth / 2 - 10 },
                    { scale: !log.logout_time ? scale : 1 }
                  ],
                }
              ]}
            />
          </View>
          {log.logout_time && <View style={[styles.timelineNode, styles.endNode]} />}
        </View>
        <View style={styles.timelineLabels}>
          <Text style={styles.timelineLabel}>{new Date(log.login_time).toLocaleTimeString()}</Text>
          <Text style={styles.timelineDuration}>
            {formatDuration(log.login_time, log.logout_time, log)}

          </Text>
          <Text style={styles.timelineLabel}>
            {log.logout_time ? new Date(log.logout_time).toLocaleTimeString() : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderLog = (log, index) => (
    <Animatable.View animation="fadeInUp" duration={600} delay={index * 100} key={log.id}>
      <TouchableOpacity onPress={() => openLogModal(log)} activeOpacity={0.9}>
        <View style={[styles.logCard, log.active && { borderColor: '#FFD700', borderWidth: 2 }]}>
          <View style={styles.logHeader}>
            <Text style={styles.sessionText}>
              <Ionicons name="laptop-outline" size={14} /> {log.ip_address} | {log.device_info}
            </Text>
            <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
              <Ionicons name="trash-outline" size={20} color="red" />
            </TouchableOpacity>
          </View>
          <Timeline log={log} />
          <Text style={styles.sectionTitle}>Visited Pages: {log.visits.length}</Text>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}><Ionicons name="analytics-outline" size={22} /> User Logs (Last 30 Days)</Text>
      {Object.keys(logsByDate).length === 0 ? (
        <Text style={styles.noLogs}>No logs found.</Text>
      ) : (
        Object.entries(logsByDate).map(([date, logs]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateText}><Ionicons name="calendar" size={16} /> {date}</Text>
            {logs.map(renderLog)}
          </View>
        ))
      )}

      <Modal
  visible={isModalVisible}
  animationType="fade"
  transparent={true}
  onRequestClose={closeLogModal}
>
  <View style={styles.modalBackground}>
    <Animatable.View animation="zoomIn" duration={400} style={styles.modalContent}>
      {/* Close Button */}
      <TouchableOpacity onPress={closeLogModal} style={styles.modalCloseButton}>
        <Ionicons name="close-circle" size={28} color="#333" />
      </TouchableOpacity>

      <ScrollView>
        <Text style={styles.modalTitle}><Ionicons name="document-text-outline" size={20} /> Session Details</Text>
        <Text style={styles.modalSubtitle}>IP: {selectedLog?.ip_address} | Device: {selectedLog?.device_info}</Text>
        <Text style={styles.modalText}>Login: {new Date(selectedLog?.login_time).toLocaleString()}</Text>
        {selectedLog?.logout_time && (
          <Text style={styles.modalText}>Logout: {new Date(selectedLog.logout_time).toLocaleString()}</Text>
        )}

        <Text style={styles.sectionTitle}>Pages Visited</Text>
        {selectedLog?.visits?.length > 0 ? (
          selectedLog.visits.map(renderVisit)
        ) : (
          <Text style={styles.noVisits}>No visits found.</Text>
        )}
      </ScrollView>
    </Animatable.View>
  </View>
</Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FAFAFA',
    marginTop:40
   },
  heading: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: '#000' },
  dateGroup: { marginBottom: 24 },
  dateText: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 8 },
  logCard: {
    backgroundColor: '#cfdfe3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sessionText: { fontSize: 13, color: '#333', flex: 1 },
  sectionTitle: { marginTop: 10, fontWeight: 'bold', color: '#000', marginBottom: 6 },
  visit: { marginBottom: 10, paddingLeft: 12 },
  visitText: { fontSize: 14, fontWeight: '600', color: '#000' },
  timestampText: { fontSize: 12, color: '#666', paddingLeft: 6 },
  filtersText: { fontSize: 12, color: '#666', paddingLeft: 10 },
  noVisits: { fontSize: 13, fontStyle: 'italic', color: '#999', marginLeft: 10 },
  noLogs: { textAlign: 'center', marginTop: 30, fontSize: 15, color: '#999' },
  modalBackground: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', 
    paddingHorizontal: 16 
  },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 20, 
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  modalCloseButton: {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 10,
},

  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#000', 
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingBottom: 8,
  },
  modalSubtitle: { 
    fontSize: 17, 
    color: '#333', 
    marginBottom: 8 ,
    fontWeight: 'bold' 
  },
  modalText: {
    color: '#000',
    marginBottom: 4,
  },
 
  timelineWrapper: { 
    backgroundColor: 'white', 
    marginVertical: 16,
    paddingHorizontal: 4,
    borderRadius:20,
    padding:15
  },
  timelineRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    height: 24,
  },
  timelineLineContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginHorizontal: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timelineNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  startNode: {
    backgroundColor: '#4CAF50',
  },
  endNode: {
    backgroundColor: '#F44336',
  },
  timelineLine: {
    height: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
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
    shadowRadius: 3,
    elevation: 4,
    left: 0,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timelineLabel: {
    fontSize: 12,
    color: '#757575',
    flex: 1,
    textAlign: 'center',
  },
  timelineDuration: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#424242',
    flex: 2,
    textAlign: 'center',
  },
  filtersBox: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  filtersTitle: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
});

export default LogsScreen;