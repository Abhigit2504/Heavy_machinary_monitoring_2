// import { AppRegistry } from 'react-native';
// import App from './App';
// import { name as appName } from './app.json';

// AppRegistry.registerComponent(appName, () => App);

import { registerRootComponent } from 'expo';
import App from './App';

// Ensures Expo Go and bare builds load the app correctly
registerRootComponent(App);
