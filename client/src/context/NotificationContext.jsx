// src/context/NotificationContext.jsx
// This is OPTIONAL - the useSocket hook now has built-in notifications
// But if you want to reuse notifications elsewhere, this context is useful

import React, { createContext, useContext, useCallback, useEffect } from "react";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  
  // Request permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
        .then(permission => {
          console.log("📢 Notification permission:", permission);
        })
        .catch(err => {
          console.warn("Failed to request notification permission:", err);
        });
    }
  }, []);

  // Play notification sound
  const playSound = useCallback((type = "message") => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const soundConfig = {
        message: { frequency: 520, type: "sine", duration: 0.1 },
        dm: { frequency: 800, type: "square", duration: 0.15 },
        file: { frequency: 600, type: "triangle", duration: 0.12 },
        mention: { frequency: 700, type: "sawtooth", duration: 0.13 }
      };

      const config = soundConfig[type] || soundConfig.message;

      osc.type = config.type;
      osc.frequency.value = config.frequency;
      gain.gain.value = 0.1;

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, config.duration * 1000);
    } catch (err) {
      console.warn("Audio playback failed:", err);
    }
  }, []);

  // Show browser notification
  const notifyBrowser = useCallback((title, body, options = {}) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body: body || "",
          icon: options.icon || "/icon.png",
          badge: options.badge || "/badge.png",
          tag: options.tag || "chat-notification",
          requireInteraction: options.requireInteraction || false,
          silent: options.silent || false,
          ...options
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (options.onClick) options.onClick();
        };

        // Auto-close after duration (default 5s)
        const duration = options.duration || 5000;
        setTimeout(() => notification.close(), duration);

        return notification;
      } catch (err) {
        console.warn("Failed to show notification:", err);
        return null;
      }
    }
    return null;
  }, []);

  // Combined notification (sound + browser)
  const notify = useCallback((title, body, soundType = "message", options = {}) => {
    playSound(soundType);
    
    // Only show browser notification if window not focused
    if (!document.hasFocus()) {
      return notifyBrowser(title, body, options);
    }
    return null;
  }, [playSound, notifyBrowser]);

  const value = {
    playSound,
    notifyBrowser,
    notify,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  
  if (!context) {
    // Fallback if provider not used - return no-op functions
    console.warn("useNotifications used outside NotificationProvider - notifications disabled");
    return {
      playSound: () => {},
      notifyBrowser: () => {},
      notify: () => {},
    };
  }
  
  return context;
};

export default NotificationContext;