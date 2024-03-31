const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { userProfiles, userPosts, reports, profilePhotes } = require('../models');

// POST /api/reports
router.post('/post/report', async (req, res) => {
    try {
        const { userProfileUuid, postId, reportText } = req.body;

        // Retrieve user profile by UUID
        const userProfile = await userProfiles.findOne({ where: { uuid: userProfileUuid } });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Retrieve post by ID
        const post = await userPosts.findByPk(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Create report
        await reports.create({
            userID: userProfile.id,
            postID: post.id,
            reports: reportText
        });

        return res.status(201).json({ message: 'Report created successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});




module.exports = router;
