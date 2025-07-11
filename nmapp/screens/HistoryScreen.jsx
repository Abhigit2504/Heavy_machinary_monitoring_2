import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Alert, ScrollView, FlatList, Dimensions, Animated, Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as Animatable from 'react-native-animatable';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { recordVisit } from '../api/LogsApi';
import { BASE_URL } from '../config';

const { width } = Dimensions.get('window');

// Theme colors
const theme = {
  primary: '#4a6da7',
  secondary: '#a8c6fa',
  accent: '#ff6b6b',
  background: '#f8f9fa',
  cardBg: '#ffffff',
  textPrimary: '#2d3748',
  textSecondary: '#4a5568',
  success: '#48bb78',
  warning: '#ed8936',
  danger: '#f56565',
  info: '#4299e1',
};

// Custom animation for delete action
Animatable.initializeRegistryWithDefinitions({
  binDrop: {
    from: { opacity: 1, translateY: 0, scale: 1, rotate: '0deg' },
    to: { opacity: 0, translateY: 100, scale: 0.5, rotate: '90deg' },
  },
});

const HistoryItem = ({ item, index, onDelete }) => {
  const animRef = useRef(null);
  const [isPressed, setIsPressed] = useState(false);

  const animateAndDelete = () => {
    animRef.current?.animate('binDrop', 500).then(() => {
      onDelete(item, index);
    });
  };

  return (
    <Animatable.View
      ref={animRef}
      animation="fadeInUp"
      duration={600}
      delay={index * 100}
      style={[
        styles.itemBox,
        isPressed && { transform: [{ scale: 0.98 }] }
      ]}
    >
      <View style={styles.row}>
        <Ionicons name="document-text-outline" size={22} color={theme.primary} />
        <Text style={styles.itemTitle}>Download Type: {item.type}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
        <Text style={styles.itemText}><Text style={styles.label}>On:</Text> {dayjs(item.downloadedAt).format('DD MMM YYYY, hh:mm A')}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
        <Text style={styles.itemText}><Text style={styles.label}>From:</Text> {dayjs(item.fromDate).format('DD MMM YYYY, hh:mm A')}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
        <Text style={styles.itemText}><Text style={styles.label}>To:</Text> {dayjs(item.toDate).format('DD MMM YYYY, hh:mm A')}</Text>
      </View>
      <TouchableOpacity 
        style={styles.deleteBtn} 
        onPress={animateAndDelete}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </Animatable.View>
  );
};

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [undoItem, setUndoItem] = useState(null);
  const [undoTimeout, setUndoTimeout] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPicker, setShowPicker] = useState({ from: false, to: false });
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchHistory();
    recordVisit('HistoryScreen');
    
    // Animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('user');
      const user = JSON.parse(userData);

      if (!user || !user.token) {
        console.warn('No token found, skipping API call');
        return;
      }

      const res = await axios.get(`${BASE_URL}/api/auth/history/list/?user_id=${user.id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      setHistory(res.data);
      setFilteredHistory(res.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteWithUndo = async (item, index) => {
    const updated = filteredHistory.filter((_, i) => i !== index);
    setFilteredHistory(updated);
    setUndoItem({ item, index });
    
    const timeout = setTimeout(async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        const user = JSON.parse(userData);
        
        if (!user || !user.token) {
          throw new Error('Unauthorized');
        }

        await axios.delete(`${BASE_URL}/api/auth/history/delete/${item.id}/`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        setUndoItem(null);
      } catch (err) {
        console.error('Delete error:', err.message);
        Alert.alert('Error', 'Failed to delete from server');
      }
    }, 7000);

    setUndoTimeout(timeout);
  };

  const handleUndo = () => {
    if (undoTimeout) clearTimeout(undoTimeout);
    if (undoItem) {
      const restored = [...filteredHistory];
      restored.splice(undoItem.index, 0, undoItem.item);
      setFilteredHistory(restored);
      setUndoItem(null);
    }
  };

  const applyFilter = () => {
    if (!fromDate || !toDate) return;
    const filtered = history.filter((item) => {
      const itemDate = dayjs(item.downloadedAt);
      return itemDate.isAfter(fromDate) && itemDate.isBefore(toDate);
    });
    setFilteredHistory(filtered);
  };

  const clearFilter = () => {
    setFromDate(null);
    setToDate(null);
    setFilteredHistory(history);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.fullCard}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Download History</Text>
            <Ionicons name="time" size={28} color={theme.primary} />
          </View>

          <TouchableOpacity 
            onPress={() => setShowFilters(!showFilters)} 
            style={styles.toggleFilterBtn}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={showFilters ? "chevron-up-outline" : "chevron-down-outline"} 
              size={20} 
              color={theme.primary} 
            />
            <Text style={styles.toggleFilterText}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Text>
          </TouchableOpacity>

          {showFilters && (
            <Animatable.View 
              animation="fadeInDown"
              duration={500}
              style={styles.filterContainer}
            >
              <View style={styles.filterRow}>
                <TouchableOpacity 
                  onPress={() => setShowPicker({ from: true })} 
                  style={styles.filterBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.primary} />
                  <Text style={styles.filterText}>
                    {fromDate ? dayjs(fromDate).format('DD MMM YYYY') : 'Select Start Date'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setShowPicker({ to: true })} 
                  style={styles.filterBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.primary} />
                  <Text style={styles.filterText}>
                    {toDate ? dayjs(toDate).format('DD MMM YYYY') : 'Select End Date'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.filterActionRow}>
                <TouchableOpacity 
                  onPress={clearFilter} 
                  style={styles.filterResetBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={20} color={theme.danger} />
                  <Text style={styles.filterResetText}>Reset</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={applyFilter} 
                  style={styles.filterApplyBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="filter" size={18} color="white" />
                  <Text style={styles.filterApplyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>Loading your history...</Text>
            </View>
          ) : filteredHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={60} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No download history found</Text>
              {fromDate && toDate && (
                <TouchableOpacity onPress={clearFilter} style={styles.emptyActionBtn}>
                  <Text style={styles.emptyActionText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredHistory}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => (
                <HistoryItem item={item} index={index} onDelete={deleteWithUndo} />
              )}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}

          {undoItem && (
            <Animatable.View 
              animation="fadeInUp" 
              duration={500}
              style={styles.undoBar}
            >
              <Text style={styles.undoText}>Item deleted</Text>
              <TouchableOpacity onPress={handleUndo} activeOpacity={0.7}>
                <Text style={styles.undoBtn}>UNDO</Text>
              </TouchableOpacity>
            </Animatable.View>
          )}
        </View>
      </ScrollView>

      <DateTimePickerModal
        isVisible={showPicker.from}
        mode="date"
        onConfirm={(date) => {
          setFromDate(date);
          setShowPicker({ from: false });
        }}
        onCancel={() => setShowPicker({ from: false })}
        buttonTextColorIOS={theme.primary}
        confirmTextIOS="Select"
        cancelTextIOS="Cancel"
      />
      <DateTimePickerModal
        isVisible={showPicker.to}
        mode="date"
        minimumDate={fromDate || undefined}
        onConfirm={(date) => {
          setToDate(date);
          setShowPicker({ to: false });
        }}
        onCancel={() => setShowPicker({ to: false })}
        buttonTextColorIOS={theme.primary}
        confirmTextIOS="Select"
        cancelTextIOS="Cancel"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    marginTop:40
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  fullCard: {
    backgroundColor: theme.cardBg,
    borderRadius: 24,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  toggleFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#E0E7FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  toggleFilterText: {
    marginLeft: 8,
    color: theme.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterText: {
    color: theme.textPrimary,
    marginLeft: 10,
    fontWeight: '500',
    fontSize: 15,
  },
  filterActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  filterApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    padding: 14,
    borderRadius: 12,
    marginLeft: 10,
  },
  filterApplyText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15,
  },
  filterResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 12,
    width: 100,
  },
  filterResetText: {
    color: theme.danger,
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 15,
  },
  itemBox: {
    backgroundColor: '#F9FAFB',
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginLeft: 10,
  },
  itemText: {
    color: theme.textSecondary,
    marginLeft: 10,
    fontSize: 15,
    marginBottom: 6,
  },
  label: {
    fontWeight: '600',
    color: theme.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  deleteBtn: {
    marginTop: 14,
    backgroundColor:"#51559c",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  deleteText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  undoBar: {
    marginTop: 16,
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: {
    color: '#0369A1',
    fontSize: 16,
    fontWeight: '500',
  },
  undoBtn: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 17,
    fontWeight: '500',
  },
  emptyActionBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E0E7FF',
    borderRadius: 12,
  },
  emptyActionText: {
    color: theme.primary,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
});