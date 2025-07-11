// === ✅ 1. DownloadScreen.jsx (Updated + Integrated History Tracking) ===

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import dayjs from 'dayjs';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { recordVisit } from '../api/LogsApi';
import { useEffect } from 'react';


// const BASE_URL = 'http://192.168.1.4:8000';
import { BASE_URL } from '../config';


const DownloadScreen = ({ navigation }) => {
  const [downloadType, setDownloadType] = useState('all');
  const [machineId, setMachineId] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showPicker, setShowPicker] = useState({ from: false, to: false });
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);



useEffect(() => {
  recordVisit('DownloadScreen', {
    from: fromDate ? dayjs(fromDate).toISOString() : null,
    to: toDate ? dayjs(toDate).toISOString() : null,
    downloadType,
  });
}, [fromDate, toDate, downloadType]);






const handleDownload = async () => {
  if (!fromDate || !toDate) {
    Alert.alert('Error', 'Please select both From and To dates');
    return;
  }

  if (downloadType === 'byId' && !machineId.trim()) {
    Alert.alert('Error', 'Please enter Machine ID');
    return;
  }

  const fromISO = dayjs(fromDate).format('YYYY-MM-DDTHH:mm:ss');
  const toISO = dayjs(toDate).format('YYYY-MM-DDTHH:mm:ss');

  let url = '';
  if (downloadType === 'all') {
    url = `${BASE_URL}/api/download/all-machines-pdf/?from_date=${fromISO}&to_date=${toISO}`;
  } else {
    url = `${BASE_URL}/api/download/machine/${machineId}/pdf/?from_date=${fromISO}&to_date=${toISO}`;
  }

  try {
    setLoading(true);
    setShowError(false);
    setDownloadSuccess(false);

    const fileUri = FileSystem.documentDirectory + `report_${Date.now()}.pdf`;
    const downloadRes = await FileSystem.downloadAsync(url, fileUri);

    const fileContent = await FileSystem.readAsStringAsync(fileUri);

    let parsedJSON = null;
    try {
      parsedJSON = JSON.parse(fileContent);
    } catch (_) {
      // Not JSON → it's a valid PDF, continue
    }

    if (parsedJSON && parsedJSON.error) {
      throw new Error(parsedJSON.error);
    }

    // Otherwise, valid PDF
    await Sharing.shareAsync(fileUri);
    setDownloadSuccess(true);

    const user = await AsyncStorage.getItem('user');
    const parsedUser = JSON.parse(user);

    if (!parsedUser?.id) {
      console.warn("User ID not found in AsyncStorage");
      return;
    }

   if (!parsedUser?.id || !parsedUser?.token) {
  console.warn("User ID or token not found in AsyncStorage");
  return;
}

await axios.post(
  `${BASE_URL}/api/auth/history/record/`,
  {
    type: downloadType === 'all' ? 'All Machines' : `By GFRID: ${machineId}`,
    fromDate: fromISO,
    toDate: toISO,
    userId: parsedUser.id,
  },
  {
    headers: {
      Authorization: `Bearer ${parsedUser.token}`,
    },
  }
);

  } catch (err) {
    console.error("Download error:", err.message);
    setErrorMsg(err.message || 'Failed to download report.');
    setShowError(true);
  } finally {
    setLoading(false);
  }
};



  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animatable.View animation="fadeInUpBig" duration={700} style={styles.container}>
        <Animatable.Text animation="fadeInDown" style={styles.title}>
          <Ionicons name="document-outline" size={26} color="#1E3A8A" /> Machine Report Download
        </Animatable.Text>

        {/* Date Pickers */}
        <Animatable.View animation="fadeIn" delay={100}>
          <Text style={styles.label}> Select Time Range</Text>
          <TouchableOpacity onPress={() => setShowPicker({ from: true })} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={20} color="#1E40AF" />
            <Text style={styles.dateText}>
              {fromDate ? dayjs(fromDate).format('DD MMM YYYY, hh:mm A') : 'From Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPicker({ to: true })} style={styles.dateBtn}>
            <Ionicons name="calendar-outline" size={20} color="#1E40AF" />
            <Text style={styles.dateText}>
              {toDate ? dayjs(toDate).format('DD MMM YYYY, hh:mm A') : 'To Date'}
            </Text>
          </TouchableOpacity>
        </Animatable.View>

        {/* Type Selection */}
        <Animatable.View animation="fadeInUp" delay={150}>
          <Text style={styles.label}>
            <Ionicons name="folder-outline" size={17}></Ionicons> Report Type
          </Text>
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
                By GFRID
              </Text>
            </TouchableOpacity>
          </View>
        </Animatable.View>

        {downloadType === 'byId' && (
          <Animatable.View animation="bounceIn" delay={250}>
            <TextInput
              style={styles.input}
              placeholder="Enter GFRID (e.g., 1001)"
              keyboardType="numeric"
              value={machineId}
              onChangeText={setMachineId}
            />
          </Animatable.View>
        )}

        <Animatable.View animation="fadeInUp" delay={300}>
          <TouchableOpacity
            style={[styles.downloadBtn, loading && styles.downloadBtnDisabled]}
            onPress={handleDownload}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={20} color="white" />
                <Text style={styles.downloadBtnText}>Download PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </Animatable.View>

        <TouchableOpacity onPress={() => navigation.navigate('HistoryScreen')}>
          <Text style={{ color: '#1E40AF', marginTop: 16, textAlign: 'center' }}>
            View Download History
          </Text>
        </TouchableOpacity>

        {/* Success & Error UI */}
        {downloadSuccess && (
          <Animatable.View animation="bounceInDown" delay={200} style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#059669" />
            <Text style={styles.successText}>Download Successful!</Text>
          </Animatable.View>
        )}

        {showError && (
          <Animatable.View animation="shake" style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={28} color="#B91C1C" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity onPress={() => setShowError(false)}>
              <Text style={styles.dismissBtn}>Dismiss</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        {/* Date Pickers */}
        <DateTimePickerModal
          isVisible={showPicker.from}
          mode="datetime"
          onConfirm={(date) => {
            setFromDate(date);
            setShowPicker({ from: false });
          }}
          onCancel={() => setShowPicker({ from: false })}
        />
        <DateTimePickerModal
          isVisible={showPicker.to}
          mode="datetime"
          minimumDate={fromDate || new Date()}
          onConfirm={(date) => {
            setToDate(date);
            setShowPicker({ to: false });
          }}
          onCancel={() => setShowPicker({ to: false })}
        />
      </Animatable.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#EEF2F7',
  },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontWeight: '600',
    marginVertical: 10,
    color: '#1F2937',
    fontSize: 16,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E5E7EB',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  dateText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    backgroundColor: '#D1D5DB',
    padding: 12,
    borderRadius: 14,
  },
  optionBtnActive: {
    backgroundColor: '#1E40AF',
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
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    padding: 16,
    borderRadius: 20,
  },
  downloadBtnDisabled: {
    backgroundColor: '#64748B',
  },
  downloadBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    marginTop: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '600',
    marginTop: 8,
    fontSize: 15,
    textAlign: 'center',
  },
  dismissBtn: {
    color: '#DC2626',
    marginTop: 6,
    fontWeight: '500',
  },
  successBox: {
    backgroundColor: '#D1FAE5',
    padding: 16,
    marginTop: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  successText: {
    color: '#065F46',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 6,
  },
});

export default DownloadScreen;