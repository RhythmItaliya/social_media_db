// share.js
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



// Define API endpoint
router.get('/share/profiles/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;

    const profile = await userProfiles.findOne({
      where: {
        uuid: uuid
      }
    });

    if (profile) {
      res.status(200).json({ sharLink: profile.sharLink });
    } else {
      res.status(404).json({ message: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;