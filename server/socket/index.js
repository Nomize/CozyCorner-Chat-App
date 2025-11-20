// server/socket/index.js
const { Server } = require('socket.io');
const chatController = require('../controllers/chatController');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5174',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  chatController(io);

  return io;
};

module.exports = initSocket;
