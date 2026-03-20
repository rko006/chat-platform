import mongoose, { Document, Schema } from 'mongoose';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'seen';

export interface IReaction {
  emoji: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaName?: string;
  thumbnail?: string;
  messageType: MessageType;
  status: MessageStatus;
  seenBy: Array<{
    userId: mongoose.Types.ObjectId;
    seenAt: Date;
  }>;
  deliveredTo: Array<{
    userId: mongoose.Types.ObjectId;
    deliveredAt: Date;
  }>;
  replyTo?: mongoose.Types.ObjectId;
  reactions: IReaction[];
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedFor: mongoose.Types.ObjectId[];
  forwardedFrom?: mongoose.Types.ObjectId;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: [10000, 'Message cannot exceed 10000 characters'],
    },
    mediaUrl: { type: String, default: null },
    mediaType: { type: String, default: null },
    mediaSize: { type: Number, default: null },
    mediaName: { type: String, default: null },
    thumbnail: { type: String, default: null },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
      default: 'text',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
    },
    seenBy: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      seenAt: { type: Date, default: Date.now },
    }],
    deliveredTo: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      deliveredAt: { type: Date, default: Date.now },
    }],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: [{
      emoji: { type: String, required: true },
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    forwardedFrom: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isPinned: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isDeleted: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'reactions.userId': 1 });
messageSchema.index({ text: 'text' }); // Full-text search
messageSchema.index({ isPinned: 1, conversationId: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
