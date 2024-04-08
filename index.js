const express = require('express');
const bodyParser = require('body-parser');

const sendMail = require('./untils/mailer');
const config = require('./config');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { param, body, validationResult } = require('express-validator');
const { Op, literal } = require('sequelize');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

// ========== // SOCKET.IO // ========== //
const http = require('http');
const socketIO = require('socket.io');
const server = http.createServer(app);
const io = socketIO(server, config.socketIO);

// ========== // CORS // ========== //
app.use(cors(config.corsOptions));
app.use(bodyParser.json({ limit: '20mb' }));
app.use(cookieParser(config.cookieSecret));

// ========== // SERVER // ========== //
server.listen(config.server.port, () => console.log('Server is Conneted...', config.server.port));

// ========== // TABLES // ========== //
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('./models');


// ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== //

// ========== // ROUTES // ========== //
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const searchRoutes = require('./routes/search');
const crushesRoutes = require('./routes/crushes');
const ignoresRoutes = require('./routes/ignores');
const chatRoutes = require('./routes/chat');
const ratingsRoutes = require('./routes/ratings');
const adminRoutes = require('./routes/admins');
const reportsRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const postsRoutes = require('./routes/posts');
const postCommentsRoutes = require('./routes/postComments');
const hashtagsRoutes = require('./routes/hashtags');
const notificationsRouter = require('./routes/notifications');
const contactsUsRouter = require('./routes/contactUs');
const blogsRoutes = require('./routes/blogs');
const friendsRoutes = require('./routes/friends');
const darkmodeRoutes = require('./routes/darkmode');
const createRoutes = require('./routes/createProfile');
const photosRoutes = require('./routes/profilePhotos');
const usersRoutes = require('./routes/usersMain');
const shareRoutes = require('./routes/share');

// ========== // ADMIN // ========== //
app.use('/admins', adminRoutes);

// ========== // AUTH // ========== //
app.use('/auth', authRoutes);

// ========== // STORIES // ========== //
app.use('/stories', storiesRoutes);

// ========== // SEARCH // ========== //
app.use('/search', searchRoutes)

// ========== // CRUSH // ========== //
app.use('/crushes', crushesRoutes);

// ========== // IGNORE // ========== //
app.use('/ignores', ignoresRoutes);

// ========== // RATTINGS // ========== //
app.use('/ratings', ratingsRoutes);

// ========== // REPORTS // ========== //
app.use('/reports', reportsRoutes);

// ========== // SETTINGS // ========== //
app.use('/settings', settingsRoutes);

// ========== // POST // ========== //
app.use('/posts', postsRoutes);

// ========== // POST COMMENTS // ========== //
app.use('/comments', postCommentsRoutes);

// ========== // POST NOTIFICATION // ========== //
app.use('/notifications', notificationsRouter);

// ========== // HASHTAGS // ========== //
app.use('/hashtags', hashtagsRoutes);

// ========== // CONTACTUS // ========== //
app.use('/contactsus', contactsUsRouter);

// ========== // BLOGS // ========== //
app.use('/blogs', blogsRoutes);

// ========== // FRIEND // ========== //
app.use('/friends', friendsRoutes);

// ========== // DARKMODE // ========== //
app.use('/darkmode', darkmodeRoutes);

// ========== // USER PROFILE CREATE // ========== //
app.use('/create', createRoutes);

// ========== // PHTOES // ========== //
app.use('/photos', photosRoutes);

// ========== // USERS // ========== //
app.use('/users', usersRoutes);

// ========== // SHARE // ========== //
app.use('/share', shareRoutes);

// ========== // CHAT // ========== //
app.use('/chat', chatRoutes);

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log('User connected with ID:', userId);

    socket.on('join-room', ({ room }) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    socket.on('leave-room', ({ room }) => {
        socket.leave(room);
        console.log(`User left room: ${room}`);
    });

    socket.on('send-message', async (data) => {
        try {
            const { senderUuid, receiverUuid, content, room } = data;

            const [senderUser, receiverUser] = await Promise.all([
                userProfiles.findOne({ where: { uuid: senderUuid } }),
                userProfiles.findOne({ where: { uuid: receiverUuid } })
            ]);

            if (!senderUser || !receiverUser) {
                console.error('Sender or receiver not found');
                return;
            }

            const { id: senderId } = senderUser;
            const { id: receiverId } = receiverUser;

            const newMessage = await messages.create({
                senderId,
                receiverId,
                content,
                roomId: room,
            });

            io.to(room).emit('new-message', {
                senderId: senderUuid,
                receiverId: receiverUuid,
                content,
                room,
            });

            console.log('New message received on server:', {
                senderId: senderUuid,
                receiverId: receiverUuid,
                content,
                room,
            });

            // io.to(room).emit('new-message', newMessage);

            // Emit notification to the receiver
            // io.to(receiverUuid).emit('notification-message', newMessage);

        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected with ID:', userId);
    });
});

app.delete('/chat/delete-chat/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const deletedMessage = await messages.destroy({
            where: {
                id: id
            }
        });

        if (deletedMessage === 1) {
            io.emit('message-deleted', { messageId: id });

            res.status(200).json({ message: 'Message deleted successfully' });
        } else {
            res.status(404).json({ error: 'Message not found' });
        }
    } catch (error) {
        // Handle errors
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== //


// ========== // EXTRA API // ========== //

app.get('/:username', async (req, res) => {

    try {
        const { username } = req.params;

        const user = await users.findOne({
            where: {
                username: username
            },
            attributes: ['username']
        });

        if (user) {
            res.status(202).send({ success: true });
        } else {
            res.status(404).send({ success: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/found/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await users.findOne({
            where: {
                username: username
            },
            include: [{
                model: userProfiles,
                attributes: ['uuid'],
                include: [{
                    model: profilePhotes,
                    attributes: ['photoURL']
                }]
            }],
            attributes: ['uuid', 'username']
        });

        if (user) {
            res.status(202).send({ success: true, user });
        } else {
            res.status(404).send({ success: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/profilephotoes/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;

        // Find the user profile associated with the UUID
        const profile = await userProfiles.findOne({
            where: { uuid }
        });

        if (!profile) {
            return res.status(404).send('User profile not found.');
        }

        const profilePhoto = await profilePhotes.findOne({
            where: { userProfileId: profile.id }
        });

        if (!profilePhoto) {
            return res.status(404).send({ found: false });
        }

        res.send({ found: true });
    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});

app.get('/api/friendrequests/find/:uuid', async (req, res) => {
    try {
        const userUuid = req.params.uuid;

        if (!userUuid) {
            return res.status(400).json({ error: 'Missing userUuid in the URL parameters' });
        }

        const userProfile = await userProfiles.findOne({
            where: { uuid: userUuid },
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        const friendRequestsList = await friendRequests.findAll({
            where: {
                [Op.or]: [
                    { senderId: userProfile.id },
                    { receiverId: userProfile.id },
                ],
                status: '1',
            },
            include: [
                { model: userProfiles, as: 'sender' },
                { model: userProfiles, as: 'receiver' },
            ],
        });

        const formattedFriendRequests = friendRequestsList.map(request => {
            const sender = {
                id: request.sender.id,
                firstName: request.sender.firstName,
                uuid: request.sender.uuid,
            };
            const receiver = {
                id: request.receiver.id,
                firstName: request.sender.firstName,
                uuid: request.receiver.uuid,
            };
            return {
                id: request.id,
                sender,
                receiver,
                status: request.status,
                uuid: request.uuid,
            };
        });

        res.json(formattedFriendRequests);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/userProfiles/:profileId/friends', async (req, res) => {
    const profileId = req.params.uuid;
    const user = await userProfiles.findOne(profileId, {
        include: [
            {
                model: userProfiles,
                as: 'friends',
                through: 'friendships',
            },
        ],
    });
    res.send(user.friends);
});

app.get('/get/friendRequests/:uuid', async (req, res) => {
    const uuid = req.params.uuid;

    try {
        const userProfile = await userProfiles.findOne({ where: { uuid: uuid } });

        if (!userProfile) {
            return res.status(400).send({ error: 'User profile not found' });
        }

        const sentRequests = await friendRequests.findAll({
            where: { senderId: userProfile.id },
            attributes: ['receiverId']
        });

        const receivedRequests = await friendRequests.findAll({
            where: { receiverId: userProfile.id },
            attributes: ['senderId']
        });

        const senderUUIDs = sentRequests.map(request => request.receiverId);
        const receiverUUIDs = receivedRequests.map(request => request.senderId);

        const senderProfiles = await userProfiles.findAll({
            where: { id: senderUUIDs },
            attributes: ['uuid']
        });

        const receiverProfiles = await userProfiles.findAll({
            where: { id: receiverUUIDs },
            attributes: ['uuid']
        });

        res.send({ senderProfiles: senderProfiles, receiverProfiles: receiverProfiles });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

app.get('/api/user/profile/receiver/:uuid', async (req, res) => {
    const uuid = req.params.uuid;

    try {
        // Find the user profile based on the UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid },
            attributes: ['id', 'firstName', 'lastName'],
        });

        // If user profile not found, return a 404 response
        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Find the associated profile photo based on the user profile ID
        const foundProfilePhoto = await profilePhotes.findOne({
            where: { userProfileId: userProfile.id },
            attributes: ['photoURL'],
        });

        // Extract data or set to null if not present
        const firstName = userProfile.firstName || null;
        const lastName = userProfile.lastName || null;
        const photoURL = foundProfilePhoto ? foundProfilePhoto.photoURL : null;

        // Construct the complete image URL or set it to null if the photo is not found
        const completeImageUrl = photoURL ? `http://static.profile.local/${photoURL}` : null;

        // Construct the response data
        const responseData = {
            firstName: firstName,
            lastName: lastName,
            completeImageUrl: completeImageUrl,
        };

        // Send the response
        res.send(responseData);
    } catch (error) {
        console.error(error);
        // If there's an error, return a 500 response
        return res.status(500).send('Internal Server Error');
    }
});

app.put('/friendRequests/:requestId/accept', async (req, res) => {
    const requestId = req.params.requestId;

    try {
        const friendRequest = await friendRequests.findOne({
            where: { uuid: requestId }
        });
        if (!friendRequest) {
            return res.status(404).send({ error: 'Friend request not found' });
        }

        friendRequest.status = '2';
        await friendRequest.save();

        await friendships.create({
            userProfile1Id: friendRequest.senderId,
            userProfile2Id: friendRequest.receiverId,
            status: '2',
        });

        res.send(friendRequest);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

app.delete('/delete/friend/request/:uuid', async (req, res) => {
    const friendRequestUUID = req.params.uuid;

    try {
        // Check if the friend request with the given UUID exists
        const existingFriendRequest = await friendRequests.findOne({
            where: { uuid: friendRequestUUID },
        });

        if (!existingFriendRequest) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        // Delete the friend request
        await friendRequests.destroy({
            where: { uuid: friendRequestUUID },
        });

        res.status(200).send({ message: 'Friend request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/api/friendships/count/:profileUuid', async (req, res) => {
    try {
        const profileUuid = req.params.profileUuid;

        // Find the user profile with the given UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Count all friendships where the user is either userProfile1 or userProfile2
        const friendshipCount = await friendships.count({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        res.send({ friendshipCount });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== //
