// sp-react-native-in-app-updates ships a `types` field in package.json that points at a
// nonexistent file (its real .d.ts output lives elsewhere in the package), so TypeScript
// can't resolve it. This is a minimal ambient declaration for the subset of the API we use.
declare module 'sp-react-native-in-app-updates' {
  export enum IAUUpdateKind {
    FLEXIBLE = 0,
    IMMEDIATE = 1,
  }

  export enum IAUInstallStatus {
    UNKNOWN = 0,
    PENDING = 1,
    DOWNLOADING = 2,
    INSTALLING = 3,
    INSTALLED = 4,
    FAILED = 5,
    CANCELED = 6,
    DOWNLOADED = 11,
  }

  export type StatusUpdateEvent = {
    bytesDownloaded: number;
    totalBytesToDownload: number;
    status: IAUInstallStatus;
  };

  export type CheckOptions = {
    curVersion?: string;
    country?: string;
    iosStrategy?: 'itunes' | 'siren';
  };

  export type NeedsUpdateResponse = {
    shouldUpdate: boolean;
    storeVersion?: string;
    other?: unknown;
  };

  export type StartUpdateOptions = {
    updateType?: IAUUpdateKind;
    title?: string;
    message?: string;
    buttonUpgradeText?: string;
    buttonCancelText?: string;
    forceUpgrade?: boolean;
    bundleId?: string;
    country?: string;
  };

  export default class SpInAppUpdates {
    constructor(isDebug?: boolean);
    checkNeedsUpdate(options?: CheckOptions): Promise<NeedsUpdateResponse>;
    startUpdate(options: StartUpdateOptions): Promise<void>;
    installUpdate(): void;
    addStatusUpdateListener(callback: (status: StatusUpdateEvent) => void): void;
    removeStatusUpdateListener(callback: (status: StatusUpdateEvent) => void): void;
  }
}
