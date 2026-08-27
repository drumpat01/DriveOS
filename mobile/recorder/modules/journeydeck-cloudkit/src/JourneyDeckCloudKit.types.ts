export type CloudKitAccountStatus = 'available' | 'no_account' | 'restricted' | 'temporarily_unavailable' | 'could_not_determine';

export type CloudTransportRecord = {
  recordName: string;
  recordType: 'Journey' | 'MusicEntry' | 'Collection' | 'Memory';
  fields: Record<string, string | number | boolean | null>;
  modificationDate?: string;
};

export type CloudKitPushResult = {
  savedRecordNames: string[];
  remoteRecords: CloudTransportRecord[];
  failedRecordNames: string[];
};

export type CloudKitPullResult = {
  records: CloudTransportRecord[];
  deletedRecordNames: string[];
};
