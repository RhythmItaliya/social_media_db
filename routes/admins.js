const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, literal } = require('sequelize');
const uuid = require('uuid');
const sendMail = require('../untils/mailer');
const fs = require('fs');
const path = require('path');
const { admins, users, userProfiles, userPosts, stories, ratings, profilePhotes, friendships, postLikes, postComments, messages, ignores, crushes, reports, defaultAvatars } = require('../models');

//  RIGISTER API =============================================================================================================================================================

// 1
router.post('/admin/register',
    [
        body('username')
            .trim()
            .isLength({ min: 3, max: 255 })
            .withMessage('Username must be between 3 to 255 characters.'),
        body('password')
            .trim()
            .isLength({ min: 8 })
            .withMessage('Password is too short; minimum 8 characters required.'),
        body('email')
            .trim()
            .isEmail()
            .withMessage('Invalid email address'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userEmail = await admins.findOne({
                where: {
                    email: req.body.email,
                }
            });

            if (userEmail) {
                return res.status(409).send({
                    isEmail: false
                });
            }

            const userUsername = await admins.findOne({
                where: {
                    username: req.body.username,
                }
            });

            if (userUsername) {
                return res.status(409).send('Username is already taken');
            }

            const token = uuid.v1();

            admins.create({
                username: req.body.username,
                password: req.body.password,
                email: req.body.email,
                token: token
            });

            const htmlBody = `<b>To verify your account: <a href="http://localhost:3000/admin/verify/login/${token}">Link</a></b>`;
            sendMail(req.body.email, 'Your Admin Verify Link', htmlBody);

            return res.status(201).send('Please check your email confirmation...');
        } catch (e) {
            console.error(e);
            return res.status(500).send('Lagata hai server me error hai...');
        }
    }
);

// 2
router.get('/admin/verify/login/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Bad Request", message: errors.array()[0].msg });
        }

        try {
            const user = await admins.findOne({
                where: {
                    token: req.params.token,
                    isActive: 0,
                }
            });

            if (!user) {
                return res.status(404).json({ isValid: 0 });
            }

            const newToken = uuid.v1();

            await admins.update(
                {
                    token: newToken,
                    isActive: 1,
                },
                {
                    where: {
                        id: user.id
                    }
                }
            );

            return res.status(200).json({ isValid: 1 });

        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: "Internal Server Error", message: "An error occurred while processing your request." });
        }
    }
);

// LOGIN API =============================================================================================================================================================

// 3
router.post('/admin/login',
    [
        body('username')
            .trim()
            .notEmpty()
            .withMessage('Username or email is required'),
        body('password')
            .trim()
            .notEmpty()
            .withMessage('Password is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Bad Request", message: errors.array()[0].msg });
        }

        try {
            const user = await admins.findOne({
                where: {
                    [Op.or]: [
                        { username: req.body.username },
                        { email: req.body.username }
                    ],
                    isActive: 1
                }
            });

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password.' });
            }

            const passwordMatch = await bcrypt.compare(req.body.password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password.' });
            }

            const token = jwt.sign({ uuid: user.uuid }, 'YOUR_SECRET_KEY', { expiresIn: '7d' });

            res.cookie('X-Access-Token', token, { maxAge: 7776000000, signed: true, path: '/', secure: true, httpOnly: true });

            return res.status(200).json({
                "X-Access-Token": token,
                "uuid": user.uuid,
                "username": user.username
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal Server Error", message: "An error occurred while processing your request." });
        }
    }
);


// LOGOUT =============================================================================================================================================================

// 4
router.post('/admin/logout', (req, res) => {
    try {
        res.clearCookie('X-Access-Token');

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
});

// RESET PASSWORD REQUEST MAIL =============================================================================================================================================================

// 5
router.post('/admin/reset/request',
    [
        body('email')
            .isEmail()
            .withMessage('Invalid email address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await admins.findOne({
                where: {
                    email: req.body.email
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'Not Found', message: 'Email not found.' });
            }

            const token = uuid.v1();

            await admins.update(
                {
                    token: token,
                },
                {
                    where: {
                        id: user.id
                    }
                });

            const resetLink = `http://localhost:3000/admin/reset/password/${token}`;
            sendMail(user.email, 'Your Admin Reset link', resetLink);

            return res.status(200).json({ message: 'Password reset link sent successfully.' });

        } catch (error) {
            console.error('Error occurred during password reset request:', error);
            return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred on the server.' });
        }
    }
);

// 6
router.get('/admin/resetlink/verify/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await admins.findOne({
                where: {
                    token: req.params.token
                }
            });

            if (!user) {
                return res.status(404).json({ isValid: false, message: "Link is expired." });
            }

            return res.status(200).send('Reset link is valid.');

        } catch (error) {
            console.error('Error during reset link verification:', error);
            return res.status(500).send('Internal Server Error.');
        }
    }
);

// PASSWORD RESET =============================================================================================================================================================

// 7
router.post('/admin/reset/password/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format'),
        body('password1')
            .isLength({ min: 8 })
            .withMessage('Password is too short; minimum 8 characters required.'),
        body('password2')
            .custom((value, { req }) => {
                if (value !== req.body.password1) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const resetToken = req.params.token;


            const user = await admins.findOne({
                where: {
                    token: resetToken
                }
            });

            if (!user) {
                return res.status(404).send('This link has expired or is invalid.');
            }

            const token = uuid.v1();
            const hashedPassword = bcrypt.hashSync(req.body.password1, 10);

            const updatedUser = await admins.update(
                {
                    password: hashedPassword,
                    token: token,
                    isActive: 1
                },
                {
                    where: {
                        token: resetToken
                    },
                }
            );

            if (!updatedUser[0]) {
                return res.status(404).send('User not found');
            }

            return res.status(201).send('Your password has been updated.');

        } catch (error) {
            console.error('Error during password reset:', error);
            return res.status(500).send('Internal Server Error.');
        }
    }
);


// ADMIN ACCESS // =============================================================================================================================================================

// 8
router.get('/admin/users/recode', async (req, res) => {
    try {
        const adminData = await admins.findOne({
            where: { uuid: 1 },
            include: [{
                model: users,
                where: { adminId: 1 }
            }]
        });

        if (!adminData) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const usersData = adminData.users.map(user => ({
            id: user.id,
            createdAt: user.createdAt
        }));

        res.json(usersData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// USER RECODE //
// 9
router.get('/admin/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await users.findOne({
            where: { username },
            include: [{
                model: userProfiles,
                attributes: ['id', 'firstName', 'lastName', 'gender', 'birthdate', 'location', 'bio', 'isPublic', 'darkMode'],
            }],
            attributes: ['username', 'email', 'isActive'],
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userProfileId = user.userProfile.id;

        const totalPosts = await userPosts.count({
            where: { userProfileId }
        });

        const postUrls = await userPosts.findAll({
            where: { userProfileId },
            attributes: ['postUploadURLs']
        });


        const totalStories = await stories.count({
            where: { userProfileId }
        });

        const totalRatingsReceived = await ratings.count({
            where: { rateUserProfile2Id: userProfileId }
        });

        const totalRatingsGiven = await ratings.count({
            where: { rateUserProfile1Id: userProfileId }
        });

        const profilePhotos = await profilePhotes.findAll({
            where: { userProfileId },
            attributes: ['photoURL']
        });

        const totalIgnores = await ignores.count({
            where: { userProfile1Id: userProfileId }
        });

        const totalCrushes = await crushes.count({
            where: { userProfile1Id: userProfileId }
        });

        const totalFriendships = await friendships.count({
            where: { userProfile1Id: userProfileId }
        });

        res.json({ user, totalPosts, postUrls, totalStories, totalRatingsReceived, totalRatingsGiven, profilePhotos, totalIgnores, totalCrushes, totalFriendships });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// ADMIN PROFILE SEARCh //
// 10
router.get('/admin/profile/search/:searchTerm', async (req, res) => {
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
                ]
            },
            include: [{
                model: userProfiles,
                as: 'userProfile',
                attributes: ['id', 'uuid', 'firstName', 'lastName'],
                include: [{
                    model: profilePhotes,
                    attributes: ['photoURL']
                }]
            }],
            attributes: ['id', 'uuid', 'username'],
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


// REPORT POST DATA //

// 11
router.get('/admin/reports', async (req, res) => {
    try {

        const allReports = await reports.findAll({
            include: [
                {
                    model: userProfiles,
                    attributes: ['firstName', 'lastName'],
                    include: [
                        {
                            model: profilePhotes,
                            attributes: ['photoURL']
                        },
                        {
                            model: users,
                            attributes: ['username']
                        }
                    ]
                },
                {
                    model: userPosts
                }
            ]
        });

        const formattedReports = allReports.map(report => ({
            reportId: report.id,
            isSolve: report.isSolve,
            reportReason: report.reports,
            reportDate: report.createdAt,
            userProfile: {
                id: report.userProfile.id,
                firstName: report.userProfile.firstName,
                lastName: report.userProfile.lastName,
                username: report.userProfile.user ? report.userProfile.user.username : null,
                profilePhotes: report.userProfile.profilePhotes ? report.userProfile.profilePhotes.photoURL : null
            },
            post: report.userPost
        }));

        res.json(formattedReports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// 12 //
router.put('/reports/:reportId/solve', async (req, res) => {
    const { reportId } = req.params;
    try {
        const report = await reports.findByPk(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        await report.update({ isSolve: 1 });
        return res.json({ message: 'Report marked as solved' });
    } catch (error) {
        console.error('Error updating report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ADMIN TAKEDOWN POST // =============================================================================================================================================================
router.post('/post/takedown/:postId', async (req, res) => {
    const postId = req.params.postId;

    try {
        const [rowsUpdated] = await userPosts.update(
            { isTakeDown: 1 },
            {
                where: {
                    id: postId,
                    isTakeDown: 0,
                }
            }
        );

        if (rowsUpdated === 0) {
            await userPosts.update(
                { isTakeDown: 0 },
                {
                    where: {
                        id: postId,
                        isTakeDown: 1
                    }
                }
            );

            const report = await reports.findOne({ where: { postID: postId } });
            if (report) {
                await report.update({ isSolve: 1 });
            }

            return res.status(200).json({ message: 'Post made public again successfully', isTakeDown: 0 });
        }

        const report = await reports.findOne({ where: { postID: postId } });
        if (report) {
            await report.update({ isSolve: 1 });
        }

        return res.status(200).json({ message: 'Post takedown status updated successfully', isTakeDown: 1 });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// USER TAKEDOWN // =============================================================================================================================================================
router.post('/user/takedown/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const [rowsUpdated] = await users.update(
            { isTerminate: 1 },
            {
                where: {
                    id: userId,
                    isTerminate: 0,
                }
            }
        );

        if (rowsUpdated === 0) {
            await users.update(
                { isTerminate: 0 },
                {
                    where: {
                        id: userId,
                        isTerminate: 1
                    }
                }
            );
            return res.status(200).json({ message: 'User Terminate again successfully', isTerminate: 0 });
        }

        return res.status(200).json({ message: 'User Terminate status updated successfully', isTerminate: 1 });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/get/users/data', async (req, res) => {
    try {
        const allUsers = await users.findAll({
            attributes: { exclude: ['password'] }
        });

        res.status(200).json(allUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// DEFAULT AVATAR //=============================================================================================================================================================
// 4 //
router.post('/defaultAvatar', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data || typeof data !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid or missing data' });
        }

        const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        const fileExtension = matches ? matches[1] : 'png';
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        const filePath = path.join(__dirname, '..', 'defaultAvatar', newFileName);
        await fs.promises.writeFile(filePath, image);

        const newAvatar = await defaultAvatars.create({ defaultAvatarURL: newFileName });

        return res.status(201).json({ success: true, avatar: newAvatar });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


router.get('/get/defaultAvatar', async (req, res) => {
    try {

        const allAvatars = await defaultAvatars.findAll();
        if (allAvatars.length === 0) {
            return res.status(404).json({ success: false, error: 'Default avatars not found' });
        }
        const randomIndex = Math.floor(Math.random() * allAvatars.length);
        const randomAvatarURL = allAvatars[randomIndex].defaultAvatarURL;

        const baseURL = 'http://static.defaultavatar.local/';
        const fullURL = baseURL + randomAvatarURL;

        return res.status(200).json({ success: true, avatarURL: fullURL });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


router.get('/get/all/defaultAvatar', async (req, res) => {
    try {
        const allAvatars = await defaultAvatars.findAll();

        if (allAvatars.length === 0) {
            return res.status(404).json({ success: false, error: 'Default avatars not found' });
        }

        const baseURL = 'http://static.defaultavatar.local/';
        const avatarURLs = allAvatars.map(avatar => {
            return {
                id: avatar.id,
                url: baseURL + avatar.defaultAvatarURL,
                uuid: avatar.uuid
            };
        });

        return res.status(200).json({ success: true, avatars: avatarURLs });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.delete('/delete/defaultAvatar/:id', async (req, res) => {
    try {
        const avatarId = req.params.id;

        const avatar = await defaultAvatars.findByPk(avatarId);

        if (!avatar) {
            return res.status(404).json({ success: false, error: 'Avatar not found' });
        }

        const imagePath = path.join(__dirname, '..', 'defaultAvatar', avatar.defaultAvatarURL);
        await fs.promises.unlink(imagePath);

        await avatar.destroy();

        return res.status(200).json({ success: true, message: 'Avatar deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});



module.exports = router;