// Must stay first: it timestamps when the bundle starts running.
import { startupMark } from './src/utils/startupLog';
import { registerRootComponent } from 'expo';

import App from './App';
// Defines the headless background-sync task; it must be loaded at startup.
import './src/background/syncNudgeTask';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
startupMark('all modules evaluated (App and its imports loaded)');
registerRootComponent(App);
startupMark('registerRootComponent called');
