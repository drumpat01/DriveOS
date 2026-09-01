export type CloudKitAccountStatus = 'available' | 'no_account' | 'restricted' | 'temporarily_unavailable' | 'could_not_determine';

export type CloudTransportRecord = {
  recordName: string;
  recordType: 'Journey' | 'RouteArchive' | 'MusicEntry' | 'Collection' | 'Memory' | 'Photo' | 'PrivatePreference';
  fields: Record<string, string | number | boolean | null>;
  assetFilePath?: string;
  modificationDate?: string;
};

export type CloudKitCapabilities = {
  privateContentVersion: number;
  transportVersion?: number;
  retryMetadata?: boolean;
};

export type CloudKitRecordFailure = {
  recordName: string;
  code: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
};

export type CloudKitPushResult = {
  savedRecordNames: string[];
  remoteRecords: CloudTransportRecord[];
  failedRecordNames: string[];
  failedRecords?: CloudKitRecordFailure[];
};

export type CloudKitPullResult = {
  records: CloudTransportRecord[];
  deletedRecordNames: string[];
  changeTokenStaged?: boolean;
};
