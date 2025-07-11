import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

// AnimatedCard with fade+scale on mount
export const AnimatedCard = ({ icon, title, value, color }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.9);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: color,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name={icon} size={28} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardValue}>{value}</Text>
    </Animated.View>
  );
};

// Loading indicator screen
export const LoadingScreen = () => (
  <View style={styles.centered}>
    <ActivityIndicator size="large" color="#00796B" />
    <Text style={{ marginTop: 10, fontSize: 16, color: "#555" }}>
      Loading data...
    </Text>
  </View>
);

// No data fallback screen
export const NoDataScreen = ({ message = "No data available" }) => (
  <View style={styles.centered}>
    <Ionicons name="alert-circle-outline" size={40} color="#999" />
    <Text style={{ fontSize: 16, color: "#999", marginTop: 10 }}>{message}</Text>
  </View>
);

// Shared layout styles
export const sharedStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 12,
  },
});

// Local styles for internal card layout
const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  cardValue: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  centered: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
