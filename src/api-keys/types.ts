/** Provenance of a secret — who created it and when. */
export interface SecretInfo {
  readonly hash: string;
  readonly createdAt: number;
  readonly createdBy: string;
}

/** An API key with optional secondary secret for zero-downtime rotation. */
export interface ApiKey {
  readonly clientId: string;
  readonly accountId: string;
  readonly primary: SecretInfo;
  readonly secondary?: SecretInfo;
  readonly createdAt: number;
  readonly createdBy: string;
}

/** Structural storage adapter — same pattern as role-store. */
export interface StorageAdapter {
  create(
    blockType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  list(
    blockType: string,
    options?: { where?: Record<string, unknown> },
  ): Promise<{ id: string; data: Record<string, unknown> }[]>;
  update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  delete(id: string): Promise<void>;
}
