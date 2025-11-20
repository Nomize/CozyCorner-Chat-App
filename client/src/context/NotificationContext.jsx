// contexts/NotificationContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request permission for browser notifications
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setPermissionGranted(permission === "granted");
      });
    }
  }, []);

  // Increment unread messages
  const incrementUnread = () => {
    setUnreadCount((prev) => prev + 1);
  };

  // Reset unread count (e.g., when switching chats)
  const resetUnread = () => setUnreadCount(0);

  // Play sound notification
  const playSound = () => {
    const audio = new Audio(
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );
    audio.play().catch(() => {});
  };

  // Show browser notification
  const notifyBrowser = (title, body) => {
    if (permissionGranted) {
      new Notification(title, { body });
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        incrementUnread,
        resetUnread,
        playSound,
        notifyBrowser,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => useContext(NotificationContext);
