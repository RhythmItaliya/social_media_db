const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// 2 // GET MAIN FRIEND POST  =============================================================================================================================================================



router.get('/hashtags/:userProfileUuid', async (req, res) => {
    try {
        const userProfileUuid = req.params.userProfileUuid;
        const hashtag = req.query.hashtag; // Extract hashtag from query parameter

        // Find the user profile
        const userProfile = await userProfiles.findOne({
            where: { uuid: userProfileUuid },
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

        // Check if the user's profile UUID is included in friendUserProfileIds
        if (!friendUserProfileIds.includes(userProfile.id)) {
            // If not, include it in friendUserProfileIds
            friendUserProfileIds.push(userProfile.id);
        }

        // Find user profiles of friends
        const friendsUserProfiles = await userProfiles.findAll({
            where: { id: friendUserProfileIds },
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

        // Fetch posts of the user's friends containing the specified hashtag
        const friendsPosts = await userPosts.findAll({
            where: {
                userProfileId: friendUserProfileIds,
                isVisibility: 1,
                isTakeDown: 0,
                hashtags: { [Op.like]: `%${hashtag}%` } // Filter by hashtag
            },
            order: [['createdAt', 'DESC']],
        });

        // Fetch posts from other users containing the specified hashtag
        const otherPosts = await userPosts.findAll({
            where: {
                userProfileId: { [Op.notIn]: friendUserProfileIds }, // Exclude friend user profile IDs
                isVisibility: 1,
                isTakeDown: 0,
                hashtags: { [Op.like]: `%${hashtag}%` } // Filter by hashtag
            },
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

        // Combine user's and friends' posts containing the hashtag
        const allPosts = [...friendsPosts, ...otherPosts];

        // Extract friend post IDs
        const friendPostIds = friendsPosts.map(post => post.id);

        // Include user profile, user information, friends' user profiles, and posts in the response
        const responseObj = {
            success: true,
            userProfile: userProfileWithoutRepos,
            friends: friendsUserProfiles.map(friend => ({
                id: friend.id,
                username: friend.user.username,
                photoURL: friendsProfilePhotosMap[friend.id] || null,
            })),
            friendsPosts: allPosts,
            likedPosts: likedPosts, // New addition
            friendPostIds: friendPostIds, // List of friend's post IDs containing the hashtag
            otherPostIds: otherPosts.map(post => post.id) // List of other users' post IDs
        };

        // Send response
        return res.status(200).json(responseObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});











module.exports = router;
