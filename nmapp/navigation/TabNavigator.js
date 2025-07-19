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



import React, { useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome6 } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, Platform, Animated, View, StyleSheet } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';

import MachineDashboard from "../screens/MachineDashboard";
import ProfileScreen from "../screens/ProfileScreen";
import InfoWrapper from "../screens/InfoWrapper";

const Tab = createBottomTabNavigator();

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
          speed: 15,
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
          toValue: 140,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(containerHeight, {
          toValue: 45,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(titleSize, {
          toValue: 16,
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
            inputRange: [16, 20],
            outputRange: [8, 12]
          })
        }]}>
          {title}
        </Animated.Text>
      </Animated.View>
    </LinearGradient>
  );
};

const TabNavigator = ({ onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <CustomHeader title={route.name} />,
        headerStyle: {
          height: 70,
        },
        tabBarShowLabel: true,
        tabBarIcon: ({ focused }) => {
          switch (route.name) {
            case "Dashboard":
              return (
                <MaterialCommunityIcons
                  name="view-dashboard-outline"
                  size={24}
                  color={focused ? "#fff" : "rgba(255,255,255,0.7)"}
                />
              );
            case "Profile":
              return (
                <FontAwesome6
                  name="user-gear"
                  size={20}
                  color={focused ? "#fff" : "rgba(255,255,255,0.7)"}
                />
              );
          case "Info":
            return (
              <MaterialCommunityIcons
                name="details"
                size={24}
                color={focused ? "#fff" : "rgba(255,255,255,0.7)"}
              />
            );

            default:
              return (
                <Ionicons
                  name="apps"
                  size={24}
                  color={focused ? "#fff" : "rgba(255,255,255,0.7)"}
                />
              );
          }
        },
        tabBarLabel: ({ focused }) => (
          <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
            {route.name}
          </Text>
        ),
        tabBarStyle: {
          height: 60,
          paddingBottom: 6,
          backgroundColor: '#5279a8',
          borderTopWidth: 0,
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

const styles = StyleSheet.create({
  headerContainer: {
    height: 70,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginTop: 30,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 5,
  },
  headerTitle: {
    fontWeight: '900',
    color: '#fff',
  },
  gearIcon: {
    marginRight: 2,
  },
  tabLabel: {
    fontSize: 15,
    marginBottom: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  tabLabelFocused: {
    fontWeight: '600',
    color: '#fff',
  },
});

export default TabNavigator;
