import { useEffect, useState } from 'react';
import { socket } from '../socket/socket';

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
    }
  };

  const disconnect = () => {
    socket.disconnect();
  };

  const sendMessage = (message) => {
    socket.emit('send_message', { message });
  };

  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { to, message });
  };

  const setTypingStatus = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleMessage = (msg) => {
      setLastMessage(msg);
      setMessages((prev) => [...prev, msg]);
    };
    const handleUserList = (list) => setUsers(list);
    const handleTyping = (typingList) => setTypingUsers(typingList);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receive_message', handleMessage);
    socket.on('private_message', handleMessage);
    socket.on('user_list', handleUserList);
    socket.on('typing_users', handleTyping);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receive_message', handleMessage);
      socket.off('private_message', handleMessage);
      socket.off('user_list', handleUserList);
      socket.off('typing_users', handleTyping);
    };
  }, []);

  return {
    socket,
    isConnected,
    messages,
    users,
    typingUsers,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping: setTypingStatus,
  };
};
