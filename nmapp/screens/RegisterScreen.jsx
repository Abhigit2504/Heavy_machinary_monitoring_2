import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../config';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const iconAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;

  const alertOpacity = useRef(new Animated.Value(0)).current;
  const alertScale = useRef(new Animated.Value(0.8)).current;

  const register = async () => {
    if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
      return showAlert('Please fill all fields', false);
    }
    if (password !== confirmPassword) {
      return showAlert('Passwords do not match', false);
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username,
          email,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('access_token', data.access);
        await AsyncStorage.setItem('refresh_token', data.refresh);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        showAlert('Account created successfully!', true);

        Animated.parallel([
          Animated.timing(iconAnim, {
            toValue: { x: width / 2 - 100, y: height / 2 - 100 },
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(iconScale, {
            toValue: 0.2,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setTimeout(() => navigation.replace('Login'), 3000);
        });
      } else {
        showAlert(data.error || 'Registration failed', false);
      }
    } catch (error) {
      showAlert('Network error occurred', false);
    }
    setLoading(false);
  };

  const showAlert = (msg, isSuccess = false) => {
    setSuccess(isSuccess);
    setAlertMessage(msg);

    Animated.parallel([
      Animated.timing(alertOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(alertScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
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
      ]).start(() => {
        setAlertMessage('');
      });
    }, 5000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.wrapper}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                transform: [
                  { translateX: iconAnim.x },
                  { translateY: iconAnim.y },
                  { scale: iconScale },
                ],
                opacity: iconOpacity,
              },
            ]}
          >
            <Ionicons
              name={success ? 'checkmark-circle' : 'finger-print'}
              size={success ? 90 : 64}
              color={success ? '#10B981' : '#1E3A8A'}
            />
          </Animated.View>

          <Text style={styles.title}>Create New Account</Text>

          {alertMessage !== '' && (
            <Animated.View
              style={[
                styles.alertMsgContainer,
                {
                  transform: [{ scale: alertScale }],
                  opacity: alertOpacity,
                },
              ]}
            >
              {success && (
                <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" style={{ marginRight: 6 }} />
              )}
              <Text
                style={[
                  styles.alertMsg,
                  { color: success ? '#10B981' : '#dc2626' },
                ]}
              >
                {alertMessage}
              </Text>
            </Animated.View>
          )}

          {!success && (
            <>
              <TextInput placeholder="First Name" style={styles.input} value={firstName} onChangeText={setFirstName} />
              <TextInput placeholder="Last Name" style={styles.input} value={lastName} onChangeText={setLastName} />
              <TextInput placeholder="Username" style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
              <TextInput placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

              <View style={styles.passwordWrapper}>
                <TextInput
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordWrapper}>
                <TextInput
                  placeholder="Confirm Password"
                  secureTextEntry={!showConfirmPassword}
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.registerBtn, loading && styles.disabledBtn]}
                onPress={register}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="white" />
                    <Text style={styles.registerText}>Register</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                <Text style={styles.loginLink}>Already have an account? Login here</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#E0E7FF',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1E3A8A',
  },
  alertMsgContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertMsg: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'white',
    fontSize: 15,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
  },
  registerBtn: {
    flexDirection: 'row',
    backgroundColor: '#576394',
    padding: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  registerText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
  },
  loginLink: {
    color: '#1E3A8A',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
});
