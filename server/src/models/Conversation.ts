import mongoose, { Document, Schema } from 'mongoose';

export type ConversationType = 'direct' | 'group';

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: ConversationType;
  members: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  // Group specific
  name?: string;
  groupImage?: string;
  admins?: mongoose.Types.ObjectId[];
  description?: string;
  // Meta
  unreadCounts: Map<string, number>;
  mutedBy: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Group
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    groupImage: {
      type: String,
      default: null,
    },
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    description: {
      type: String,
      maxlength: [500, 'Group description cannot exceed 500 characters'],
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    mutedBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
conversationSchema.index({ members: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ type: 1, members: 1 });
conversationSchema.index({ createdAt: -1 });

// ─── Ensure unique direct conversations ──────────────────────────────────────
conversationSchema.index(
  { type: 1, members: 1 },
  {
    unique: false,
    sparse: true,
    partialFilterExpression: { type: 'direct' },
  }
);

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
