// Generate a timestamp string in a readable format
const formatTimestamp = (date = new Date()) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Validate a username (non-empty, no special chars except _ or -)
const isValidUsername = (username) => {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
};

// Limit messages array to last N messages to prevent memory bloat
const trimMessages = (messages, limit = 100) => {
  if (messages.length > limit) {
    return messages.slice(messages.length - limit);
  }
  return messages;
};

module.exports = {
  formatTimestamp,
  isValidUsername,
  trimMessages,
};
