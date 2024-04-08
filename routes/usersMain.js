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


// USERS FIND =============================================================================================================================================================
router.get('/users/:uuid', async (req, res) => {
   
    try {
        const uuid = req.params.uuid;

        const userData = await users.findOne({
            where: { uuid },
            include: [{ model: userProfiles, attributes: ['id', 'userId', 'firstName', 'lastName', 'gender', 'birthdate', 'location', 'bio', 'uuid'] }]
        });

        if (!userData) {
            return res.status(404).send({ error: 'User not found' });
        }

        const { id, username, userProfile } = userData;

        res.send({
            id,
            username,
            userProfile
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send('Server mein error hai...');
    }
});


module.exports = router;
