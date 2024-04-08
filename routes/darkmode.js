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
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// DARK MODE // =============================================================================================================================================================
router.get('/api/user/profiles/:uuid/mode', async (req, res) => {
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

        res.status(200).json({ darkMode: userProfile.darkMode });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/api/user/profiles/:uuid/mode', async (req, res) => {

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

        let darkModeValue;
        if (req.body.darkMode) {
            darkModeValue = 1;
        } else {
            darkModeValue = 0;
        }

        const [rowsUpdated] = await userProfiles.update(
            { darkMode: darkModeValue },
            {
                where: {
                    userId: user.id,
                    darkMode: { [Op.not]: darkModeValue },
                }
            }
        );

        if (rowsUpdated === 0) {
            return res.status(200).json({
                message: `Dark mode ${darkModeValue === 1 ? 'enabled' : 'disabled'} successfully`,
                darkMode: darkModeValue
            });
        }

        return res.status(200).json({
            message: `Dark mode ${darkModeValue === 1 ? 'enabled' : 'disabled'} successfully`,
            darkMode: darkModeValue
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});













module.exports = router;
