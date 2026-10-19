export type SliceReverseXorStep = {
  type: "slice_reverse_xor";
  start: number;
  end: number;
  xor_key: number;
};

export type SliceNotStep = {
  type: "slice_not";
  start: number;
  end: number;
};

export type CanonicalStep = SliceReverseXorStep | SliceNotStep;

export type StoredChallenge = {
  challenge_id: string;
  issued_at: string;
  expires_at: string;
  nonce: string;
  data_b64: string;
  steps: CanonicalStep[];
  instructions: string[];
  agent_name: string;
  agent_version: string;
  project_id?: string;
};

