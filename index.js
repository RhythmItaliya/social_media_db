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
    const { users, userProfiles } = require('./models');

    console.log('Received UUID:', req.params.uuid);

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

        const isDarkMode = userProfile.darkMode === 1;

        res.status(200).send({ darkMode: isDarkMode });
    } catch (error) {
        console.error(error);
        return res.status(500).send('There was a server error...');
    }
});


app.put('/api/user/profiles/:uuid/mode', async (req, res) => {
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

        const updatedDarkModeValue = req.body.darkMode ? 1 : 0;

        await userProfile.update({ darkMode: updatedDarkModeValue });

        await userProfile.save();

        res.status(200).send({
            message: 'Dark mode updated successfully',
            darkModeValue: updatedDarkModeValue,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('There was a server error...');
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
app.get('/userProfile/get/:uuid', async (req, res) => {
    const { userProfiles, users, profilePhotes } = require('./models');

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
            include: [
                {
                    model: users,
                    attributes: ['username'],
                },
                {
                    model: profilePhotes,
                    attributes: ['photoURL'],
                },
            ],
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Construct the complete URL for the image
        const baseImageUrl = 'http://static.profile.local/';
        const completeImageUrl = userProfile.profilePhote ? baseImageUrl + userProfile.profilePhote.photoURL : null;

        const response = {
            username: userProfile.user ? userProfile.user.username : null,
            photoURL: completeImageUrl,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            gender: userProfile.gender,
            birthdate: userProfile.birthdate,
            location: userProfile.location,
            bio: userProfile.bio,
        };

        res.status(200).send(response);
    } catch (error) {
        console.log(error);
        return res.status(500).send('Internal Server Error');
    }
});

// UPDATE USER PROFILE
app.put('/userProfile/update/:uuid', async (req, res) => {
    const { userProfiles, users } = require('./models');

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
            include: [
                {
                    model: users,
                    attributes: ['username'],
                },
            ],
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Update user profile data based on request body
        userProfile.firstName = req.body.firstName || userProfile.firstName;
        userProfile.lastName = req.body.lastName || userProfile.lastName;
        userProfile.gender = req.body.gender || userProfile.gender;
        userProfile.birthdate = req.body.birthdate || userProfile.birthdate;
        userProfile.location = req.body.location || userProfile.location;
        userProfile.bio = req.body.bio || userProfile.bio;

        // Save the updated user profile
        await userProfile.save();

        const response = {
            username: userProfile.user ? userProfile.user.username : null,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            gender: userProfile.gender,
            birthdate: userProfile.birthdate,
            location: userProfile.location,
            bio: userProfile.bio,
        };

        res.status(200).send(response);
    } catch (error) {
        console.log(error);
        return res.status(500).send('Internal Server Error');
    }
});


// PROFILE GET // =============================================================================================================================================================

// SUGGESTED_FRIEND
// app.get('/api/userProfiles/:uuid', async (req, res) => {
//     const { userProfiles, profilePhotes, users } = require('./models');
//     const { uuid } = req.params;
//     try {
//         const userProfile = await userProfiles.findOne({
//             where: { uuid },
//             include: [
//                 { model: users, attributes: ['username'] },
//                 { model: profilePhotes, attributes: ['photoURL'] }
//             ],
//         });

//         if (!userProfile) {
//             return res.status(404).json({ error: 'User profile not found' });
//         }

//         const otherUserProfiles = await userProfiles.findAll({
//             where: {
//                 uuid: {
//                     [Op.ne]: userProfile.uuid
//                 }
//             },
//             include: [
//                 { model: users, attributes: ['username'] },
//                 { model: profilePhotes, attributes: ['photoURL'] }
//             ],
//         });
//         const response = otherUserProfiles.map(profile => {
//             return {
//                 uuid: profile.uuid,
//                 username: profile.user ? profile.user.username : null,
//                 photoURL: profile.profilePhote ? profile.profilePhote.photoURL : null,
//                 firstName: profile.firstName,
//                 lastName: profile.lastName,
//             };
//         });
//         res.send({ userProfiles: response });
//     } catch (e) {
//         console.log(e);
//         res.status(500).send({ e: 'Internal Server Error' });
//     }
// });


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
                { model: profilePhotes, attributes: ['photoURL'] }
            ],
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
                { model: users, attributes: ['username'] },
                { model: profilePhotes, attributes: ['photoURL'] }
            ],
        });

        const filteredProfiles = await Promise.all(otherUserProfiles.map(async (profile) => {
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
                    uuid: profile.uuid,
                    username: profile.user ? profile.user.username : null,
                    photoURL: profile.profilePhotos ? profile.profilePhotos.photoURL : null,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    createdAt: profile.createdAt
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

// POST_PROFILE_PHOTOES
app.post('/profilephotoes/:uuid', async (req, res) => {
    const { profilePhotes, userProfiles } = require('./models');
    try {

        const profile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        let originalFileName = req.body.name;
        let fileExtension = originalFileName.split('.').pop();

        let uuidN = uuid.v4();

        let newFileName = uuidN + '.' + fileExtension;

        let image = Buffer.from(req.body.data, 'base64');
        let filePath = __dirname + '/Profilephotoes/' + newFileName;
        fs.writeFileSync(filePath, image);

        let fileLink = newFileName;
        console.log(fileLink);

        await profilePhotes.create({
            userProfileId: profile.id,
            photoURL: fileLink,
        });

        res.send('ok');
    } catch (e) {
        console.log(error);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});


// UPDATE PROFILE PHOTO
app.put('/profilephotoes/update/:uuid', async (req, res) => {
    const { profilePhotes, userProfiles } = require('./models');

    try {
        const profile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!profile) {
            return res.status(404).send('User profile not found.');
        }

        // Find the existing profile photo associated with the user profile
        const existingPhoto = await profilePhotes.findOne({
            where: { userProfileId: profile.id }
        });

        // Get the existing file path
        const existingFilePath = __dirname + '/Profilephotoes/' + existingPhoto.photoURL;

        if (existingPhoto) {
            let newOriginalFileName = req.body.name;

            if (newOriginalFileName) {
                let newFileExtension = newOriginalFileName.split('.').pop();

                let uuidN = uuid.v4();
                let newFileName = uuidN + '.' + newFileExtension;

                let newImage = Buffer.from(req.body.data, 'base64');
                let filePath = __dirname + '/Profilephotoes/' + newFileName;
                fs.writeFileSync(filePath, newImage);

                // Update the database with the new profile photo URL
                const updatedPhoto = await existingPhoto.update({
                    photoURL: newFileName,
                    data: newImage,
                });

                // Delete the existing file from the server if the update is successful
                if (updatedPhoto) {
                    fs.unlink(existingFilePath, (err) => {
                        if (err) {
                            console.error('Error deleting file:', err);
                            res.status(500).send('Error deleting file.');
                        } else {
                            console.log('Deleting file at path:', existingFilePath);
                            console.log('File updated successfully');
                            res.send('ok'); // Send the response here
                        }
                    });
                } else {
                    console.log('Error updating photo in the database.');
                    res.status(500).send('Error updating file.');
                }
            } else {
                console.log('Error: req.body.name is undefined or null.');
                res.status(400).send('Bad Request: req.body.name is undefined or null.');
            }
        } else {
            // If there is no existing photo, you may want to handle this case accordingly
            console.log('No existing photo found.');
            res.status(404).send('No existing photo found.');
        }
    } catch (e) {
        console.error(e);
        return res.status(500).send('Error updating file.');
    }
});

// DELETE_PROFILE_PHOTOES
app.delete('/profilephotoes/delete/:uuid', async (req, res) => {

    const { profilePhotes, userProfiles } = require('./models');
    try {

        // Find the user profile associated with the UUID
        const profile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!profile) {
            return res.status(404).send('User profile not found.');
        }

        // Find the profile photo associated with the user profile
        const profilePhoto = await profilePhotes.findOne({
            where: { userProfileId: profile.id }
        });

        if (!profilePhoto) {
            return res.status(404).send('Profile photo not found.');
        }

        try {

            const filePath = __dirname + '/Profilephotoes/' + profilePhoto.photoURL;
            console.log('Deleting file at path:', filePath);

            fs.unlinkSync(filePath);
            console.log('File deleted successfully:', filePath);

        } catch (error) {
            console.error('Error deleting file:', error.message);
        }

        // Delete the profile photo entry from the database
        await profilePhoto.destroy();

        res.send('ok');
    } catch (e) {
        console.error(e);
        return res.status(500).send('Error deleting file.');
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
                    username: username,
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

const { userPosts, users } = require('./models');

// CREATE POST //
app.post('/api/posts', async (req, res) => {
    try {

        const { data } = req.body;

        // Check if data is a non-empty string
        if (typeof data !== 'string' || data.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid or missing data' });
        }

        const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        const fileExtension = matches ? matches[1] : 'png';
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        const filePath = __dirname + '/uploads/' + newFileName;
        fs.writeFileSync(filePath, image);
        const fileLink = newFileName;
        console.log(fileLink);

        // Post Creation Logic
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.body.userProfileId },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const isVisibility = req.body.isVisibility;
        const validatedIsVisibility = (isVisibility === '0' || isVisibility === '1') ? isVisibility : '0';
        const isPublic = validatedIsVisibility === '0';

        const newPost = await userPosts.create({
            userProfileId: userProfile.id,
            postText: req.body.postText,
            isPhoto: req.body.isPhoto,
            caption: req.body.caption,
            location: req.body.location,
            isVisibility: validatedIsVisibility,
            postUploadURLs: fileLink,
            hashtags: req.body.hashtags,
        });

        return res.status(201).send({ success: true, post: newPost });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// Assuming you're using Express.js
app.post('/api/create/posts/:uuid', async (req, res) => {
    try {
        const userProfileUUID = req.params.uuid;

        // Find the user profile by UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: userProfileUUID },
        });

        // Check if the user profile exists
        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const { data } = req.body;

        // Check if data is a non-empty string
        if (typeof data !== 'string' || data.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid or missing data' });
        }

        const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        const fileExtension = matches ? matches[1] : 'png';
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        const filePath = __dirname + '/uploads/' + newFileName;
        fs.writeFileSync(filePath, image);
        const fileLink = newFileName;

        // Post Creation Logic
        const isVisibility = req.body.isVisibility;
        const validatedIsVisibility = (isVisibility === '0' || isVisibility === '1') ? isVisibility : '0';
        const isPublic = validatedIsVisibility === '0';

        const newPost = await userPosts.create({
            userProfileId: userProfile.id,
            postText: req.body.postText,
            isPhoto: req.body.isPhoto,
            caption: req.body.caption,
            location: req.body.location,
            isVisibility: validatedIsVisibility,
            postUploadURLs: fileLink,
            hashtags: req.body.hashtags,
        });

        return res.status(201).send({ success: true, post: newPost });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// GET POST BY PROFILE_UUID // FRIEND POST //
// app.get('/find/api/posts/:userProfileUuid', async (req, res) => {
//     try {
//         // Find the user profile
//         const userProfile = await userProfiles.findOne({
//             where: { uuid: req.params.userProfileUuid },
//             include: [
//                 {
//                     model: users,
//                     attributes: ['username'],
//                 },
//             ],
//         });

//         if (!userProfile) {
//             return res.status(404).json({ success: false, error: 'User profile not found' });
//         }

//         // Find friends of the user using the friendships model
//         const userFriends = await friendships.findAll({
//             where: {
//                 [Op.or]: [
//                     { userProfile1Id: userProfile.id },
//                     { userProfile2Id: userProfile.id },
//                 ],
//             },
//         });

//         // Extract friend user profile IDs
//         const friendUserProfileIds = userFriends.map(friendship => {
//             return friendship.userProfile1Id === userProfile.id
//                 ? friendship.userProfile2Id
//                 : friendship.userProfile1Id;
//         });

//         // Find user profiles of friends
//         const friendsUserProfiles = await userProfiles.findAll({
//             where: { id: friendUserProfileIds },
//             include: [
//                 {
//                     model: users,
//                     attributes: ['username'],
//                 },
//             ],
//         });

//         // // Fetch posts of the user's friends
//         const friendsPosts = await userPosts.findAll({
//             where: { userProfileId: friendUserProfileIds, isVisibility: 1 },
//         });

//         // Find the associated profile photos for friends
//         const friendsProfilePhotos = await profilePhotes.findAll({
//             where: { userProfileId: friendUserProfileIds },
//             attributes: ['userProfileId', 'photoURL'],
//         });

//         // Map friends' profile photos to their respective user profiles
//         const friendsProfilePhotosMap = friendsProfilePhotos.reduce((map, photo) => {
//             map[photo.userProfileId] = photo.photoURL;
//             return map;
//         }, {});

//         // Fetch posts of the current user
//         const userPostsList = await userPosts.findAll({
//             where: { userProfileId: userProfile.id },
//         });

//         // Find the associated profile photo based on the user profile ID
//         const foundProfilePhoto = await profilePhotes.findOne({
//             where: { userProfileId: userProfile.id },
//             attributes: ['photoURL'],
//         });

//         // Include user profile without the repositories information
//         const userProfileWithoutRepos = {
//             id: userProfile.id,
//             username: userProfile.user.username,
//             photoURL: foundProfilePhoto ? foundProfilePhoto.photoURL : null,
//         };

//         // Include user profile, user information, friends' user profiles, and posts in the response
//         const responseObj = {
//             success: true,
//             userProfile: userProfileWithoutRepos,
//             friends: friendsUserProfiles.map(friend => ({
//                 id: friend.id,
//                 username: friend.user.username,
//                 photoURL: friendsProfilePhotosMap[friend.id] || null,
//             })),
//             posts: userPostsList,
//             friendsPosts: friendsPosts,
//         };

//         // Send response
//         return res.status(200).json(responseObj);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, error: 'Internal Server Error' });
//     }
// });

// // FRIEND-MAIN-POST //
// app.get('/find/api/posts/friend/:userProfileUuid', async (req, res) => {
//     try {
//         // Find the user profile
//         const userProfile = await userProfiles.findOne({
//             where: { uuid: req.params.userProfileUuid },
//             include: [
//                 {
//                     model: users,
//                     attributes: ['username'],
//                 },
//             ],
//         });

//         if (!userProfile) {
//             return res.status(404).json({ success: false, error: 'User profile not found' });
//         }

//         // Find friends of the user using the friendships model
//         const userFriends = await friendships.findAll({
//             where: {
//                 [Op.or]: [
//                     { userProfile1Id: userProfile.id },
//                     { userProfile2Id: userProfile.id },
//                 ],
//             },
//         });

//         // Extract friend user profile IDs
//         const friendUserProfileIds = userFriends.map(friendship => {
//             return friendship.userProfile1Id === userProfile.id
//                 ? friendship.userProfile2Id
//                 : friendship.userProfile1Id;
//         });

//         // Find user profiles of friends
//         const friendsUserProfiles = await userProfiles.findAll({
//             where: { id: friendUserProfileIds },
//             include: [
//                 {
//                     model: users,
//                     attributes: ['username'],
//                 },
//             ],
//         });

//         // // Fetch posts of the user's friends
//         const friendsPosts = await userPosts.findAll({
//             where: { userProfileId: friendUserProfileIds, isVisibility: 1 },
//             order: [['createdAt', 'DESC']],
//         });

//         // Find the associated profile photos for friends
//         const friendsProfilePhotos = await profilePhotes.findAll({
//             where: { userProfileId: friendUserProfileIds },
//             attributes: ['userProfileId', 'photoURL'],
//         });

//         // Map friends' profile photos to their respective user profiles
//         const friendsProfilePhotosMap = friendsProfilePhotos.reduce((map, photo) => {
//             map[photo.userProfileId] = photo.photoURL;
//             return map;
//         }, {});

//         // Fetch posts of the current user
//         const userPostsList = await userPosts.findAll({
//             where: { userProfileId: userProfile.id },
//         });

//         // Find the associated profile photo based on the user profile ID
//         const foundProfilePhoto = await profilePhotes.findOne({
//             where: { userProfileId: userProfile.id },
//             attributes: ['photoURL'],
//         });

//         // Include user profile without the repositories information
//         const userProfileWithoutRepos = {
//             id: userProfile.id,
//             username: userProfile.user.username,
//             photoURL: foundProfilePhoto ? foundProfilePhoto.photoURL : null,
//         };

//         // Include user profile, user information, friends' user profiles, and posts in the response
//         const responseObj = {
//             success: true,
//             userProfile: userProfileWithoutRepos,
//             friends: friendsUserProfiles.map(friend => ({
//                 id: friend.id,
//                 username: friend.user.username,
//                 photoURL: friendsProfilePhotosMap[friend.id] || null,
//             })),
//             // posts: userPostsList,
//             friendsPosts: friendsPosts,
//         };

//         // Send response
//         return res.status(200).json(responseObj);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, error: 'Internal Server Error' });
//     }
// });

// USER-MAIN-POST //
// app.get('/find/api/posts/user/:userProfileUuid', async (req, res) => {
//     try {
//         // Find the user profile
//         const userProfile = await userProfiles.findOne({
//             where: { uuid: req.params.userProfileUuid },
//             include: [
//                 {
//                     model: users,
//                     attributes: ['username'],
//                 },
//             ],
//         });

//         if (!userProfile) {
//             return res.status(404).json({ success: false, error: 'User profile not found' });
//         }

//         // Fetch posts of the current user
//         const userPostsList = await userPosts.findAll({
//             where: { userProfileId: userProfile.id },
//             order: [['createdAt', 'DESC']],
//         });

//         // Find the associated profile photo based on the user profile ID
//         const foundProfilePhoto = await profilePhotes.findOne({
//             where: { userProfileId: userProfile.id },
//             attributes: ['photoURL'],
//         });

//         // Include user profile without the repositories information
//         const userProfileWithoutRepos = {
//             id: userProfile.id,
//             username: userProfile.user.username,
//             photoURL: foundProfilePhoto ? foundProfilePhoto.photoURL : null,
//         };

//         // Include only user profile and user's posts in the response
//         const responseObj = {
//             success: true,
//             userProfile: userProfileWithoutRepos,
//             posts: userPostsList,
//         };

//         // Send response
//         return res.status(200).json(responseObj);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, error: 'Internal Server Error' });
//     }
// });

app.get('/find/api/posts/friend/:userProfileUuid', async (req, res) => {
    try {
        // Find the user profile
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.userProfileUuid },
            include: [
                {
                    model: users,
                    attributes: ['username'],
                },
            ],
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        // Find friends of the user using the friendships model
        const userFriends = await friendships.findAll({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        // Extract friend user profile IDs
        const friendUserProfileIds = userFriends.map(friendship => {
            return friendship.userProfile1Id === userProfile.id
                ? friendship.userProfile2Id
                : friendship.userProfile1Id;
        });

        // Find user profiles of friends
        const friendsUserProfiles = await userProfiles.findAll({
            where: { id: friendUserProfileIds },
            include: [
                {
                    model: users,
                    attributes: ['username'],
                },
            ],
        });

        // // Fetch posts of the user's friends
        const friendsPosts = await userPosts.findAll({
            where: { userProfileId: friendUserProfileIds, isVisibility: 1 },
            order: [['createdAt', 'DESC']],
        });

        // Find the associated profile photos for friends
        const friendsProfilePhotos = await profilePhotes.findAll({
            where: { userProfileId: friendUserProfileIds },
            attributes: ['userProfileId', 'photoURL'],
        });

        // Map friends' profile photos to their respective user profiles
        const friendsProfilePhotosMap = friendsProfilePhotos.reduce((map, photo) => {
            map[photo.userProfileId] = photo.photoURL;
            return map;
        }, {});

        // Fetch posts of the current user
        const userPostsList = await userPosts.findAll({
            where: { userProfileId: userProfile.id },
        });

        // Find the associated profile photo based on the user profile ID
        const foundProfilePhoto = await profilePhotes.findOne({
            where: { userProfileId: userProfile.id },
            attributes: ['photoURL'],
        });

        // Fetch liked posts by the current user
        const likedPostIds = await postLikes.findAll({
            where: { userProfileId: userProfile.id },
            attributes: ['postId'],
        });
        const likedPosts = likedPostIds.map(like => like.postId);

        // Include user profile without the repositories information
        const userProfileWithoutRepos = {
            id: userProfile.id,
            username: userProfile.user.username,
            photoURL: foundProfilePhoto ? foundProfilePhoto.photoURL : null,
        };

        // Include user profile, user information, friends' user profiles, and posts in the response
        const responseObj = {
            success: true,
            userProfile: userProfileWithoutRepos,
            friends: friendsUserProfiles.map(friend => ({
                id: friend.id,
                username: friend.user.username,
                photoURL: friendsProfilePhotosMap[friend.id] || null,
            })),
            // posts: userPostsList,
            friendsPosts: friendsPosts,
            likedPosts: likedPosts, // New addition
        };

        // Send response
        return res.status(200).json(responseObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.get('/find/api/posts/user/:userProfileUuid', async (req, res) => {
    try {
        // Find the user profile
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.userProfileUuid },
            include: [
                {
                    model: users,
                    attributes: ['username'],
                },
            ],
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        // Fetch posts of the current user
        const userPostsList = await userPosts.findAll({
            where: { userProfileId: userProfile.id },
            order: [['createdAt', 'DESC']],
        });

        // Find the associated profile photo based on the user profile ID
        const foundProfilePhoto = await profilePhotes.findOne({  // Retaining the variable name
            where: { userProfileId: userProfile.id },
            attributes: ['photoURL'],
        });

        // Include user profile without the repositories information
        const userProfileWithoutRepos = {
            id: userProfile.id,
            username: userProfile.user.username,
            photoURL: foundProfilePhoto ? foundProfilePhoto.photoURL : null,
        };

        // Fetch liked posts by the current user
        const likedPostIds = await postLikes.findAll({
            where: { userProfileId: userProfile.id },
            attributes: ['postId'],
        });
        const likedPosts = likedPostIds.map(like => like.postId);

        // Include only user profile and user's posts in the response
        const responseObj = {
            success: true,
            userProfile: userProfileWithoutRepos,
            posts: userPostsList,
            likedPosts: likedPosts, // New addition
        };

        // Send response
        return res.status(200).json(responseObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


// GET POST BY ID
app.get('/api/posts/get/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        if (!postId) {
            return res.status(400).json({ success: false, error: 'Invalid postId format' });
        }

        const post = await userPosts.findOne({
            where: { id: postId },
        });

        if (!post) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        return res.status(200).json({ success: true, post });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// UPDATE POST BY ID //
app.put('/api/posts/update/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        // Validate postId
        if (!postId) {
            return res.status(400).json({ success: false, error: 'Invalid postId' });
        }

        // Your existing logic to update a post
        const existingPost = await userPosts.findByPk(postId);

        if (!existingPost) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        // Update the post properties based on your requirements
        existingPost.postText = req.body.postText !== null && req.body.postText !== "" ? req.body.postText : existingPost.postText;
        existingPost.caption = req.body.caption !== null && req.body.caption !== "" ? req.body.caption : existingPost.caption;
        existingPost.location = req.body.location !== null && req.body.location !== "" ? req.body.location : existingPost.location;
        existingPost.hashtags = req.body.hashtags !== null && req.body.hashtags !== "" ? req.body.hashtags : existingPost.hashtags;

        // Save the updated post
        await existingPost.save();

        return res.status(200).json({ success: true, post: existingPost });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// UPDATE POST VISIBILITY //
app.put('/api/posts/visibility/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const { isVisibility } = req.body;

        // Validate isVisibility
        const validatedIsVisibility = (isVisibility === '0' || isVisibility === '1') ? isVisibility : '0';

        // Update the post visibility
        const updatedPost = await userPosts.update(
            { isVisibility: validatedIsVisibility },
            { where: { id: postId } }
        );

        if (updatedPost[0] === 0) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        return res.status(200).json({ success: true, message: 'Post visibility updated successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// DELETE POST //
app.delete('/api/posts/delete/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        if (!postId || isNaN(postId)) {
            return res.status(400).json({ success: false, error: 'Invalid postId' });
        }

        const postToDelete = await userPosts.findByPk(postId);

        if (!postToDelete) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        const fileLink = postToDelete.postUploadURLs;
        const filePath = __dirname + '/uploads/' + fileLink;
        fs.unlinkSync(filePath);

        await postToDelete.destroy();

        return res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// POST_COUNT  //
app.get('/api/userPostsCount/:profileUuid', async (req, res) => {
    try {
        const profileUuid = req.params.profileUuid;

        // Find the user profile based on the UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        // Count the number of posts for the user
        const postCount = await userPosts.count({
            where: { userProfileId: userProfile.id },
        });

        return res.status(200).json({ success: true, postCount });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// POST_GET_FOR_PROFILE //
app.get('/api/user/posts/profile/:uuid', async (req, res) => {
    const { uuid } = req.params;

    try {
        const userProfile = await userProfiles.findOne({
            where: {
                uuid: uuid
            }
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const posts = await userPosts.findAll({
            where: {
                userProfileId: userProfile.id
            },
            attributes: ['postUploadURLs']
        });

        res.json(posts);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST_GET_FOR_PROFILE_PUBLIC //
app.get('/api/user/posts/profile/public/:uuid', async (req, res) => {
    const { uuid } = req.params;

    try {
        const userProfile = await userProfiles.findOne({
            where: {
                uuid: uuid
            }
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const isFriend = await friendships.findOne({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id }
                ],
            }
        });

        if (!isFriend) {
            return res.status(403).json({ error: 'Access denied. Users are not friends.' });
        }

        const posts = await userPosts.findAll({
            where: {
                userProfileId: userProfile.id
            },
            attributes: ['postUploadURLs']
        });

        res.json(posts);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST_LIKE_COUNT
app.get('/api/post/likes/count/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;

        // Find the total number of likes for the specified post
        const likeCount = await postLikes.count({
            where: { postId: postId },
        });

        return res.status(200).json({ success: true, likeCount: likeCount });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// POST_COMMENT // =============================================================================================================================================================

const { postComments, commentLikes, postLikes } = require('./models');

// NEW_COMMET //
app.post('/api/post/comment', async (req, res) => {
    try {
        const { userProfileUUID, postId, commentText, commentReaction, reactionCount } = req.body;

        // Find the userProfile based on UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: userProfileUUID },
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Use userProfile.id as userProfileId in the comment creation
        const newComment = await postComments.create({
            postId,
            userProfileId: userProfile.id,
            commentText,
            commentReaction,
            reactionCount
        });

        res.status(201).send(newComment);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// DELETE_COMMET //
app.delete('/api/delete/comment/:commentId', async (req, res) => {
    try {
        const commentId = req.params.commentId;

        // Check if the comment with the given commentId exists
        const existingComment = await postComments.findByPk(commentId);

        if (!existingComment) {
            return res.status(404).send({ error: 'Comment not found' });
        }

        // Find and delete associated comment likes
        await commentLikes.destroy({
            where: { commentId: existingComment.id }
        });

        // Perform the deletion of the comment
        await existingComment.destroy();

        res.status(200).send({ message: 'Comment and associated likes deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// LIKE_COUNT AND LIKE_UNLIKE //
app.post('/api/post/comment/like', async (req, res) => {
    try {
        const { userProfileUUID, commentId } = req.body;

        // Find the userProfile based on UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: userProfileUUID },
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Check if the comment exists
        const comment = await postComments.findByPk(commentId);

        if (!comment) {
            return res.status(404).send({ error: 'Comment not found' });
        }

        // Check if the user has already liked the comment
        const existingLike = await commentLikes.findOne({
            where: {
                userProfileId: userProfile.id,
                commentId,
            },
        });

        if (existingLike) {
            // User has already liked the comment, so remove the like
            await commentLikes.destroy({
                where: {
                    userProfileId: userProfile.id,
                    commentId,
                },
            });

            // Decrement the reactionCount in the postComments table
            await postComments.decrement('reactionCount', {
                where: { id: commentId },
            });

            return res.status(200).send({ message: 'Like removed successfully' });
        }

        // User has not liked the comment, so create a new like
        const newLike = await commentLikes.create({
            userProfileId: userProfile.id,
            commentId,
        });

        // Increment the reactionCount in the postComments table
        await postComments.increment('reactionCount', {
            where: { id: commentId },
        });

        res.status(201).send(newLike);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// FIND_LIKE_USER_PROFILE //
app.get('/find/api/user/liked-comments/:userProfileUUID', async (req, res) => {
    try {
        const userProfileUUID = req.params.userProfileUUID;

        // Find the user profile based on UUID
        const userProfile = await userProfiles.findOne({
            where: { uuid: userProfileUUID },
        });

        if (!userProfile) {
            return res.status(404).send({ success: false, error: 'User not found' });
        }

        const userProfileId = userProfile.id;

        // Fetch liked comments for the user
        const likedComments = await commentLikes.findAll({
            where: { userProfileId: userProfileId },
            include: [
                {
                    model: postComments,
                    as: 'comment',
                    attributes: ['id', 'commentText', 'commentReaction', 'reactionCount'],
                    include: [
                        {
                            model: userProfiles,
                            as: 'userComment',
                            attributes: ['id'],
                            include: [
                                {
                                    model: users,
                                    attributes: ['username'],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const likedCommentsResponse = likedComments.map(commentLike => {
            return {
                id: commentLike.comment.id,
                commentText: commentLike.comment.commentText,
                commentReaction: commentLike.comment.commentReaction,
                reactionCount: commentLike.comment.reactionCount,
                user: {
                    username: commentLike.comment.userComment?.user?.username || null,
                },
            };
        });

        return res.status(200).send({
            success: true,
            user: {
                id: userProfile.id,
                username: userProfile.username,
            },
            likedComments: likedCommentsResponse,
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});


// POST_COMMENT_GET //
app.get('/find/api/post/comments/:postId', async (req, res) => {
    try {
        // Find the post using the provided ID
        const post = await userPosts.findOne({
            where: { id: req.params.postId },
        });

        if (!post) {
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        // Fetch comments for the post
        const postComment = await postComments.findAll({
            where: { postId: post.id },
            include: [
                {
                    model: userProfiles,
                    as: 'userComment',
                    attributes: ['id'],
                    include: [
                        {
                            model: users,
                            attributes: ['username'],
                        },
                    ],
                },
            ],
        });

        const commentsResponse = await Promise.all(postComment.map(async comment => {
            // Find the associated profile photo based on the user profile ID
            const foundProfilePhoto = await profilePhotes.findOne({
                where: { userProfileId: comment.userComment.id },
                attributes: ['photoURL'],
            });

            return {
                id: comment.id,
                commentText: comment.commentText,
                commentReaction: comment.commentReaction,
                reactionCount: comment.reactionCount,
                user: {
                    username: comment.userComment?.user?.username || null,
                    photoURL: foundProfilePhoto?.photoURL || null,
                },
            };
        }));

        // Send the response
        return res.status(200).send({
            success: true,
            post: {
                id: post.id,
            },
            comments: commentsResponse,
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});


// POST_COMMET_COUNT //
app.get('/api/post/comments/count/:postID', async (req, res) => {
    try {
        // Find the post using the provided post ID
        const post = await userPosts.findOne({
            where: { id: req.params.postID },
        });

        if (!post) {
            return res.status(404).send({ success: false, error: 'Post not found' });
        }

        // Count the number of comments for the post
        const commentCount = await postComments.count({
            where: { postId: post.id },
        });

        // Send the response with the comment count
        return res.status(200).send({
            success: true,
            post: {
                id: post.id,
            },
            commentCount: commentCount,
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// POST_LIKE //
app.post('/post/like', async (req, res) => {
    try {
        const { userProfileId, postId } = req.body;

        const user = await userProfiles.findOne({
            where: {
                uuid: userProfileId,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const existingLike = await postLikes.findOne({
            where: {
                userProfileId: user.id,
                postId,
            },
        });

        if (existingLike) {
            await existingLike.destroy();
            res.status(200).json({ like: false });
        } else {
            await postLikes.create({
                userProfileId: user.id,
                postId,
            });

            res.status(200).json({ like: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET_LIKED_POSTS_BY_USER //
app.get('/post/:userProfileId/liked', async (req, res) => {
    try {
        const { userProfileId } = req.params;
        const user = await userProfiles.findOne({
            where: {
                uuid: userProfileId,
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const likedPostIds = await postLikes.findAll({
            where: {
                userProfileId: user.id,
            },
            attributes: ['postId'],
        });
        const likedPosts = likedPostIds.map(like => like.postId);

        res.status(200).json(likedPosts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});








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

