import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  profilePicture?: string;
  bio?: string;
  isVerified: boolean;
  isOnline: boolean;
  lastSeen: Date;
  fcmToken?: string;
  blockedUsers: mongoose.Types.ObjectId[];
  pinnedChats: mongoose.Types.ObjectId[];
  archivedChats: mongoose.Types.ObjectId[];
  notificationSettings: {
    messages: boolean;
    sounds: boolean;
    preview: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublicJSON(): Partial<IUser>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    blockedUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    pinnedChats: [{
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    }],
    archivedChats: [{
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    }],
    notificationSettings: {
      messages: { type: Boolean, default: true },
      sounds: { type: Boolean, default: true },
      preview: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ isOnline: 1 });
userSchema.index({ createdAt: -1 });

// ─── Pre-save Hook ───────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Methods ─────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.fcmToken;
  delete obj.blockedUsers;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);
