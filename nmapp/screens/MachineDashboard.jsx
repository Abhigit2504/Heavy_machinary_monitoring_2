import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BASE_URL } from '../config';
import { recordVisit } from '../api/LogsApi';
import CustomDonutChart from '../components/CustomDonutChart';

dayjs.extend(customParseFormat);
const screenWidth = Dimensions.get('window').width;

const CustomBarChart = ({ data, scrollViewRef }) => {
  const barHeights = useRef(data.map(() => new Animated.Value(0))).current;
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    const animations = data.map((_, i) =>
      Animated.timing(barHeights[i], {
        toValue: data[i].value,
        duration: 600,
        delay: i * 120,
        useNativeDriver: false,
      })
    );
    Animated.stagger(100, animations).start();
  }, [data]);

  const scrollTo = (direction) => {
    const newOffset = direction === 'right' ? scrollX + 150 : scrollX - 150;
    scrollViewRef.current?.scrollTo({ x: newOffset, animated: true });
    setScrollX(newOffset);
  };

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      <TouchableOpacity style={styles.scrollButtonLeft} onPress={() => scrollTo('left')}>
        <Ionicons name="chevron-back" size={24} color="#3B82F6" />
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={(event) => {
          setScrollX(event.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexDirection: 'row',
          paddingVertical: 20,
          paddingHorizontal: 40,
          minWidth: data.length * 80,
        }}
      >
        {data.map((item, i) => (
          <View
            key={i}
            style={{
              alignItems: 'center',
              marginHorizontal: 12,
              width: 60,
            }}
          >
            <Animated.View
              style={{
                height: barHeights[i].interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, 180],
                }),
                width: 26,
                backgroundColor: item.color,
                borderRadius: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            />
            <Text style={{ fontSize: 12, marginTop: 6, color: '#1F2937', textAlign: 'center' }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 12, color: '#475569' }}>{item.value}%</Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.scrollButtonRight} onPress={() => scrollTo('right')}>
        <Ionicons name="chevron-forward" size={24} color="#3B82F6" />
      </TouchableOpacity>
    </View>
  );
};

const MachineDashboard = ({ navigation }) => {
  const [machines, setMachines] = useState([]);
  const [priorityUsage, setPriorityUsage] = useState([]);
  const [searchGfrid, setSearchGfrid] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [typedText, setTypedText] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const chartAnim = useRef(new Animated.Value(1)).current;
  const cardAnimations = useRef([]).current;
  const fullTextRef = useRef('');
  const scrollViewRef = useRef(null);
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    const debugUserStorage = async () => {
      const raw = await AsyncStorage.getItem('user');
      console.log("🧠 DEBUG user from AsyncStorage:", raw);
    };
    debugUserStorage();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        fullTextRef.current = `Welcome, ${parsed.first_name} ${parsed.last_name}!`;
        typeText();
        animateWelcome();
      }
    };
    fetchUser();
  }, []);

  const typeText = () => {
    let i = 0;
    const fullText = fullTextRef.current;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
  };

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
    ]).start();
  };

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const [machineRes, priorityRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/machines/`),
        axios.get(`${BASE_URL}/api/priority-usage/`),
      ]);
      setMachines(machineRes.data);
      setPriorityUsage(priorityRes.data);
      setShowChart(true);
      chartAnim.setValue(0);
      Animated.timing(chartAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }).start();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const hidePieChart = () => {
    Animated.sequence([
      // First, scale up slightly
      Animated.timing(chartAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      // Then explode outward while fading
      Animated.parallel([
        Animated.timing(chartAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowChart(false);
      // Reset values for next appearance
      chartAnim.setValue(1);
      fadeAnim.setValue(1);
    });
  };

  const handleChartLongPress = () => {
    Animated.sequence([
      Animated.timing(chartAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(chartAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.navigate('Info'));
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const parsed = dayjs(ts, 'YYYY-MM-DD HH:mm:ss');
    return parsed.isValid() ? parsed.format('DD-MMM-YYYY, hh:mm A') : 'Invalid';
  };

  const filteredMachines = machines.filter((machine) =>
    machine.gfrid.toString().includes(searchGfrid)
  );

  const renderItem = ({ item, index }) => {
    if (!cardAnimations[index]) {
      cardAnimations[index] = new Animated.Value(0);
      Animated.timing(cardAnimations[index], {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }

    return (
      <Animated.View
        style={{
          opacity: cardAnimations[index],
          transform: [
            {
              translateY: cardAnimations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('MachineDetail', { gfrid: item.gfrid })}
          activeOpacity={0.9}
        >
          <Text style={styles.cardText}>
            <MaterialCommunityIcons name="engine" size={24} color="black" /> GFRID: {item.gfrid}</Text>
          <Text style={styles.cardSub}>Status: {item.status || 'N/A'}</Text>
          <Text style={styles.cardSub}>Last Seen: {formatTimestamp(item.last_seen)}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {typedText !== '' && (
        <Animated.Text
          style={[
            styles.welcomeText,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {typedText}
        </Animated.Text>
      )}

      <FlatList
        refreshing={loading}
        onRefresh={fetchMachines}
        ListHeaderComponent={
          <>
            {showChart && priorityUsage.length > 0 && (
              <Animated.View
                style={[
                  styles.chartCard,
                  {
                    transform: [{ scale: chartAnim }],
                    opacity: fadeAnim,
                  },
                ]}
              >
                <TouchableOpacity style={styles.closeIcon} onPress={hidePieChart}>
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>

                <Pressable onLongPress={handleChartLongPress} style={{ flex: 1 }}>
                  <Text style={styles.chartTitle}>Past 1 Week ON % per GFRID</Text>
                  <CustomDonutChart
                    data={priorityUsage.map((item, index) => ({
                      label: `${item.gfrid}`,
                      value: parseFloat(item.on_percent.toFixed(2)),
                      color: [
                        '#3B82F6', '#F97316', '#10B981', '#EF4444',
                        '#8B5CF6', '#14B8A6', '#F59E0B', '#EC4899',
                      ][index % 8],
                    }))}
                  />
                </Pressable>
              </Animated.View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Search by GFRID"
              value={searchGfrid}
              onChangeText={setSearchGfrid}
              placeholderTextColor="#9CA3AF"
            />
          </>
        }
        data={filteredMachines}
        keyExtractor={(item) => item.gfrid.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F0F4F8',
    marginBottom: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1E40AF',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginBottom: 16,
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderBottomWidth: 6,
    borderBottomColor: '#9f5ead',
  },
  cardText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  cardSub: {
    fontSize: 15,
    color: '#475569',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 15,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 20,
    color: '#1E3A8A',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 6,
  },
  scrollButtonLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 50,
    padding: 5,
    transform: [{ translateY: -12 }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 40
  },
  scrollButtonRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 50,
    padding: 5,
    transform: [{ translateY: -12 }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 40
  },
});

export default MachineDashboard;



















// import React, { useEffect, useState } from 'react';
// import { 
//   View, 
//   Text, 
//   FlatList, 
//   TextInput, 
//   StyleSheet, 
//   TouchableOpacity,
//   ActivityIndicator,
//   Button 
// } from 'react-native';
// import axios from 'axios';

// const BASE_URL = 'http://192.168.1.4:8000'; // Update with your actual server IP

// const MachineDashboard = ({ navigation }) => {
//   const [machines, setMachines] = useState([]);
//   const [searchGfrid, setSearchGfrid] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const fetchMachines = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const res = await axios.get(`${BASE_URL}/api/machines/`);
//       setMachines(res.data);
//     } catch (error) {
//       console.error('Error fetching machines:', error);
//       setError('Failed to load machines. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchMachines();
//   }, []);

//   const filteredMachines = machines.filter(machine =>
//     machine.gfrid.toString().includes(searchGfrid)
//   );

//   const renderItem = ({ item }) => (
//     <TouchableOpacity
//       style={styles.card}
//       onPress={() => navigation.navigate('MachineDetail', { gfrid: item.gfrid })}
//     >
//       <Text style={styles.cardText}>Machine GFRID: {item.gfrid}</Text>
//       <Text style={styles.cardSub}>Last Alert: {item.last_alert || 'N/A'}</Text>
//       <Text style={styles.cardSub}>Last Seen: {item.last_seen || 'N/A'}</Text>
//     </TouchableOpacity>
//   );

//   if (loading) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#0000ff" />
//       </View>
//     );
//   }

//   if (error) {
//     return (
//       <View style={styles.errorContainer}>
//         <Text style={styles.errorText}>{error}</Text>
//         <Button title="Retry" onPress={fetchMachines} />
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>All Machines</Text>
//       <TextInput
//         style={styles.input}
//         placeholder="Search by GFRID"
//         value={searchGfrid}
//         onChangeText={setSearchGfrid}
//       />
//       <FlatList
//         data={filteredMachines}
//         keyExtractor={(item) => item.gfrid.toString()}
//         renderItem={renderItem}
//         contentContainerStyle={{ paddingBottom: 24 }}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 16,
//     backgroundColor: '#fff',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   errorContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   errorText: {
//     color: 'red',
//     marginBottom: 20,
//     textAlign: 'center',
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginBottom: 16,
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 8,
//     padding: 8,
//     marginBottom: 16,
//   },
//   card: {
//     backgroundColor: '#f1f1f1',
//     padding: 16,
//     marginBottom: 12,
//     borderRadius: 8,
//   },
//   cardText: {
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   cardSub: {
//     fontSize: 14,
//     color: '#666',
//     marginTop: 4,
//   },
// });

// export default MachineDashboard;