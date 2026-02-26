export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference?: ItemReference;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  "@microsoft.graph.downloadUrl"?: string;
  description?: string;
  createdBy?: IdentitySet;
  lastModifiedBy?: IdentitySet;
}

export interface Drive {
  id: string;
  driveType: string;
  owner?: {
    user?: {
      id: string;
      displayName: string;
    };
  };
  quota?: {
    total: number;
    used: number;
    remaining: number;
    deleted: number;
    state: string;
  };
  name?: string;
  webUrl?: string;
}

export interface ItemReference {
  driveId?: string;
  driveType?: string;
  id?: string;
  name?: string;
  path?: string;
}

export interface Permission {
  id: string;
  roles: string[];
  grantedTo?: IdentitySet;
  grantedToIdentities?: IdentitySet[];
  link?: {
    type: string;
    scope: string;
    webUrl: string;
  };
  invitation?: {
    email: string;
  };
}

export interface IdentitySet {
  user?: {
    id: string;
    displayName: string;
  };
  application?: {
    id: string;
    displayName: string;
  };
}

export interface UploadSession {
  uploadUrl: string;
  expirationDateTime: string;
  nextExpectedRanges?: string[];
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  client_id: string;
}

export interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface GraphErrorResponse {
  error: {
    code: string;
    message: string;
    innerError?: {
      "request-id"?: string;
      date?: string;
      "client-request-id"?: string;
    };
  };
}

export interface GraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}
