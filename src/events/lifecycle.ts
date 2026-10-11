import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { emit } from './bus';

/**
 * The ONE place that listens to the OS for "the app came to the foreground /
 * went to the background" and "the connection came back", and turns those into
 * bus events (SRS-event-driven-architecture, LIF). Everything else subscribes to
 * the events instead of attaching its own AppState / Network listener, so one
 * wake-up is one event no matter how many modules care.
 *
 * Importing this module starts it, once.
 */

let started = false;

export function startLifecycle(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (state) => {
    if (state === 'active') emit('app.foreground');
    else if (state === 'background') emit('app.background');
  });

  try {
    Network.addNetworkStateListener((event) => {
      if (event.isConnected && event.isInternetReachable !== false) emit('network.online');
    });
  } catch {
    // No network module (web preview): connectivity events are simply absent.
  }
}

startLifecycle();
