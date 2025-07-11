// import 'react-native-gesture-handler';  // very important, first import
// import React from 'react';
// import { NavigationContainer } from '@react-navigation/native';
// import AppNavigator from './navigation/AppNavigator';
// import { SafeAreaProvider } from 'react-native-safe-area-context';

// export default function App() {
//   return (
//     <SafeAreaProvider>
//       <NavigationContainer>
//         <AppNavigator />
//       </NavigationContainer>
//     </SafeAreaProvider>
//   );
// }









import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Outfit_400Regular } from '@expo-google-fonts/outfit';
import { Text as RNText, View, ActivityIndicator } from 'react-native';

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
  });

  // ✅ Patch all Text components to use Outfit globally
  useEffect(() => {
    if (fontsLoaded) {
      const oldRender = RNText.render;

      RNText.render = function (...args) {
        const origin = oldRender.call(this, ...args);
        return React.cloneElement(origin, {
          style: [{ fontFamily: 'Outfit_400Regular' }, origin.props.style],
        });
      };
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
