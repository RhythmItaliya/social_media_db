const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Op, literal } = require('sequelize');
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


app.post('/logout', (req, res) => {
    try {
        res.clearCookie('X-Access-Token');

        console.log('Token invalidated on the server');

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
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

// username find //
app.get('/:username', async (req, res) => {
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
            res.send({ success: true, user });
        } else {
            res.send({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});



// PROFILE CREATE ----------------------------------------------------------------------------------------------

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

// MAIN_PROFILE_CREATE
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


// DARK MODE
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

//  FIND FATA FOR SETTINGS
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


// PROFILE GET ----------------------------------------------------------------------------------------------

// SUGGESTED_FRIEND
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
                firstName: profile.firstName,
                lastName: profile.lastName,
            };
        });
        res.send({ userProfiles: response });
    } catch (e) {
        console.log(e);
        res.status(500).send({ e: 'Internal Server Error' });
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


// ------------------------------------------------------------------------------------  
// FRIEND API


const { userProfiles, friendships, friendRequests, profilePhotes } = require('./models');

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



// ------------------------------------------------------------------------------------  
// FIND FRIENDSHPIS

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

//CHAT //---------------------------------------------------------------------

const { messages } = require('./models');

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

            console.log('New message received on server:', {
                senderId,
                receiverId,
                content,
                room,
            });

            const newMessage = await messages.create({
                senderId,
                receiverId,
                content,
                roomId: room,
            });

            io.to(room).emit('new-message', newMessage);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected with ID:', userId);
    });
});

// CHAT_GET //
app.get('/get-messages/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;

        const user = await userProfiles.findOne({ where: { uuid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = user.id;

        const userMessages = await messages.findAll({
            where: {
                [Op.or]: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            include: [
                { model: userProfiles, as: 'sender', attributes: ['uuid'] },
                { model: userProfiles, as: 'receiver', attributes: ['uuid'] }
            ]
        });

        const formattedMessages = userMessages.map(message => {
            return {
                id: message.id,
                content: message.content,
                sender: message.sender ? message.sender.uuid : null,
                receiver: message.receiver ? message.receiver.uuid : null,
                createdAt: message.createdAt,
            };
        });

        res.send({ messages: formattedMessages });
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// CHAT_LAST_MESSEGE_GET // 
app.get('/get-last-message/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;

        const user = await userProfiles.findOne({ where: { uuid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = user.id;

        const lastMessage = await messages.findOne({
            where: {
                [Op.or]: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        if (!lastMessage) {
            return res.status(404).send({ error: 'No messages found for the user' });
        }

        const lastMessageData = {
            message: lastMessage.content,
            timestamp: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            receiverId: lastMessage.receiverId
        };

        res.send({ lastMessage: lastMessageData });
    } catch (error) {
        console.error('Error retrieving the last message:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});




// POST  //--------------------------------------------------------------------- 

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

// GET POST  //
app.get('/find/api/posts/:userProfileUuid', async (req, res) => {
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

        // Fetch posts of the user's friends
        const friendsPosts = await userPosts.findAll({
            where: { userProfileId: friendUserProfileIds },
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
            posts: userPostsList,
            friendsPosts: friendsPosts,
        };

        // Send response
        return res.status(200).json(responseObj);
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


// POST_COMMENT // ----------------------------------------------------------

const { postComments, commentLikes } = require('./models');

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


// CRUSH_FRIEND //
const { crushes, ignores } = require('./models');

app.post('add/crushes', async (req, res) => {
    try {
        const { userProfile1Uuid, userProfile2Uuid } = req.body;

        const userProfile1 = await userProfiles.findOne({
            where: { uuid: userProfile1Uuid },
        });
        const userProfile2 = await userProfiles.findOne({
            where: { uuid: userProfile2Uuid },
        });

        if (!userProfile1 || !userProfile2) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const newCrush = await crushes.create({
            userProfile1Id: userProfile1.id,
            userProfile2Id: userProfile2.id,
        });

        return res.status(201).send(newCrush);
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: 'Internal Server Error' });
    }
});

// IGNORE_FRIEDND //
app.post('add/ignores', async (req, res) => {
    try {

        const { userProfile1Uuid, userProfile2Uuid } = req.body;

        const userProfile1 = await userProfiles.findOne({
            where: { uuid: userProfile1Uuid },
        });
        const userProfile2 = await userProfiles.findOne({
            where: { uuid: userProfile2Uuid },
        });

        if (!userProfile1 || !userProfile2) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const newIgnore = await ignores.create({
            userProfile1Id: userProfile1.id,
            userProfile2Id: userProfile2.id,
        });

        return res.status(201).send(newIgnore);
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: 'Internal Server Error' });
    }
});


// -----------------------------------------------------------------------------------------------

// SEARCH_PROFILE
app.get('/search/:searchTerm', async (req, res) => {
    const { users, userProfiles, profilePhotes } = require('./models');
    try {
        const { searchTerm } = req.params;

        const usersList = await users.findAll({
            where: {
                [Op.and]: [
                    {
                        [Op.or]: [
                            { username: { [Op.like]: `%${searchTerm}%` } },
                            { '$userProfile.firstName$': { [Op.like]: `%${searchTerm}%` } },
                            { '$userProfile.lastName$': { [Op.like]: `%${searchTerm}%` } }
                        ]
                    },
                    { isActive: 1 }
                ]
            },
            include: [{
                model: userProfiles,
                as: 'userProfile',
                attributes: ['uuid', 'firstName', 'lastName'],
                include: [{
                    model: profilePhotes,
                    attributes: ['photoURL']
                }]
            }],
            attributes: ['uuid', 'username'],
            order: literal(
                "CASE " +
                "WHEN username LIKE :searchTerm THEN 1 " +
                "WHEN '$userProfile.firstName$' LIKE :searchTerm THEN 2 " +
                "WHEN '$userProfile.lastName$' LIKE :searchTerm THEN 3 " +
                "ELSE 4 " +
                "END"
            ),
            replacements: { searchTerm: `%${searchTerm}%` }
        });

        if (usersList.length > 0) {
            res.send({ success: true, users: usersList });
        } else {
            res.send({ success: false, message: 'No matching users found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});






server.listen(8080, () => console.log('connected...'));