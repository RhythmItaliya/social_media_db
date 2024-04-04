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

// ========== // CHAT // ========== //
app.use('/chat', chatRoutes);

io.on('connection', (socket) => {
    const { messages } = require('./models');
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

// ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== // ===================== //

// ========== // API START // ========== //

// USERS FIND =============================================================================================================================================================
app.get('/users/:uuid', async (req, res) => {
    const { users, userProfiles } = require('./models');
    try {
        const uuid = req.params.uuid;

        const userData = await users.findOne({
            where: { uuid },
            include: [{ model: userProfiles, attributes: ['id', 'userId', 'firstName', 'lastName', 'gender', 'birthdate', 'location', 'bio', 'uuid'] }]
        });

        if (!userData) {
            return res.status(404).send({ error: 'User not found' });
        }

        const { id, username, userProfile } = userData;

        res.send({
            id,
            username,
            userProfile
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send('Server mein error hai...');
    }
});

// USERNAME_FIND // =============================================================================================================================================================
app.get('/:username', async (req, res) => {
    const { users } = require('./models');
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
    const { users, userProfiles, profilePhotes } = require('./models');
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


// PROFILE CREATE // =============================================================================================================================================================

// FINE PROFILE REDICTRE
app.get('/api/users/profileCreated/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const user = await users.findOne({ where: { uuid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const profileCreated = user.profileCreated;

        if (profileCreated === null || profileCreated === undefined || typeof profileCreated !== 'boolean') {
            return res.status(500).json({ error: 'Invalid profileCreated value' });
        }
        res.json({ profileCreated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// MAIN_PROFILE_CREATE // =============================================================================================================================================================
app.post('/api/profilepage/create/:uuid', async (req, res) => {

    const path = require('path');
    const fs = require('fs').promises;

    try {
        const { firstName, lastName, gender, birthdate, location, bio, data } = req.body;

        if (!firstName || !lastName || !gender || !birthdate || !location || !bio) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const user = await users.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const existingProfile = await userProfiles.findOne({
            where: { userId: user.id }
        });

        if (existingProfile) {
            return res.status(409).json({ success: false, error: 'Profile already exists.' });
        }

        const userProfileData = await userProfiles.create({
            userId: user.id,
            firstName,
            lastName,
            gender,
            birthdate,
            location,
            bio,
        });

        if (data) {
            if (typeof data !== 'string' || data.trim() === '') {
                return res.status(400).json({ success: false, error: 'Invalid or missing image data' });
            }

            const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
            const fileExtension = matches ? matches[1] : 'png';
            const uuidN = uuid.v4();
            const newFileName = `${uuidN}.${fileExtension}`;
            const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
            const filePath = path.join(__dirname, '/Profilephotoes', newFileName);

            await Promise.all([
                await fs.writeFile(filePath, image),
                profilePhotes.create({
                    userProfileId: userProfileData.id,
                    photoURL: newFileName,
                }),
                // user.update({ profileCreated: true }),
            ]);
        }

        user.update({ profileCreated: true });
        res.status(201).json({ success: true, message: 'User profile created successfully', userProfileData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred on the server.' });
    }
});


// DARK MODE // =============================================================================================================================================================
app.get('/api/user/profiles/:uuid/mode', async (req, res) => {
    try {
        const user = await users.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userProfile = await userProfiles.findOne({
            where: { userId: user.id }
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        res.status(200).json({ darkMode: userProfile.darkMode });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/user/profiles/:uuid/mode', async (req, res) => {
    const { users, userProfiles } = require('./models');

    try {
        const user = await users.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userProfile = await userProfiles.findOne({
            where: { userId: user.id }
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        let darkModeValue;
        if (req.body.darkMode) {
            darkModeValue = 1;
        } else {
            darkModeValue = 0;
        }

        const [rowsUpdated] = await userProfiles.update(
            { darkMode: darkModeValue },
            {
                where: {
                    userId: user.id,
                    darkMode: { [Op.not]: darkModeValue },
                }
            }
        );

        if (rowsUpdated === 0) {
            return res.status(200).json({
                message: `Dark mode ${darkModeValue === 1 ? 'enabled' : 'disabled'} successfully`,
                darkMode: darkModeValue
            });
        }

        return res.status(200).json({
            message: `Dark mode ${darkModeValue === 1 ? 'enabled' : 'disabled'} successfully`,
            darkMode: darkModeValue
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/userProfile/create/:uuid', async (req, res) => {
    const { users, userProfiles } = require('./models');

    try {

        const user = await users.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userProfileData = await userProfiles.create({
            userId: user.id,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            gender: req.body.gender,
            birthdate: req.body.birthdate,
            location: req.body.location,
            bio: req.body.bio,
        });

        res.status(201).send({ message: 'User profile created successfully', userProfileData });
    } catch (error) {
        console.log(error);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});

//  FIND FATA FOR SETTINGS // =============================================================================================================================================================


// PROFILE GET // =============================================================================================================================================================

// SUGGESTED_FRIEND
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

app.get('/api/userProfiles/:uuid', async (req, res) => {
    const { userProfiles, profilePhotes, users, friendRequests } = require('./models');
    const { uuid } = req.params;

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid },
            include: [
                { model: users, attributes: ['username'] },
            ],
            attributes: ['id', 'uuid', 'firstName', 'lastName', 'createdAt']
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const otherUserProfiles = await userProfiles.findAll({
            where: {
                uuid: {
                    [Op.ne]: userProfile.uuid
                }
            },
            include: [
                {
                    model: users,
                    attributes: ['username']
                },
            ],
            attributes: ['id', 'uuid', 'firstName', 'lastName', 'createdAt']
        });

        const filteredProfiles = await Promise.all(otherUserProfiles.map(async (profile) => {
            const profilePhoto = await profilePhotes.findOne({
                where: { userProfileId: profile.id },
                attributes: ['photoURL']
            });

            const isSender = await friendRequests.findOne({
                where: {
                    senderId: userProfile.id,
                    receiverId: profile.id,
                    status: { [Op.in]: ['1', '2'] }
                }
            });

            const isReceiver = await friendRequests.findOne({
                where: {
                    senderId: profile.id,
                    receiverId: userProfile.id,
                    status: { [Op.in]: ['1', '2'] }
                }
            });

            if (!isSender && !isReceiver) {
                return {
                    id: profile.id,
                    uuid: profile.uuid,
                    username: profile.user ? profile.user.username : null,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    createdAt: profile.createdAt,
                    photoURL: profilePhoto ? profilePhoto.photoURL : null,
                };
            }
            return null;
        }));

        const validProfiles = filteredProfiles.filter(profile => profile !== null);
        const shuffledProfiles = shuffleArray(validProfiles);
        const response = shuffledProfiles.slice(0, Math.min(10, shuffledProfiles.length));

        res.send({ userProfiles: response });
    } catch (e) {
        console.log(e);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});




// FIND_SENDER_AND_RICVER_FRIENDREUSRT
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


// PROFILE PHOTOS // =============================================================================================================================================================

// FINDE_PROFILE_PHOTOES
app.get('/profilephotoes/:uuid', async (req, res) => {
    const { profilePhotes, userProfiles } = require('./models');
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

// FINDPROFILE PHOTO
app.get('/profile/profilePhoto/:uuid', async (req, res) => {
    const { userProfiles, profilePhotes } = require('./models');
    try {
        const uuid = req.params.uuid;

        const userProfile = await userProfiles.findOne({
            where: { uuid },
            attributes: ['id'],
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const foundProfilePhoto = await profilePhotes.findOne({
            where: { userProfileId: userProfile.id },
            attributes: ['photoURL'],
        });

        if (!foundProfilePhoto) {
            return res.status(404).send({ error: 'Profile photo not found' });
        }

        const { photoURL } = foundProfilePhoto;

        // Construct the complete URL for the image
        const completeImageUrl = `http://static.profile.local/${photoURL}`;

        res.send({ completeImageUrl });
    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});






// FRIEND // =============================================================================================================================================================

const { userProfiles, friendships, friendRequests, profilePhotes } = require('./models');


// PUBLIC_PROFILE_SEND_REQUEST //
app.post('/public/friendRequests', async (req, res) => {
    const senderUUID = req.body.senderId;
    const receiverUUID = req.body.receiverId;

    if (!senderUUID || !receiverUUID) {
        return res.status(400).send({ error: 'SenderUUID and ReceiverUUID are required' });
    }

    try {
        const senderUserInstance = await users.findOne({
            where: { uuid: senderUUID },
            include: userProfiles,
        });

        if (!senderUserInstance) {
            return res.status(400).send({ error: 'Sender profile not found' });
        }

        const senderUserProfileUuid = senderUserInstance.userProfile.uuid;

        if (senderUserProfileUuid === receiverUUID) {
            return res.status(422).send({ error: 'Unprocessable Entity: Cannot send your own profile to a crush' });
        }

        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUserProfileUuid } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });


        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        // Check if there is an existing friend request
        const existingRequest = await friendRequests.findOne({
            where: {
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
            },
        });

        if (existingRequest) {
            // If the request already exists, update it
            const newStatus = existingRequest.status === '1' ? '3' : '1';

            const updatedFriendRequest = await friendRequests.update(
                { status: newStatus },
                {
                    where: {
                        senderId: senderProfile.id,
                        receiverId: receiverProfile.id,
                    },
                }
            );

            if (updatedFriendRequest > 0) {
                return res.send({ success: true, message: 'Friend request updated successfully' });
            } else {
                return res.status(404).send({ success: false, error: 'Friend request not found' });
            }
        } else {
            // If the request doesn't exist, create a new one
            const friendRequest = await friendRequests.create({
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
                status: '1',
            });

            return res.send(friendRequest);
        }
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

app.get('/get/public/friendRequests/:uuid', async (req, res) => {
    try {
        const userProfileUuid = req.params.uuid;

        const friendRequest = await friendRequests.findOne({
            where: {
                [Op.or]: [
                    { '$sender.uuid$': { [Op.eq]: userProfileUuid } },
                    { '$receiver.uuid$': { [Op.eq]: userProfileUuid } },
                ],
            },
            include: [
                { model: userProfiles, as: 'sender', attributes: ['id', 'uuid'] },
                { model: userProfiles, as: 'receiver', attributes: ['id', 'uuid'] },
            ],
        });

        if (!friendRequest) {
            return res.status(202).json({ success: false });
        }

        const status = friendRequest.status;
        res.json({ success: true, status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// =============================================================================================================================================================

// FRIENDREQUESTS GET
app.get('/friendRequests/:receiverUUID', async (req, res) => {
    const receiverUUID = req.params.receiverUUID;

    if (!receiverUUID) {
        return res.status(400).send({ error: 'ReceiverUUID is required' });
    }

    try {
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!receiverProfile) {
            return res.status(400).send({ error: 'Receiver profile not found' });
        }

        const friendRequestsList = await friendRequests.findAll({
            where: {
                receiverId: receiverProfile.id,
                status: '1',
            },
            include: [
                { model: userProfiles, as: 'sender' },
                { model: userProfiles, as: 'receiver' },
            ],
        });

        if (!friendRequestsList || friendRequestsList.length === 0) {
            return res.status(404).json({ error: 'Friend requests not found' });
        }

        const senderUUIDs = friendRequestsList.map(request => request.sender.uuid);

        const senderProfilesPromises = senderUUIDs.map(async (senderUUID) => {
            return new Promise((resolve, reject) => {
                const api2Url = `http://localhost:8080/api/user/profile/receiver/${senderUUID}`;

                http.get(api2Url, (api2Response) => {
                    let data = '';

                    api2Response.on('data', (chunk) => {
                        data += chunk;
                    });

                    api2Response.on('end', async () => {
                        try {
                            const parsedData = JSON.parse(data);

                            const userProfile = await userProfiles.findOne({
                                include: [{ model: users, attributes: ['username'] }],
                            });

                            if (userProfile) {
                                const { username } = userProfile.user;
                                resolve({ parsedData, username });
                            } else {
                                reject({ status: 404, message: 'User not found' });
                            }
                        } catch (error) {
                            console.error(`Error fetching sender profile for UUID ${senderUUID}: ${error.message}`);
                            reject(error);
                        }
                    });
                }).on('error', (error) => {
                    console.error(`Error fetching sender profile for UUID ${senderUUID}: ${error.message}`);
                    reject(error);
                });
            });
        });

        const senderProfiles = await Promise.all(senderProfilesPromises);

        const combinedResponses = friendRequestsList.map((request, index) => {
            const senderProfile = senderProfiles[index] || {};
            const { parsedData, username } = senderProfile;

            return {
                friendRequest: {
                    uuid: request.uuid,
                    sender: {
                        uuid: request.sender.uuid,
                    },
                    receiver: {
                        uuid: request.receiver.uuid,
                    },
                },
                senderProfile: {
                    firstName: parsedData.firstName,
                    lastName: parsedData.lastName,
                    completeImageUrl: parsedData.completeImageUrl,
                    // username: username,
                },
            };
        });

        // Send the complete response to the client
        return res.send(combinedResponses);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// USER FRIEND FIND //
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

// FRIEND_REQUEST_SEND //
app.post('/friendRequests', async (req, res) => {
    const senderUUID = req.body.senderId;
    const receiverUUID = req.body.receiverId;

    if (!senderUUID || !receiverUUID) {
        return res.status(400).send({ error: 'SenderUUID and ReceiverUUID are required' });
    }

    if (senderUUID === receiverUUID) {
        return res.status(400).send({ error: 'Cannot send friend request to yourself' });
    }

    try {
        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUUID } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        // Check if the receiver has sent a friend request to the sender
        const reverseRequest = await friendRequests.findOne({
            where: {
                senderId: receiverProfile.id,
                receiverId: senderProfile.id,
            },
        });

        if (reverseRequest && reverseRequest.status === '1') {
            return res.status(400).send({ error: 'Friend request already received from the user. Cannot send a request until it is accepted or rejected.' });
        }

        // Check if there is an existing friend request from sender to receiver
        const existingRequest = await friendRequests.findOne({
            where: {
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
            },
        });

        if (existingRequest) {
            if (existingRequest.status === '1') {
                return res.status(400).send({ error: 'Friend request already sent' });
            } else if (existingRequest.status === '2') {
                return res.status(400).send({ error: 'Friend request already accepted. Cannot send another request.' });
            }
        }

        // Check if there is an existing friend request from receiver to sender with status '2'
        const reverseExistingRequest = await friendRequests.findOne({
            where: {
                senderId: receiverProfile.id,
                receiverId: senderProfile.id,
                status: '2',
            },
        });

        if (reverseExistingRequest) {
            return res.status(400).send({ error: 'Friend request has already been accepted. Cannot send another request.' });
        }

        const friendRequest = await friendRequests.create({
            senderId: senderProfile.id,
            receiverId: receiverProfile.id,
            status: '1',
        });

        res.send(friendRequest);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});


// GET_PROFILES_FROM_FRIEND_REQUESTS //
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

// FIND FRIENDSHPIS // =============================================================================================================================================================

app.get('/api/friendships/users/:profileUuid', async (req, res) => {
    try {
        const profileUuid = req.params.profileUuid;

        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const foundFriendships = await friendships.findAll({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
            include: [
                {
                    model: userProfiles,
                    as: 'userProfile1',
                    attributes: ['id', 'userId', 'firstName', 'lastName', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
                {
                    model: userProfiles,
                    as: 'userProfile2',
                    attributes: ['id', 'userId', 'firstName', 'lastName', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
            ],
        });

        const friendProfiles = await Promise.all(foundFriendships.map(async (friendship) => {
            // Assuming userProfile1 and userProfile2 also have a user association
            const friendUserProfile = friendship.userProfile1.id !== userProfile.id
                ? friendship.userProfile1
                : friendship.userProfile2;

            const photoURLRecord = await profilePhotes.findOne({
                where: { userProfileId: friendUserProfile.id },
                attributes: ['photoURL'],
            });

            const photoURL = photoURLRecord?.photoURL;
            const completeImageUrl = photoURL ? `http://static.profile.local/${photoURL}` : null;

            return {
                ...friendUserProfile.toJSON(),
                photoURL: completeImageUrl,
                username: friendUserProfile.user.username,
            };
        }));

        res.send({ friends: friendProfiles });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// FRIENDSHIP COUNT // 
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


//CHAT // =============================================================================================================================================================



// POST  // ============================================================================================================================================================= 

const { users } = require('./models');















// POST_COMMENT // =============================================================================================================================================================











// =============================================================================================================================================================

// FRIENDSHIP, CRUSH, AND IGNORE COUNT //
app.get('/api/friendships-crushes-ignores/count/:profileUuid', async (req, res) => {
    const { crushes, ignores } = require('./models');
    try {
        const profileUuid = req.params.profileUuid;

        // Find the user profile with the given UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const friendshipCount = await friendships.count({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        const crushCount = await crushes.count({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
                status: '2'
            },
        });

        const ignoreCount = await ignores.count({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
                status: '2'
            },
        });

        res.send({ friendshipCount, crushCount, ignoreCount });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

