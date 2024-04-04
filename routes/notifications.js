const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { userProfiles, postNotification, friendships, userPosts, users, profilePhotes } = require('../models');


// // POST NOTIFICATION //
router.get('/all/post/notifications/:uuid', async (req, res) => {
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const userFriendships = await friendships.findAll({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        const friendUserProfileIds = userFriendships.map(friendship => {
            return friendship.userProfile1Id === userProfile.id
                ? friendship.userProfile2Id
                : friendship.userProfile1Id;
        });

        const friendsPosts = await userPosts.findAll({
            where: { userProfileId: friendUserProfileIds },
            attributes: ['id'],
        });

        const postIds = friendsPosts.map(post => post.id);

        const latestFriendshipCreatedAt = Math.max(...userFriendships.map(friendship => friendship.createdAt));

        const notifications = await postNotification.findAll({
            where: {
                postId: postIds,
                createdAt: { [Op.gt]: latestFriendshipCreatedAt },
            },
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


router.get('/post/notifications/:uuid', async (req, res) => {
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
        });

        if (!userProfile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }

        const userFriendships = await friendships.findAll({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        const friendUserProfileIds = userFriendships.map(friendship => {
            return friendship.userProfile1Id === userProfile.id
                ? friendship.userProfile2Id
                : friendship.userProfile1Id;
        });

        const friendsPosts = await userPosts.findAll({
            where: { userProfileId: friendUserProfileIds },
            attributes: ['id'],
        });

        const postIds = friendsPosts.map(post => post.id);

        const latestFriendshipCreatedAt = Math.max(...userFriendships.map(friendship => friendship.createdAt));

        const notifications = await postNotification.findAll({
            where: {
                postId: postIds,
                createdAt: { [Op.gt]: latestFriendshipCreatedAt },
                isRead: 0
            },
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


router.post('/post/notifications/mark/as/read', async (req, res) => {
    try {
        const { notificationIds } = req.body;

        await postNotification.update({ isRead: true }, {
            where: {
                id: notificationIds
            }
        });

        res.status(200).json({ success: true, message: 'Notifications marked as read successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.get('/post/notifications/user/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;

        const userProfile = await userProfiles.findOne({
            where: { uuid },
            include: [
                {
                    model: users,
                    attributes: ['username']
                },
                {
                    model: profilePhotes,
                    attributes: ['photoURL']
                }
            ]
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const { username } = userProfile.user;
        let photoURL = null;
        if (userProfile.profilePhote && userProfile.profilePhote.photoURL) {
            photoURL = userProfile.profilePhote.photoURL;
        }

        res.json({ username, photoURL });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});







module.exports = router;
