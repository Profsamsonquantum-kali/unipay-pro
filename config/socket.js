const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initializeSocket = (socketIO) => {
    io = socketIO;

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return next(new Error('User not found'));
            }

            socket.user = user;
            socket.userId = user._id.toString();
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.user?.email || socket.id}`);

        // Join user's personal room
        socket.join(`user:${socket.userId}`);

        // Join price feed room
        socket.join('price-feed');

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.user?.email || socket.id}`);
            socket.leave(`user:${socket.userId}`);
            socket.leave('price-feed');
        });

        // Handle subscription to specific rooms
        socket.on('subscribe', (room) => {
            socket.join(room);
            console.log(`User ${socket.userId} subscribed to ${room}`);
        });

        socket.on('unsubscribe', (room) => {
            socket.leave(room);
            console.log(`User ${socket.userId} unsubscribed from ${room}`);
        });
    });

    return io;
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

// Emit to all
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};

// Emit to room
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
    }
};

module.exports = {
    initializeSocket,
    emitToUser,
    emitToAll,
    emitToRoom
};