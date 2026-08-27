export type CloudKitAccountStatus = 'available' | 'no_account' | 'restricted' | 'temporarily_unavailable' | 'could_not_determine';

export type CloudTransportRecord = {
  recordName: string;
  recordType: 'Journey' | 'MusicEntry' | 'Collection' | 'Memory' | 'Photo' | 'PrivatePreference';
  fields: Record<string, string | number | boolean | null>;
  assetFilePath?: string;
  modificationDate?: string;
};

export type CloudKitCapabilities = { privateContentVersion: number };

export type CloudKitPushResult = {
  savedRecordNames: string[];
  remoteRecords: CloudTransportRecord[];
  failedRecordNames: string[];
};

export type CloudKitPullResult = {
  records: CloudTransportRecord[];
  deletedRecordNames: string[];
};
