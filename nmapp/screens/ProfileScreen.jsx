import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Modal,
  ScrollView,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import axios from 'axios';
import { BASE_URL } from '../config';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const navigation = useNavigation();

  const fetchUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      animateWelcome();
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const sessionId = await AsyncStorage.getItem('sessionId');
      if (token && sessionId) {
        await axios.post(
          `${BASE_URL}/api/auth/logout/`,
          { session_id: sessionId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    } catch (error) {
      console.warn('Logout API error:', error.message);
    }
    await AsyncStorage.clear();
    setShowLogoutModal(false);
    onLogout();
  };

  return (
    <ImageBackground style={styles.screen} blurRadius={2}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} />
        }
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.profileHeader, { backgroundColor: '#3b5998' }]}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle-outline" size={90} color="rgba(255,255,255,0.95)" />
            </View>
            {user ? (
              <Animatable.View animation="fadeInUp" duration={800} delay={300} style={styles.userInfoContainer}>
                <Text style={styles.nameText}>{user.first_name} {user.last_name}</Text>
                <Text style={styles.roleText}>Premium Member</Text>
              </Animatable.View>
            ) : (
              <Text style={styles.loadingText}>Loading user info...</Text>
            )}
          </View>

          <View style={styles.detailsContainer}>
            {user && (
              <>
                <View style={styles.detailItem}>
                  <Ionicons name="person-outline" size={20} color="#4c669f" />
                  <Text style={styles.detailText}>{user.username}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="mail-outline" size={20} color="#4c669f" />
                  <Text style={styles.detailText}>{user.email}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('DownloadScreen')}>
              <View style={[styles.buttonGradient, { backgroundColor: '#667eea' }]}>
                <Ionicons name="cloud-download-outline" size={22} color="white" />
                <Text style={styles.buttonText}>Download Reports</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('LogsScreen')}>
              <View style={[styles.buttonGradient, { backgroundColor: '#f78ca0' }]}>
                <Ionicons name="document-text-outline" size={22} color="white" />
                <Text style={styles.buttonText}>Logs History</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('HistoryScreen')}>
              <View style={[styles.buttonGradient, { backgroundColor: '#43e97b' }]}>
                <Ionicons name="time-outline" size={22} color="white" />
                <Text style={styles.buttonText}>View History</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setShowLogoutModal(true)}>
              <View style={[styles.buttonGradient, { backgroundColor: '#ff758c' }]}>
                <Ionicons name="log-out-outline" size={22} color="white" />
                <Text style={styles.buttonText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Modal transparent visible={showLogoutModal} animationType="fade">
          <View style={styles.modalBackdrop}>
            <Animatable.View animation="zoomIn" duration={400} style={styles.modalCard}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#ff4757" />
              </View>
              <Text style={styles.modalTitle}>Confirm Logout</Text>
              <Text style={styles.modalText}>Are you sure you want to logout?</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowLogoutModal(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonConfirm} onPress={logout}>
                  <Text style={styles.modalButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          </View>
        </Modal>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  cardContainer: {
    width: width * 0.92,
    backgroundColor: '#fff',
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  profileHeader: {
    padding: 10,
    alignItems: 'center',
    paddingTop: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    marginVertical: 20,
  },
  detailsContainer: {
    padding: 20,
    paddingTop: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  buttonContainer: {
    padding: 25,
    paddingTop: 0,
  },
  actionButton: {
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
  },
  buttonGradient: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
    padding: 25,
    elevation: 10,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#f1f2f6',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: '#ff4757',
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ProfileScreen;
