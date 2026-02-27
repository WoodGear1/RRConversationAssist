// Database type definitions

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserDiscordLink {
  id: string;
  user_id: string;
  discord_user_id: string;
  discord_username: string | null;
  discord_discriminator: string | null;
  discord_avatar: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Workspace {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Recording {
  id: string;
  workspace_id: string;
  guild_id: string | null;
  voice_channel_id: string | null;
  discord_channel_id: string | null;
  initiator_user_id: string;
  initiator_discord_user_id: string | null;
  source: 'discord' | 'upload';
  status: RecordingStatus;
  started_at: Date;
  ended_at: Date | null;
  duration_ms: number | null;
  title: string | null;
  consent_message_id: string | null;
  consent_channel_id: string | null;
  failed_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export type RecordingStatus =
  | 'created'
  | 'recording'
  | 'uploaded'
  | 'audio_ready'
  | 'vad_done'
  | 'chapters_draft_ready'
  | 'transcribing'
  | 'transcript_ready'
  | 'indexing_ready'
  | 'indexed'
  | 'summaries_ready'
  | 'ready'
  | 'failed';

export interface ParticipantInterval {
  id: string;
  recording_id: string;
  discord_user_id: string;
  start_ts: number;
  end_ts: number | null;
  created_at: Date;
}
