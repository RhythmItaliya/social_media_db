const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const uuid = require('uuid');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { admins, users, userProfiles, userPosts, stories, ratings, profilePhotes, postLikes, postComments, commentLikes, friendRequests, friendships, messages, ignores, crushes, reports, defaultAvatars } = require('../models');




// 1 // NEW_COMMET // =============================================================================================================================================================
router.post('/api/post/comment', async (req, res) => {
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


// 2 // DELETE_COMMET //  =============================================================================================================================================================
router.delete('/api/delete/comment/:commentId', async (req, res) => {
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


// 3 // LIKE_COUNT AND LIKE_UNLIKE // =============================================================================================================================================================
router.post('/api/post/comment/like', async (req, res) => {
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


// 4 // FIND_LIKE_USER_PROFILE // =============================================================================================================================================================
router.get('/find/api/user/liked/comments/:userProfileUUID', async (req, res) => {
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


// 5 // POST_COMMENT_GET // =============================================================================================================================================================
router.get('/find/api/post/comments/:postId', async (req, res) => {
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


// 6 // POST_COMMET_COUNT // =============================================================================================================================================================
router.get('/api/post/comments/count/:postID', async (req, res) => {
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

// 7 // POST_LIKE // =============================================================================================================================================================
router.post('/post/like', async (req, res) => {
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

// 8 // GET_LIKED_POSTS_BY_USER // =============================================================================================================================================================
router.get('/post/:userProfileId/liked', async (req, res) => {
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












module.exports = router;
