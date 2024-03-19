const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const uuid = require('uuid');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { users, stories, userProfiles, friendships, profilePhotes } = require('../models');

// CREATE STORIES // =============================================================================================================================================================

// 1
router.post('/stories/:uuid', async (req, res) => {
    try {

        const { data, postText, textColor } = req.body;

        if (typeof data !== 'string' || data.trim() === '') {
            return res.status(400).json({ success: false, error: 'Invalid or missing data or postText' });
        }

        const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        const fileExtension = matches ? matches[1] : 'png';
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        const filePath = path.join(__dirname, '..', 'stories', newFileName);
        fs.writeFileSync(filePath, image);
        const fileLink = newFileName;
        console.log(fileLink);

        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const newPost = await stories.create({
            userProfileId: userProfile.id,
            text: postText || null,
            image: fileLink,
            textColor: textColor
        });

        return res.status(201).send({ success: true, post: newPost });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// GET STORIES // =============================================================================================================================================================

// 2
router.get('/get/stories/:uuid', async (req, res) => {
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const userStories = await stories.findAll({
            where: { userProfileId: userProfile.id },
            attributes: ['id', 'text', 'textColor', 'image', 'createdAt', 'uuid'],
            order: [['createdAt', 'DESC']],
        });

        return res.status(200).json({ success: true, stories: userStories });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// DELETE STORY // =============================================================================================================================================================

// 3
router.delete('/delete/story/:uuid', async (req, res) => {
    try {
        const storyToDelete = await stories.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!storyToDelete) {
            return res.status(404).json({ success: false, error: 'Story not found' });
        }

        const filePath = path.join(__dirname, '..', 'stories', storyToDelete.image);
        fs.unlinkSync(filePath);

        await storyToDelete.destroy();

        return res.status(200).json({ success: true, message: 'Story deleted successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// AUTO DELETE // =============================================================================================================================================================

// 4
router.post('/schedule/delete/stories', async (req, res) => {
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const storiesToDelete = await stories.findAll({
            where: {
                createdAt: {
                    [Op.lt]: twelveHoursAgo
                }
            }
        });

        for (const story of storiesToDelete) {
            const filePath = path.join(__dirname, '..', 'stories', story.image);
            fs.unlinkSync(filePath);
            await story.destroy();
        }

        res.status(200).json({ success: true, message: 'Automatic deletion of stories completed successfully.' });
    } catch (error) {
        console.error('Error occurred during automatic deletion of stories:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

cron.schedule('0 */12 * * *', async () => {
    try {
        await fetch('http://localhost:8080/schedule/delete/stories', { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Error occurred while triggering automatic deletion of stories:', error);
    }
});

// FIND_FRIEND_STRORY // =============================================================================================================================================================

// 5
router.get('/api/friendships/users/story/:profileUuid', async (req, res) => {
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
                    attributes: ['id', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
                {
                    model: userProfiles,
                    as: 'userProfile2',
                    attributes: ['id', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
            ],
        });

        const friendProfiles = await Promise.all(foundFriendships.map(async (friendship) => {
            const friendUserProfile = friendship.userProfile1.id !== userProfile.id
                ? friendship.userProfile1
                : friendship.userProfile2;

            if (friendUserProfile.id === userProfile.id) {
                return null;
            }

            const storyExists = await stories.findOne({
                where: { userProfileId: friendUserProfile.id }
            });

            if (storyExists) {
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
            } else {
                return null;
            }
        }));

        const filteredFriendProfiles = friendProfiles.filter(profile => profile !== null);

        res.send({ friends: filteredFriendProfiles });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET_FRIEND_STORY // =============================================================================================================================================================

// 6
router.get('/get/friend/stories/:uuid', async (req, res) => {
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const userStories = await stories.findAll({
            where: {
                userProfileId: userProfile.id
            },
            attributes: ['id', 'text', 'textColor', 'image', 'createdAt', 'uuid'],
            order: [['createdAt', 'DESC']],
        });

        return res.status(200).json({ success: true, stories: userStories });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;