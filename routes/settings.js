const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// UPDATE USER PROFILE // =============================================================================================================================================================

// 1
router.get('/userProfile/get/:uuid', async (req, res) => {
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: req.params.uuid },
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

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        // Construct the complete URL for the image
        const baseImageUrl = 'http://static.profile.local/';
        const completeImageUrl = userProfile.profilePhote ? baseImageUrl + userProfile.profilePhote.photoURL : null;

        const response = {
            username: userProfile.user ? userProfile.user.username : null,
            photoURL: completeImageUrl,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            gender: userProfile.gender,
            birthdate: userProfile.birthdate,
            location: userProfile.location,
            bio: userProfile.bio,
        };

        res.status(200).send(response);
    } catch (error) {
        console.log(error);
        return res.status(500).send('Internal Server Error');
    }
});


// 2
router.put('/userProfile/update/:uuid', async (req, res) => {
    try {
      // Find the user profile based on the provided UUID
      const userProfile = await userProfiles.findOne({
        where: { uuid: req.params.uuid },
        include: [
          {
            model: users,
            attributes: ['username'],
          },
        ],
      });
  
      // If the user profile does not exist, return a 404 error
      if (!userProfile) {
        return res.status(404).send({ error: 'User profile not found' });
      }
  
      // Update the user profile attributes with the provided data from the request body
      userProfile.firstName = req.body.firstName || userProfile.firstName;
      userProfile.lastName = req.body.lastName || userProfile.lastName;
      userProfile.gender = req.body.gender || userProfile.gender;
      userProfile.birthdate = req.body.birthdate || userProfile.birthdate;
      userProfile.location = req.body.location || userProfile.location;
      userProfile.bio = req.body.bio || userProfile.bio;
      
      // Update the username if provided in the request body
      if (req.body.username) {
        userProfile.user.username = req.body.username;
      }
  
      // Save the updated user profile
      await userProfile.save();
  
      // Prepare the response object with updated user profile data
      const response = {
        username: userProfile.user ? userProfile.user.username : null,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        gender: userProfile.gender,
        birthdate: userProfile.birthdate,
        location: userProfile.location,
        bio: userProfile.bio,
      };
  
      // Send the response with the updated user profile data
      res.status(200).send(response);
    } catch (error) {
      console.log(error);
      return res.status(500).send('Internal Server Error');
    }
  });



// POST or UPDATE PROFILE PHOTOES // =============================================================================================================================================================

// 1
router.post('/upload/profile/photo/:uuid', async (req, res) => {
    try {
        const profile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!profile) {
            return res.status(404).send('User profile not found');
        }

        const imageData = req.body.data;
        if (!imageData || typeof imageData !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid or missing image data.' });
        }

        const matches = imageData.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        if (!matches) {
            return res.status(400).json({ success: false, error: 'Invalid image data format.' });
        }

        const fileExtension = matches[1];
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const imageBase64 = imageData.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, '');
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const filePath = path.join(__dirname, '..', 'Profilephotoes', newFileName);

        if (profile.photoURL) {
            const previousFilePath = path.join(__dirname, '..', 'Profilephotoes', profile.photoURL);
            fs.unlinkSync(previousFilePath);
        }

        fs.writeFileSync(filePath, imageBuffer);
        const fileLink = newFileName;

        let existingPhoto = await profilePhotes.findOne({
            where: { userProfileId: profile.id }
        });

        if (existingPhoto) {
            existingPhoto.photoURL = fileLink;
            await existingPhoto.save();
        } else {
            await profilePhotes.create({
                userProfileId: profile.id,
                photoURL: fileLink,
            });
        }

        res.send('ok');
    } catch (e) {
        console.log(e);
        return res.status(500).send('Internal server error.');
    }
});


// DELETE PROFILE PHOTOES =============================================================================================================================================================

// 2
router.delete('/profilephotoes/delete/:uuid', async (req, res) => {
    try {

        // Find the user profile associated with the UUID
        const profile = await userProfiles.findOne({
            where: { uuid: req.params.uuid }
        });

        if (!profile) {
            return res.status(404).send('User profile not found.');
        }

        // Find the profile photo associated with the user profile
        const profilePhoto = await profilePhotes.findOne({
            where: { userProfileId: profile.id }
        });

        if (!profilePhoto) {
            return res.status(404).send('Profile photo not found.');
        }

        try {
            const filePath = path.join(__dirname, '..', 'Profilephotoes', profilePhoto.photoURL);
            fs.unlinkSync(filePath);
        } catch (error) {
            console.error('Error deleting file:', error.message);
        }

        // Delete the profile photo entry from the database
        await profilePhoto.destroy();

        res.send('ok');
    } catch (e) {
        console.error(e);
        return res.status(500).send('Error deleting file.');
    }
});



module.exports = router;