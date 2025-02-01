const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors'); 
// Initialize the app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins, or replace '*' with your frontend URL if specific
    methods: ["GET", "POST"],
  }
});
app.use(cors());
// Middleware to serve static files   
app.use(express.static('public'));
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');  // Allow all origins
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  
    next();
  });
  
// MongoDB API Base URL (Unchanged)
const apiUrl = 'https://ap-south-1.aws.data.mongodb-api.com/app/bharat-rooms-gwvyy/endpoint/rooms';

// Fetch messages for a room (Unchanged)
app.post('/get-messages', async (req, res) => {
  const { roomId } = req.body;

  const data = JSON.stringify({
    data: { room: roomId },
    srvc: '9d63341f655a427384825cca4a3f404e4'
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${apiUrl}/message/list`,
    headers: {
      'Authorization': '******', // Replace with your API key
      'Content-Type': 'application/json'
    },
    data: data
  };

  try {
    const response = await axios.request(config);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// Send a message to a room (Unchanged)
app.post('/send-message', async (req, res) => {
  const { roomId, message, userDetails } = req.body;

  const messageData = JSON.stringify({
    data: {
      room: roomId,
      text: message,
      template: "",
      mode: 'text',
      media: {},
      sorc: 'user',
      sender: userDetails,
      receiver: { name: '', mail: '', item: '', mobile: '' }
    },
    srvc: '9d63341f655a427384825cca4a3f404e4'
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${apiUrl}/message/add`,
    headers: {
      'Authorization': '******', // Replace with your API key
      'Content-Type': 'application/json'
    },
    data: messageData
  };

  try {
    const response = await axios.request(config);
    io.to(roomId).emit('message', {
      userId: userDetails.name,
      message: message
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('New user connected');
  
  // Join room by roomId
  socket.on('join-room', (data) => {
    const{roomId, user} = data;
    socket.join(roomId);
    io.to(roomId).emit('room-joined')
    console.log(`User joined room: ${roomId} user: ${user?.item}`);
  });

  socket.on('send-message', async (data) => {
    const { roomId, message, sender } = data;
    console.log(`Message received in room ${roomId}:`, message);

    if (!roomId || !message || !sender) {
      console.log("Missing data:", { roomId, message, sender });
      return;
    }
  
    console.log(`Message received in room ${roomId}:`, message);
  
    // Prepare message payload for MongoDB API
    const messageData = {
      data: {
        room: roomId,
        text: message,
        template: '',
        mode: 'text',
        media: {},
        sorc: 'user',
        sender: { name: sender.name, mail: sender.mail, item: sender.item, avatar: sender.avatar },
        receiver: { name: '', mail: '', item: '', mobile: '' }
      },
      srvc: '9d63341f655a427384825cca4a3f404e4'
    };
  
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${apiUrl}/message/add`,
      headers: {
        'Authorization': '******', // Replace with your API key
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(messageData)
    };
  
    try {
      // Send message to MongoDB API
      const response = await axios.request(config);
      console.log("Message stored in DB:", response.data);
      if(response.data.stat){
          
        // Emit the message to all users in the room
        io.to(roomId).emit('receive-message', { message: response?.data?.data?.message, sender });
      }
  
    } catch (error) {
      console.error("Error storing message in DB:", error);
    }
  });
  

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
