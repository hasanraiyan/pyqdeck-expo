import { registerRootComponent } from 'expo';

import App from './App';
// Defines the headless background-sync task; it must be loaded at startup.
import './src/background/syncNudgeTask';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
