const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Op } = require('sequelize');
const cors = require('cors');
const uuid = require('uuid');
const sendMail = require('./untils/mailer');
const fs = require('fs');

const app = express();

// Use CORS middleware with options
const corsOptions = {
    origin: 'http://localhost:3000', // Frontend origin
    credentials: true, // Enable credentials (cookies, headers)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '20mb' }));
app.use(cookieParser('QWERTYUIOPLKJHGFDSAZXCVBNM'));

// Socket.IO setup
// Socket.IO setup
const http = require('http');
const socketIO = require('socket.io');

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
});


//  RIGISTER API ----------------------------------------------------------------------------------------------
app.post('/register', async (req, res) => {
    const { users } = require('./models');

    try {
        // fill username email and password
        if (!req.body.username || !req.body.password || !req.body.email) {
            return res.status(400).send('Username, Password, and Email are required.');
        }

        // Check password length
        if (req.body.password.length < 8) {
            return res.status(400).send('Password is too short; minimum 8 characters required.');
        }

        // check username length
        if (req.body.username.length < 3 || req.body.username.length > 255) {
            return res.status(400).send('Username must be between 3 to 255 characters.');
        }

        // email validation
        const userEmail = await users.findOne({
            where: {
                email: req.body.email,
            }
        });

        if (userEmail) {
            return res.status(409).send({
                isEmail: false
            });
        }

        const userUsername = await users.findOne({
            where: {
                username: req.body.username,
            }
        });

        if (userUsername) {
            return res.status(409).send('Username is already taken');
        }

        const token = uuid.v1();

        users.create({
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
            token: token
        });

        const htmlBody = `<b>To verify your account: <a href="http://localhost:3000/verify/login/${token}">Link</a></b>`;
        sendMail(req.body.email, 'Your verify link', htmlBody);

        return res.status(201).send('Please check your email confirmation...');

    } catch (e) {
        console.error(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});

app.get('/verify/login/:token', async (req, res) => {
    const { users } = require('./models');

    try {
        const userV = await users.findOne({
            where: {
                token: req.params.token
            }
        });

        if (userV == null) {
            return res.send({
                isValid: false, // Link is Expired...
            });
        }

        const token = uuid.v1();

        users.update(
            {
                token: token,
                isActive: 1
            },
            {
                where: {
                    id: userV.id
                }
            });
        return res.status(201).send({
            isValid: true, // Link is verify...
        });

    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});


// LOGIN API ----------------------------------------------------------------------------------------------
app.post('/login', async (req, res) => {
    const { users } = require('./models');

    if ((typeof (req.body.username) === 'undefined') || (typeof (req.body.password) === 'undefined')) {
        return res.status(400).send('Pls fill the fild...')
    }

    const userL = await users.findOne({
        where: {
            [Op.or]: {
                username: req.body.username,
                email: req.body.username,
            },
            [Op.and]: {
                isActive: 1
            }
        }
    });
    if (!userL) {
        return res.status(401).send({ 'error': 'username and password is incorrect...' });
    }

    const check = bcrypt.compareSync(req.body.password, userL.password);

    if (check) {
        const token = jwt.sign({ uuid: userL.uuid }, 'ASXCVBNMPOJHGCXZWERTYUUHJBLKJHGED'); // jsonwebtoken

        res.cookie('X-Access-Token', token, { maxAge: 7776000000, signed: true, path: '/', secure: true, httpOnly: true }); // cookies

        return res.status(201).send({
            "X-Access-Token": token,
            "uuid": userL.uuid,
            "username": userL.username
        });
    } else {
        return res.status(401).send({ 'error': 'username and password is incorrect....' });
    }
});

// RESET PASSWORD REQUEST MAIL ----------------------------------------------------------------------------------------------

app.post('/reset/request', async (req, res) => {
    const { users } = require('./models');

    try {
        // email exists
        const resetlink = await users.findOne({
            where: {
                email: req.body.email
            }
        });

        if (!resetlink) {
            return res.status(404).send('Email not found.');
        }

        const token = uuid.v1();

        await users.update(
            {
                token: token,
            },
            {
                where: {
                    id: resetlink.id
                }
            });

        const resetLink = `http://localhost:3000/reset/password/${token}"`;
        sendMail(resetlink.email, 'Your Reset link', resetLink);

        res.status(200).send('Password reset link sent successfully.');

    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});

app.get('/resetlink/verify/:token', async (req, res) => {
    const { users } = require('./models');

    try {
        const userF = await users.findOne({
            where: {
                token: req.params.token
            }
        });

        if (!userF) {
            return res.status(404).send({
                isValid: false,
                messege: "Link is Expired"
            });
        }

        return res.status(201).send('Reset link is valid.');

    } catch (error) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});

// PASSWORD RESET ----------------------------------------------------------------------------------------------

app.post('/reset/password/:token', async (req, res) => {
    const { users } = require('./models');

    try {
        if ((typeof (req.body.password1) === 'undefined') || (typeof (req.body.password2) === 'undefined')) {
            return res.send('Pls fill the password fild...')
        }

        if (req.body.password1.length < 8 || req.body.password2.length < 8) {
            return res.status(400).send('Password is too short; minimum 8 characters required.');
        }

        if (req.body.password1 != req.body.password2) {
            return res.send('Your password do not match...');
        }

        const resetToken = req.params.token;

        const userU = await users.findOne({
            where: {
                token: resetToken
            }
        });

        if (!userU) {
            return res.status(404).send('This link has expired or is invalid.');
        }

        const token = uuid.v1();

        const updatedUser = await users.update(
            {
                password: bcrypt.hashSync(req.body.password2, 10),
                token: token,
                isActive: 1
            },
            {
                where: {
                    token: req.params.token
                },
            }
        );
        if (!updatedUser) {
            return res.status(404).send('User not found');
        }

        res.status(201).send('Your password has been updated...');

    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});


// UPLOADFILE ----------------------------------------------------------------------------------------------
app.post('/upload', (req, res) => {

    try {

        let originalFileName = req.body.name;
        let fileExtension = originalFileName.split('.').pop();

        let uuidN = uuid.v4();

        let newFileName = uuidN + '.' + fileExtension;

        let image = Buffer.from(req.body.data, 'base64');
        let filePath = __dirname + '/uploads/' + newFileName;
        fs.writeFileSync(filePath, image);

        let fileLink = '/uploads/' + newFileName;
        console.log(fileLink);

        res.send('ok');
    } catch (e) {
        console.error(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});



// USERS FIND ----------------------------------------------------------------------------------------------

app.get('/users/:uuid', async (req, res) => {
    const { users, userProfiles } = require('./models');
    try {
        const uuid = req.params.uuid;

        const userData = await users.findOne({
            where: { uuid },
            include: [{ model: userProfiles }]
        });
        if (!userData) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.send(userData);
    } catch (error) {
        console.log(error);
        return res.status(500).send('Lagata hai sever me error hai...');

    }
});

// PROFILE CREATE ----------------------------------------------------------------------------------------------

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

app.get('/userProfile/get/:uuid', async (req, res) => {
    const { userProfiles } = require('./models');

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const response = {
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




// PROFILE GET ----------------------------------------------------------------------------------------------

app.get('/api/userProfiles/:uuid', async (req, res) => {
    const { userProfiles, profilePhotes, users } = require('./models');
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
        const response = otherUserProfiles.map(profile => {
            return {
                uuid: profile.uuid,
                username: profile.user ? profile.user.username : null,
                photoURL: profile.profilePhote ? profile.profilePhote.photoURL : null,
            };
        });
        res.send({ userProfiles: response });
    } catch (e) {
        console.log(e);
        res.status(500).send({ e: 'Internal Server Error' });
    }
});

// PROFILE PHOTOS ----------------------------------------------------------------------------------------------

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


// ----------------------------


// FRIEND API
const { userProfiles, friendships, friendRequests } = require('./models');

// Endpoint to get a user's friends
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

// Endpoint to send a friend request
app.post('/friendRequests', async (req, res) => {
    const senderUUID = req.body.senderId;
    const receiverUUID = req.body.receiverId;

    if (!senderUUID || !receiverUUID) {
        return res.status(400).send({ error: 'SenderUUID and ReceiverUUID are required' });
    }

    try {

        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUUID } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        const existingRequest = await friendRequests.findOne({
            where: {
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
            },
        });

        if (existingRequest) {
            return res.status(400).send({ error: 'Friend request already sent' });
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


// // Endpoint to get friend requests for a specific receiver UUID with status '1' 
app.get('/friendRequests/:receiverUUID', async (req, res) => {
    const receiverUUID = req.params.receiverUUID;

    if (!receiverUUID) {
        return res.status(400).send({ error: 'ReceiverUUID is required' });
    }

    try {
        // Find receiver profile using UUID
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!receiverProfile) {
            return res.status(400).send({ error: 'Receiver profile not found' });
        }

        // Find all friend requests where the receiver is the specified profile and status is '1'
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

        // Extract relevant information for each friend request
        const formattedRequests = friendRequestsList.map(request => {
            const senderProfile = request.sender || {};
            const receiverProfile = request.receiver || {};

            return {
                uuid: request.uuid,
                sender: {
                    uuid: senderProfile.uuid,
                    // Include other relevant sender profile fields
                },
                receiver: {
                    uuid: receiverProfile.uuid,
                },
            };
        });

        return res.send(formattedRequests);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});


app.get('/api/user/profile/receiver/:uuid', async (req, res) => {

    const { userProfiles, profilePhotes } = require('./models');
    const uuid = req.params.uuid;

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid },
            attributes: ['id', 'firstName', 'lastName'],
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

        // If a profile photo is found, construct the complete URL
        const completeImageUrl = foundProfilePhoto ? `http://static.profile.local/${foundProfilePhoto.photoURL}` : null;
        // Map the data to the desired response format
        
        const responseData = {
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            completeImageUrl: completeImageUrl,
        };

        res.send(responseData);
    } catch (e) {
        console.log(e);
        return res.status(500).send('Lagata hai sever me error hai...');
    }
});




// // Endpoint to accept a friend request and become friends
app.put('/friendRequests/:requestId/accept', async (req, res) => {
    const requestId = req.params.uuid;

    try {
        const friendRequest = await friendRequests.findOne(requestId);
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






server.listen(8080, () => console.log('connected...'));