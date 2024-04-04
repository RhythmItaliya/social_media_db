const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const uuid = require('uuid');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { admins, users, userProfiles, userPosts, stories, ratings, profilePhotes, postLikes, postComments, commentLikes, friendRequests, friendships, messages, ignores, crushes, reports, defaultAvatars, postNotification } = require('../models');



// CREATE POST // =============================================================================================================================================================

// 1 // USER POST CREATE =============================================================================================================================================================
router.post('/api/create/posts/:uuid', async (req, res) => {
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
        const filePath = path.join(__dirname, '..', 'uploads', newFileName);
        await fs.writeFileSync(filePath, image);
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

        // Notification Creation Logic
        const notificationMessageId = `${userProfile.uuid}`;
        await postNotification.create({
            postId: newPost.id,
            notificationMessage: notificationMessageId,
            isRead: false,
        });

        return res.status(201).send({ success: true, post: newPost });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});


// 2 // GET MAIN FRIEND POST  =============================================================================================================================================================
router.get('/find/api/posts/friend/:userProfileUuid', async (req, res) => {
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
            where: { userProfileId: friendUserProfileIds, isVisibility: 1, isTakeDown: 0 },
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


// 3 // GET MAIN USER POST  =============================================================================================================================================================
router.get('/find/api/posts/user/:userProfileUuid', async (req, res) => {
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
            where: { userProfileId: userProfile.id, isTakeDown: 0 },
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


// 4 // GET POST BY ID =============================================================================================================================================================
router.get('/api/posts/get/:postId', async (req, res) => {
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


// 5 // UPDATE POST BY ID // =============================================================================================================================================================
router.put('/api/posts/update/:postId', async (req, res) => {
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

// 6 // UPDATE POST VISIBILITY // =============================================================================================================================================================
router.put('/api/posts/visibility/:postId', async (req, res) => {
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


// 7 // DELETE POST // =============================================================================================================================================================
router.delete('/api/posts/delete/:postId', async (req, res) => {
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
        const filePath = path.join(__dirname, '..', 'uploads', fileLink);
        fs.unlinkSync(filePath);

        await postToDelete.destroy();

        return res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


// 8 // POST_COUNT  // =============================================================================================================================================================
router.get('/api/userPostsCount/:profileUuid', async (req, res) => {
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


// 9 // POST_GET_FOR_PROFILE // =============================================================================================================================================================
router.get('/api/user/posts/profile/:uuid', async (req, res) => {
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
                userProfileId: userProfile.id,
                isTakeDown: 0,
            },
            attributes: ['postUploadURLs']
        });

        res.json(posts);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 10 // POST_GET_FOR_PROFILE_PUBLIC // =============================================================================================================================================================
router.get('/api/user/posts/profile/public/:uuid', async (req, res) => {
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
                userProfileId: userProfile.id,
                isVisibility: 1,
                isTakeDown: 0,
            },
            attributes: ['postUploadURLs']
        });

        res.json(posts);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 11 // POST_LIKE_COUNT // =============================================================================================================================================================
router.get('/api/post/likes/count/:postId', async (req, res) => {
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


















































// GET POST BY PROFILE_UUID // FRIEND POST //
// router.get('/find/api/posts/:userProfileUuid', async (req, res) => {
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
// router.get('/find/api/posts/friend/:userProfileUuid', async (req, res) => {
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
// router.get('/find/api/posts/user/:userProfileUuid', async (req, res) => {
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



module.exports = router;
