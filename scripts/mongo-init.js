// MongoDB initialization script
// Creates the application database and user

db = db.getSiblingDB('chatplatform');

db.createUser({
  user: 'chatplatform',
  pwd: 'chatplatform_password',
  roles: [{ role: 'readWrite', db: 'chatplatform' }],
});

// Create initial indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ isOnline: 1 });

db.conversations.createIndex({ members: 1 });
db.conversations.createIndex({ lastMessageAt: -1 });

db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ conversationId: 1, isDeleted: 1 });
db.messages.createIndex({ text: 'text' });

print('✅ MongoDB initialized for ChatFlow');
