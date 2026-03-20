import { logger } from '../utils/logger';
import { User } from '../models/User';
import { IMessage } from '../models/Message';
import mongoose from 'mongoose';

// Firebase Admin is optional — gracefully degrade if not configured
let firebaseAdmin: any = null;

async function initFirebase() {
  if (!process.env.FIREBASE_PROJECT_ID) return;
  try {
    const admin = await import('firebase-admin');
    if (!admin.default.apps.length) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseAdmin = admin.default;
    logger.info('Firebase Admin initialized');
  } catch (error) {
    logger.warn('Firebase Admin not available:', error);
  }
}

initFirebase();

export const notificationService = {
  async sendMessageNotification(message: IMessage, recipientIds: string[]): Promise<void> {
    if (!firebaseAdmin) return;

    try {
      const recipients = await User.find({
        _id: { $in: recipientIds.map(id => new mongoose.Types.ObjectId(id)) },
        fcmToken: { $ne: null },
        isOnline: false,
        'notificationSettings.messages': true,
      }).select('fcmToken notificationSettings');

      if (!recipients.length) return;

      const sender = await User.findById(message.senderId).select('username profilePicture');

      const notifications = recipients.map(recipient => ({
        token: recipient.fcmToken!,
        notification: {
          title: sender?.username || 'New Message',
          body: recipient.notificationSettings.preview
            ? (message.text || `Sent a ${message.messageType}`)
            : 'You have a new message',
        },
        data: {
          type: 'new_message',
          conversationId: message.conversationId.toString(),
          messageId: message._id.toString(),
          senderId: message.senderId.toString(),
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'messages',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      }));

      const results = await Promise.allSettled(
        notifications.map(n => firebaseAdmin.messaging().send(n))
      );

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn(`${failed.length} notifications failed to send`);
      }
    } catch (error) {
      logger.error('Notification service error:', error);
    }
  },

  async sendGroupNotification(
    groupName: string,
    senderName: string,
    message: string,
    recipientIds: string[],
    conversationId: string
  ): Promise<void> {
    if (!firebaseAdmin) return;

    try {
      const recipients = await User.find({
        _id: { $in: recipientIds },
        fcmToken: { $ne: null },
        isOnline: false,
      }).select('fcmToken');

      const tokens = recipients.map(r => r.fcmToken!).filter(Boolean);
      if (!tokens.length) return;

      await firebaseAdmin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: groupName,
          body: `${senderName}: ${message}`,
        },
        data: {
          type: 'group_message',
          conversationId,
        },
      });
    } catch (error) {
      logger.error('Group notification error:', error);
    }
  },
};
