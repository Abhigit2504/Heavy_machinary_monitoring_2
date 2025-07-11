import React, { useState, useRef } from 'react';
import {
  View, TextInput, StyleSheet, Text, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Animated, Dimensions, Modal, Pressable, ImageBackground
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation, onLogin }) {
  // First declare all animation refs at the top
  const iconAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;
  const alertScale = useRef(new Animated.Value(0.8)).current;

  // Then declare state variables
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Rest of your existing functions remain exactly the same
  const showAlert = (message) => {
    setAlertMessage(message);
    setAlertVisible(true);
    Animated.parallel([
      Animated.timing(alertOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(alertScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(alertOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(alertScale, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setAlertVisible(false));
  };

  const flushStorage = async (retryCount = 3) => {
    for (let i = 0; i < retryCount; i++) {
      const user = await AsyncStorage.getItem('user');
      const session = await AsyncStorage.getItem('sessionId');
      if (user && session) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  };

  const login = async () => {
    if (!emailOrUsername || !password) return showAlert('Enter both fields');
    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_username: emailOrUsername, password }),
      });

      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); } catch {
        setLoading(false); return showAlert('Invalid server response');
      }

      if (response.ok && data.user && data.access && data.session_id) {
        await AsyncStorage.clear();
        await AsyncStorage.setItem('user', JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          token: data.access,
        }));

        await AsyncStorage.setItem('sessionId', String(data.session_id));

        await new Promise(resolve => setTimeout(resolve, 300));
        await AsyncStorage.flushGetRequests();

        const verified = await flushStorage();
        if (!verified) {
          setLoading(false); return showAlert('Login session failed');
        }

        Animated.parallel([
          Animated.timing(iconAnim, {
            toValue: { x: width / 2 - 100, y: height / 2 - 100 },
            duration: 700, useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 0, duration: 700, useNativeDriver: true,
          }),
          Animated.timing(iconScale, {
            toValue: 0.2, duration: 700, useNativeDriver: true,
          }),
        ]).start(() => onLogin());
      } else {
        showAlert(data.error || 'Login failed.');
      }
    } catch (e) {
      showAlert(e.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <ImageBackground 
          // source={require('../assets/app-logo.png')}
      style={styles.backgroundImage}
      blurRadius={2}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.container}
      >
        <View style={styles.overlay} />
        
        {/* Now iconAnim is properly declared before being used */}
        <Animated.View style={[styles.animatedIconWrapper, {
          transform: [{ translateX: iconAnim.x }, { translateY: iconAnim.y }, { scale: iconScale }],
          opacity: iconOpacity,
        }]}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-circle-outline" size={100} color="#fff" />
          </View>
        </Animated.View>

        <View style={styles.card}>
          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.subheading}>Sign in to continue</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput 
              placeholder="Email or Username" 
              placeholderTextColor="#9CA3AF"
              style={styles.input} 
              value={emailOrUsername} 
              onChangeText={setEmailOrUsername} 
              autoCapitalize="none" 
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)} 
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? 'eye-off' : 'eye'} 
                size={22} 
                color="#6B7280" 
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#5d6da6" style={styles.loader} />
          ) : (
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={login}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={() => navigation.navigate('Register')} 
            style={styles.registerLink}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerHighlight}>Register here</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Modal animationType="fade" transparent={true} visible={alertVisible} onRequestClose={hideAlert}>
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalContainer, {
              transform: [{ scale: alertScale }],
              opacity: alertOpacity,
            }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="warning" size={28} color="#F59E0B" />
                <Text style={styles.modalTitle}>Alert</Text>
              </View>
              <Text style={styles.modalMessage}>{alertMessage}</Text>
              <Pressable 
                style={styles.closeButton} 
                onPress={hideAlert}
                android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <Text style={styles.closeButtonText}>OK</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

// Styles remain exactly the same as in previous example
const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 25,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  animatedIconWrapper: {
    position: 'absolute',
    top: height / 2 - 250,
    left: width / 2 - 60,
    zIndex: 10,
  },
  iconContainer: {
    backgroundColor: '#5d6da6',
    width: 120,
    height:120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    color: '#1E293B',
  },
  subheading: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1F2937',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 10,
  },
  loader: {
    marginTop: 20,
    marginBottom: 10,
  },
  loginButton: {
    backgroundColor: '#5d6da6',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    marginTop: 20,
    alignSelf: 'center',
  },
  registerText: {
    color: '#64748B',
    fontSize: 14,
  },
  registerHighlight: {
    color: '#5d6da6',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#1E293B',
  },
  modalMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
    paddingTop: 10,
  },
  closeButton: {
    backgroundColor: '#5d6da6',
    padding: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});