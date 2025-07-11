// import React from "react";
// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
// import { Ionicons } from "@expo/vector-icons";
// import { View, Text, Platform } from "react-native";

// import MachineDashboard from "../screens/MachineDashboard";
// import ProfileScreen from "../screens/ProfileScreen";
// import InfoWrapper from "../screens/InfoWrapper";
// import SettingsScreen from '../screens/SettingsScreen';

// const Tab = createBottomTabNavigator();

// const TabNavigator = () => {
//   return (
//     <Tab.Navigator
//       screenOptions={({ route }) => ({
//         headerShown: true,
//         tabBarShowLabel: true,
//         tabBarIcon: ({ color, size, focused }) => {
//           let iconName = "apps-outline";
//           if (route.name === "Dashboard") iconName = "speedometer-outline";
//           else if (route.name === "Info") iconName = "information-circle-outline";
//           else if (route.name === "Profile") iconName = "person-circle-outline";
//           else if (route.name === "Settings") iconName = "settings-outline";

//           return (
//             <Ionicons
//               name={iconName}
//               size={focused ? 30 : 24}
//               color={focused ? "#ffffff" : "#d1e5f0"}
//               style={{ transform: [{ scale: focused ? 1.1 : 1 }] }}
//             />
//           );
//         },
//         tabBarLabel: ({ focused, color }) => (
//           <Text
//             style={{
//               fontSize: focused ? 14 : 12,
//               fontWeight: focused ? "700" : "600",
//               color: focused ? "#ffffff" : "#d1e5f0",
//               marginTop: 4,
//             }}
//           >
//             {route.name}
//           </Text>
//         ),
//         tabBarStyle: {
//           position: "absolute",
//           left: 20,
//           right: 20,
//           bottom: Platform.OS === "ios" ? 30 : 20,
//           height: 80,
//           borderRadius: 30,
//           paddingBottom: 10,
//           paddingTop: 6,
//           backgroundColor: "#5d6da6",
//           shadowColor: "#000",
//           shadowOffset: { width: 0, height: 8 },
//           shadowOpacity: 0.25,
//           shadowRadius: 12,
//           elevation: 10,
//         },
//       })}
//     >
//       <Tab.Screen name="Dashboard" component={MachineDashboard} />
//       <Tab.Screen name="Info" component={InfoWrapper} />
//       {/* <Tab.Screen name="Settings" component={SettingsScreen} /> */}
//       <Tab.Screen name="Profile" component={ProfileScreen} />
//     </Tab.Navigator>
//   );
// };

// export default TabNavigator;


// TabNavigator.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Text, Platform } from "react-native";

import MachineDashboard from "../screens/MachineDashboard";
import ProfileScreen from "../screens/ProfileScreen";
import InfoWrapper from "../screens/InfoWrapper";

const Tab = createBottomTabNavigator();

const TabNavigator = ({ onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarShowLabel: true,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = "apps-outline";
          if (route.name === "Dashboard") iconName = "speedometer-outline";
          else if (route.name === "Info") iconName = "information-circle-outline";
          else if (route.name === "Profile") iconName = "person-circle-outline";

          return (
            <Ionicons
              name={iconName}
              size={focused ? 30 : 24}
              color={focused ? "#ffffff" : "#d1e5f0"}
              style={{ transform: [{ scale: focused ? 1.1 : 1 }] }}
            />
          );
        },
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontSize: focused ? 14 : 12,
              fontWeight: focused ? "700" : "600",
              color: focused ? "#ffffff" : "#d1e5f0",
              marginTop: 4,
            }}
          >
            {route.name}
          </Text>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: Platform.OS === "ios" ? 30 : 20,
          height: 80,
          borderRadius: 30,
          paddingBottom: 10,
          paddingTop: 6,
          backgroundColor: "#5d6da6",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 10,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={MachineDashboard} />
      <Tab.Screen name="Info" component={InfoWrapper} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default TabNavigator;
