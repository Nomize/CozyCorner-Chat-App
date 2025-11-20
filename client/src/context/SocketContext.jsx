import { createContext, useContext } from 'react';
import { useSocket } from '../hooks/useSocket';

// Create context
const SocketContext = createContext(null);

// Provider component
export const SocketProvider = ({ children }) => {
  const socketData = useSocket();
  return (
    <SocketContext.Provider value={socketData}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the context easily
export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
};
