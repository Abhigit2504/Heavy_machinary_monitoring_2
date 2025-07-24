





import React, { useEffect, useState, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MachineDetail from '../screens/MachineDetail';
import DownloadScreen from '../screens/DownloadScreen';
import HistoryScreen from "../screens/HistoryScreen";
import LogsScreen from "../screens/LogsScreen";

import { logoutUser } from '../api/LogsApi';
import InfoWrapper from "../screens/InfoWrapper";

const Stack = createNativeStackNavigator();

const CustomHeader = ({ title }) => {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titlePosition = useRef(new Animated.Value(-80)).current;
  const gearOpacity = useRef(new Animated.Value(1)).current;
  const containerWidth = useRef(new Animated.Value(180)).current;
  const containerHeight = useRef(new Animated.Value(60)).current;
  const titleSize = useRef(new Animated.Value(20)).current;
  
  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.spring(titlePosition, {
          toValue: 0,
          speed: 55,
          bounciness: 10,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(gearOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(containerWidth, {
          toValue: 190,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(containerHeight, {
          toValue: 45,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(titleSize, {
          toValue: 17,
          duration: 400,
          useNativeDriver: false,
        })
      ])
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#5279a8', '#2b75a6']}
      start={[0, 0]}
      end={[1, 1]}
      style={styles.headerContainer}
    >
      <Animated.View style={[styles.headerTitleContainer, {
        opacity: titleOpacity,
        transform: [{ translateX: titlePosition }],
        width: containerWidth,
        height: containerHeight,
      }]}>
        <Animated.View style={{ opacity: gearOpacity }}>
          <Ionicons 
            name="settings" 
            size={20} 
            color="#fff" 
            style={styles.gearIcon}
          />
        </Animated.View>
        <Animated.Text style={[styles.headerTitle, {
          fontSize: titleSize,
          marginLeft: titleSize.interpolate({
            inputRange: [16, 30],
            outputRange: [8, 12]
          })
        }]}>
          {title}
        </Animated.Text>
      </Animated.View>
    </LinearGradient>
  );
};

const AppNavigator = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [userData, setUserData] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const rawUser = await AsyncStorage.getItem('user');
        const session = await AsyncStorage.getItem('sessionId');

        if (rawUser && session) {
          const parsedUser = JSON.parse(rawUser);
          setUserData(parsedUser);
          setSessionId(session);
          setIsLoggedIn(!!parsedUser?.token);
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("❌ Error reading auth info:", err);
        setIsLoggedIn(false);
      }
    };

    checkLogin();
  }, []);

  if (isLoggedIn === null) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        header: ({ navigation, route, options }) => (
          <CustomHeader title={options.title || route.name} />
        ),
        headerStyle: {
          height: 70,
        },
      }}
    >
      {isLoggedIn ? (
        <>
          <Stack.Screen 
            name="Tabs"
            options={{ headerShown: false }}
          >
            {(props) => (
              <TabNavigator
                {...props}
                onLogout={async () => {
                  if (!userData?.token || !sessionId) {
                    console.warn("⚠️ Cannot logout, missing user or session ID");
                    setIsLoggedIn(false);
                    return;
                  }

                  const success = await logoutUser(userData.token, sessionId);
                  if (!success) {
                    console.warn("⚠️ Logout may not have completed properly on server");
                  }

                  setUserData(null);
                  setSessionId(null);
                  setIsLoggedIn(false);
                }}
              />
            )}
          </Stack.Screen>
<Stack.Screen
            name="InfoWrapper"
            component={InfoWrapper}
            
          />
          <Stack.Screen
            name="MachineDetail"
            component={MachineDetail}
            options={{ title: 'Machine Detail' }}
          />
          <Stack.Screen
            name="DownloadScreen"
            component={DownloadScreen}
            options={{ title: 'Download Report' }}
          />
          <Stack.Screen 
            name="HistoryScreen" 
            component={HistoryScreen} 
            options={{ title: 'History' }}
          />
          <Stack.Screen 
            name="LogsScreen" 
            component={LogsScreen} 
            options={{ title: 'Logs/Activity' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen 
            name="Login"
            options={{ headerShown: false }}
          >
            {(props) => (
              <LoginScreen
                {...props}
                onLogin={async () => {
                  const rawUser = await AsyncStorage.getItem('user');
                  const session = await AsyncStorage.getItem('sessionId');

                  if (rawUser && session) {
                    const parsedUser = JSON.parse(rawUser);
                    setUserData(parsedUser);
                    setSessionId(session);
                    setIsLoggedIn(!!parsedUser?.token);
                  } else {
                    setIsLoggedIn(false);
                  }
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen} 
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 70,
    justifyContent: 'center',
    // alignItems: 'center',
    marginTop:30,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    
    // paddingHorizontal: 5,
  },
  headerTitle: {
    fontWeight: '600',
    color: '#fff',
  },
  gearIcon: {
    marginRight: 8,
  },
});

export default AppNavigator;