// import React from "react";
// import { createNativeStackNavigator } from "@react-navigation/native-stack";
// import TabNavigator from './TabNavigator';
// import MachineDetail from "../screens/MachineDetail";
// import DownloadScreen from "../screens/DownloadScreen"

// const Stack = createNativeStackNavigator();

// const AppNavigator = () => {
//   return (
//     <Stack.Navigator initialRouteName="Tabs">
//       <Stack.Screen
//         name="Tabs"
//         component={TabNavigator}
//         options={{ headerShown: false }}
//       />
//       <Stack.Screen name="MachineDetail" component={MachineDetail} />
//       <Stack.Screen name="DownloadScreen" component={DownloadScreen} />
      

//     </Stack.Navigator>
//   );
// };

// export default AppNavigator;








import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from '@react-native-async-storage/async-storage';

import TabNavigator from './TabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MachineDetail from '../screens/MachineDetail';
import DownloadScreen from '../screens/DownloadScreen';
import HistoryScreen from "../screens/HistoryScreen";
import LogsScreen from "../screens/LogsScreen";

import { logoutUser } from '../api/LogsApi';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [userData, setUserData] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const rawUser = await AsyncStorage.getItem('user');
        const session = await AsyncStorage.getItem('sessionId');

        // console.log("👀 Checking login user:", rawUser);
        // console.log("👀 Session ID:", session);

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

  if (isLoggedIn === null) return null; // Optional: Splash screen or spinner

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="Tabs">
            {(props) => (
              <TabNavigator
                {...props}
                onLogout={async () => {
                  // console.log("🚪 Logout initiated...");

                  if (!userData?.token || !sessionId) {
                    console.warn("⚠️ Cannot logout, missing user or session ID");
                    setIsLoggedIn(false);
                    return;
                  }

                  const success = await logoutUser(userData.token, sessionId);
                  // console.log("🔚 Logout success?", success);

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
            name="MachineDetail"
            component={MachineDetail}
            options={{ headerShown: true, title: 'Machine Detail' }}
          />
          <Stack.Screen
            name="DownloadScreen"
            component={DownloadScreen}
            options={{ headerShown: true, title: 'Download Report' }}
          />
          <Stack.Screen name="HistoryScreen" component={HistoryScreen} />
          <Stack.Screen name="LogsScreen" component={LogsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen
                {...props}
               onLogin={async () => {
  const rawUser = await AsyncStorage.getItem('user');
  const session = await AsyncStorage.getItem('sessionId');

  // console.log("🧠 [onLogin] Raw user:", rawUser);
  // console.log("🧠 [onLogin] Session ID:", session);

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
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
