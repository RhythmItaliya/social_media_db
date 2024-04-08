const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op, literal } = require('sequelize');
const uuid = require('uuid');
const sendMail = require('../untils/mailer');
const path = require('path');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// PROFILE CREATE // =============================================================================================================================================================
router.post('/userProfile/create/:uuid', async (req, res) => {

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

// FINE PROFILE REDICTRE // =============================================================================================================================================================

router.get('/api/users/profileCreated/:uuid', async (req, res) => {
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

router.post('/api/profilepage/create/:uuid', async (req, res) => {
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
            const filePath = path.join(__dirname, '..', 'Profilephotoes', newFileName);

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


// FRIENDSHIP, CRUSH, AND IGNORE COUNT // =============================================================================================================================================================

router.get('/api/friendships-crushes-ignores/count/:profileUuid', async (req, res) => {
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








module.exports = router;