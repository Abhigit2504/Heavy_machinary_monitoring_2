import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import dayjs from 'dayjs';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { recordVisit } from '../api/LogsApi';
import { BASE_URL } from '../config';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

const DownloadScreen = ({ navigation, route }) => {
  const [reportCategory, setReportCategory] = useState('machine');
  const [downloadType, setDownloadType] = useState('all');
  const [machineId, setMachineId] = useState('');
  const [sessionId, setSessionId] = useState(route.params?.sessionId || '');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showPicker, setShowPicker] = useState({ from: false, to: false });
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  
  const [notification, setNotification] = useState({
    visible: false,
    message: '',
    type: '', // 'success' or 'error'
    icon: ''
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    recordVisit('DownloadScreen', {
      from: fromDate ? dayjs(fromDate).toISOString() : null,
      to: toDate ? dayjs(toDate).toISOString() : null,
      reportCategory,
      downloadType,
    });
  }, [fromDate, toDate, reportCategory, downloadType]);

  const showNotification = (message, type, icon) => {
    setNotification({
      visible: true,
      message,
      type,
      icon
    });
    
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  const handleDownload = async () => {
    if (!isConnected) {
      showNotification('No internet connection', 'error', 'wifi-off');
      return;
    }

    if (!fromDate || !toDate) {
      showNotification('Please select both dates', 'error', 'calendar');
      return;
    }

    const dateDiff = dayjs(toDate).diff(dayjs(fromDate), 'day');
    if (dateDiff > 30) {
      showNotification('Maximum time range is 30 days', 'error', 'calendar');
      return;
    }
    if (dateDiff < 0) {
      showNotification('End date must be after start date', 'error', 'calendar');
      return;
    }

    if (reportCategory === 'machine' && downloadType === 'byId' && !machineId.trim()) {
      showNotification('Machine ID is required', 'error', 'barcode');
      return;
    }

    if (reportCategory === 'session' && downloadType === 'bySession' && !sessionId.trim()) {
      showNotification('Session ID is required', 'error', 'time');
      return;
    }

    setLoading(true);
    setGeneratingPdf(true);

    try {
      const user = await AsyncStorage.getItem('user');
      if (!user) throw new Error('User not authenticated');
      
      const parsedUser = JSON.parse(user);
      const token = parsedUser?.token;
      if (!token) throw new Error('Authentication token missing');

      const params = {
        from_date: dayjs(fromDate).utc().format('YYYY-MM-DDTHH:mm:ss[Z]'),
        to_date: dayjs(toDate).utc().format('YYYY-MM-DDTHH:mm:ss[Z]'),
      };

      let endpoint;
      if (reportCategory === 'machine') {
        endpoint = downloadType === 'all' 
          ? '/api/download/all-machines-pdf/' 
          : `/api/download/machine/${machineId}/pdf/`;
      } else {
        endpoint = '/api/auth/logs/download/pdf/';
        if (downloadType === 'bySession') {
          params.session_id = sessionId;
        }
      }

      const queryParams = new URLSearchParams(params);
      const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;

      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob',
        timeout: 30000,
      });

      const filename = `report_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(response.data);
      });

      await FileSystem.writeAsStringAsync(fileUri, base64data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: reportCategory === 'machine' ? 'Machine Report' : 'Session Activity Report',
        UTI: 'com.adobe.pdf'
      });

      showNotification('Report downloaded successfully!', 'success', 'checkmark-circle');
    } catch (error) {
      console.error('Download failed:', error);
      let errorMessage = 'Failed to download report';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Session expired. Please login again.';
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showNotification(errorMessage, 'error', 'alert-circle');
    } finally {
      setLoading(false);
      setGeneratingPdf(false);
    }
  };

  const renderDownloadOptions = () => {
    if (reportCategory === 'machine') {
      return (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.optionBtn, downloadType === 'all' && styles.optionBtnActive]}
            onPress={() => setDownloadType('all')}
          >
            <Ionicons
              name="albums-outline"
              size={20}
              color={downloadType === 'all' ? 'white' : '#1E40AF'}
            />
            <Text style={[styles.optionText, downloadType === 'all' && styles.optionTextActive]}>
              All Machines
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionBtn, downloadType === 'byId' && styles.optionBtnActive]}
            onPress={() => setDownloadType('byId')}
          >
            <Ionicons
              name="barcode-outline"
              size={20}
              color={downloadType === 'byId' ? 'white' : '#1E40AF'}
            />
            <Text style={[styles.optionText, downloadType === 'byId' && styles.optionTextActive]}>
              By Machine ID
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.optionBtn, downloadType === 'all' && styles.optionBtnActive]}
            onPress={() => setDownloadType('all')}
          >
            <Ionicons
              name="list-outline"
              size={20}
              color={downloadType === 'all' ? 'white' : '#1E40AF'}
            />
            <Text style={[styles.optionText, downloadType === 'all' && styles.optionTextActive]}>
              All Sessions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionBtn, downloadType === 'bySession' && styles.optionBtnActive]}
            onPress={() => setDownloadType('bySession')}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={downloadType === 'bySession' ? 'white' : '#1E40AF'}
            />
            <Text style={[styles.optionText, downloadType === 'bySession' && styles.optionTextActive]}>
              By Session
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  const renderInputField = () => {
    if (reportCategory === 'machine' && downloadType === 'byId') {
      return (
        <Animatable.View animation="bounceIn" delay={250}>
          <TextInput
            style={styles.input}
            placeholder="Enter Machine ID (e.g., 1001)"
            keyboardType="numeric"
            value={machineId}
            onChangeText={setMachineId}
          />
        </Animatable.View>
      );
    } else if (reportCategory === 'session' && downloadType === 'bySession') {
      return (
        <Animatable.View animation="bounceIn" delay={250}>
          <TextInput
            style={styles.input}
            placeholder="Enter Session ID"
            value={sessionId}
            onChangeText={setSessionId}
            editable={!route.params?.sessionId}
          />
        </Animatable.View>
      );
    }
    return null;
  };

  return (
    <LinearGradient 
      colors={['#f7f9fc', '#e3f2fd']}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Animatable.View 
            animation="fadeInUp" 
            duration={700} 
            style={styles.container}
          >
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="document-text" size={32} color="#1E40AF" />
              <Text style={styles.title}>Report Download</Text>
              <Text style={styles.subtitle}>Generate and download detailed reports</Text>
            </View>

            {/* Report Category Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Report Type</Text>
              <View style={styles.categoryToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.categoryBtn, 
                    reportCategory === 'machine' && styles.categoryBtnActive
                  ]}
                  onPress={() => setReportCategory('machine')}
                >
                  <Ionicons
                    name="hardware-chip-outline"
                    size={22}
                    color={reportCategory === 'machine' ? 'white' : '#1E40AF'}
                  />
                  <Text style={[
                    styles.categoryText, 
                    reportCategory === 'machine' && styles.categoryTextActive
                  ]}>
                    Machine Report
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryBtn, 
                    reportCategory === 'session' && styles.categoryBtnActive
                  ]}
                  onPress={() => setReportCategory('session')}
                >
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={reportCategory === 'session' ? 'white' : '#1E40AF'}
                  />
                  <Text style={[
                    styles.categoryText, 
                    reportCategory === 'session' && styles.categoryTextActive
                  ]}>
                    Session Activity
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Range Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date Range</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity 
                  onPress={() => setShowPicker({ from: true })} 
                  style={styles.dateBtn}
                >
                  <Ionicons name="calendar-outline" size={20} color="#1E40AF" />
                  <Text style={styles.dateText}>
                    {fromDate ? dayjs(fromDate).format('DD MMM YYYY') : 'From Date'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.dateSeparator}>
                  <Ionicons name="arrow-forward" size={16} color="#64748B" />
                </View>
                <TouchableOpacity 
                  onPress={() => setShowPicker({ to: true })} 
                  style={styles.dateBtn}
                >
                  <Ionicons name="calendar-outline" size={20} color="#1E40AF" />
                  <Text style={styles.dateText}>
                    {toDate ? dayjs(toDate).format('DD MMM YYYY') : 'To Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Report Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {reportCategory === 'machine' ? 'Machine Selection' : 'Session Selection'}
              </Text>
              {renderDownloadOptions()}
            </View>

            {/* Dynamic Input Field */}
            {renderInputField()}

            {/* Download Button */}
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownload}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={22} color="white" />
                  <Text style={styles.downloadButtonText}>Download Report</Text>
                </>
              )}
            </TouchableOpacity>

            {/* History Link */}
            <TouchableOpacity 
              style={styles.historyLink}
              onPress={() => navigation.navigate('HistoryScreen')}
            >
              <Text style={styles.historyLinkText}>
                <Ionicons name="time-outline" size={16} /> View Download History
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>

        {/* Notification Toast */}
        {notification.visible && (
          <Animatable.View 
            animation="slideInUp"
            duration={500}
            style={[
              styles.notification,
              notification.type === 'error' 
                ? styles.errorNotification 
                : styles.successNotification
            ]}
          >
            <Ionicons 
              name={notification.icon} 
              size={24} 
              color="white" 
            />
            <Text style={styles.notificationText}>{notification.message}</Text>
          </Animatable.View>
        )}

        {/* Date Pickers */}
        <DateTimePickerModal
          isVisible={showPicker.from}
          mode="date"
          onConfirm={(date) => {
            setFromDate(date);
            setShowPicker({ from: false });
          }}
          onCancel={() => setShowPicker({ from: false })}
        />
        <DateTimePickerModal
          isVisible={showPicker.to}
          mode="date"
          minimumDate={fromDate || new Date()}
          onConfirm={(date) => {
            setToDate(date);
            setShowPicker({ to: false });
          }}
          onCancel={() => setShowPicker({ to: false })}
        />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  container: {
    padding: 24,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  categoryToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  categoryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  categoryBtnActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  categoryText: {
    color: '#1E40AF',
    fontWeight: '600',
    fontSize: 15,
  },
  categoryTextActive: {
    color: 'white',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '500',
  },
  dateSeparator: {
    padding: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  optionBtnActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  optionText: {
    color: '#1E40AF',
    fontWeight: '600',
    fontSize: 15,
  },
  optionTextActive: {
    color: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 15,
    backgroundColor: 'white',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    padding: 18,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  historyLink: {
    marginTop: 24,
    alignSelf: 'center',
  },
  historyLinkText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '500',
  },
  notification: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorNotification: {
    backgroundColor: '#EF4444',
  },
  successNotification: {
    backgroundColor: '#10B981',
  },
  notificationText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});

export default DownloadScreen;