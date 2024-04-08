// friends.js
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
const http = require('http');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');




// PUBLIC PROFILE SEND REQUEST //
// 1
router.post('/public/friendRequests', async (req, res) => {
    const senderUUID = req.body.senderId;
    const receiverUUID = req.body.receiverId;

    if (!senderUUID || !receiverUUID) {
        return res.status(400).send({ error: 'SenderUUID and ReceiverUUID are required' });
    }

    try {
        const senderUserInstance = await users.findOne({
            where: { uuid: senderUUID },
            include: userProfiles,
        });

        if (!senderUserInstance) {
            return res.status(400).send({ error: 'Sender profile not found' });
        }

        const senderUserProfileUuid = senderUserInstance.userProfile.uuid;

        if (senderUserProfileUuid === receiverUUID) {
            return res.status(422).send({ error: 'Unprocessable Entity: Cannot send your own profile to a crush' });
        }

        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUserProfileUuid } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });


        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        // Check if there is an existing friend request
        const existingRequest = await friendRequests.findOne({
            where: {
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
            },
        });

        if (existingRequest) {
            // If the request already exists, update it
            const newStatus = existingRequest.status === '1' ? '3' : '1';

            const updatedFriendRequest = await friendRequests.update(
                { status: newStatus },
                {
                    where: {
                        senderId: senderProfile.id,
                        receiverId: receiverProfile.id,
                    },
                }
            );

            if (updatedFriendRequest > 0) {
                return res.send({ success: true, message: 'Friend request updated successfully' });
            } else {
                return res.status(404).send({ success: false, error: 'Friend request not found' });
            }
        } else {
            // If the request doesn't exist, create a new one
            const friendRequest = await friendRequests.create({
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
                status: '1',
            });

            return res.send(friendRequest);
        }
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// PUBLIC REQUESTS GET //
// 2
router.get('/get/public/friendRequests/:uuid', async (req, res) => {
    try {
        const userProfileUuid = req.params.uuid;

        const friendRequest = await friendRequests.findOne({
            where: {
                [Op.or]: [
                    { '$sender.uuid$': { [Op.eq]: userProfileUuid } },
                    { '$receiver.uuid$': { [Op.eq]: userProfileUuid } },
                ],
            },
            include: [
                { model: userProfiles, as: 'sender', attributes: ['id', 'uuid'] },
                { model: userProfiles, as: 'receiver', attributes: ['id', 'uuid'] },
            ],
        });

        if (!friendRequest) {
            return res.status(202).json({ success: false });
        }

        const status = friendRequest.status;
        res.json({ success: true, status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// FRIEND REQUESTS GET //
// 3  
router.get('/friendRequests/:receiverUUID', async (req, res) => {
    const receiverUUID = req.params.receiverUUID;

    if (!receiverUUID) {
        return res.status(400).send({ error: 'ReceiverUUID is required' });
    }

    try {
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!receiverProfile) {
            return res.status(400).send({ error: 'Receiver profile not found' });
        }

        const friendRequestsList = await friendRequests.findAll({
            where: {
                receiverId: receiverProfile.id,
                status: '1',
            },
            include: [
                { model: userProfiles, as: 'sender' },
                { model: userProfiles, as: 'receiver' },
            ],
        });

        if (!friendRequestsList || friendRequestsList.length === 0) {
            return res.status(404).json({ error: 'Friend requests not found' });
        }

        const senderUUIDs = friendRequestsList.map(request => request.sender.uuid);

        const senderProfilesPromises = senderUUIDs.map(async (senderUUID) => {
            return new Promise((resolve, reject) => {
                const api2Url = `http://localhost:8080/api/user/profile/receiver/${senderUUID}`;

                http.get(api2Url, (api2Response) => {
                    let data = '';

                    api2Response.on('data', (chunk) => {
                        data += chunk;
                    });

                    api2Response.on('end', async () => {
                        try {
                            const parsedData = JSON.parse(data);

                            const userProfile = await userProfiles.findOne({
                                include: [{ model: users, attributes: ['username'] }],
                            });

                            if (userProfile) {
                                const { username } = userProfile.user;
                                resolve({ parsedData, username });
                            } else {
                                reject({ status: 404, message: 'User not found' });
                            }
                        } catch (error) {
                            console.error(`Error fetching sender profile for UUID ${senderUUID}: ${error.message}`);
                            reject(error);
                        }
                    });
                }).on('error', (error) => {
                    console.error(`Error fetching sender profile for UUID ${senderUUID}: ${error.message}`);
                    reject(error);
                });
            });
        });

        const senderProfiles = await Promise.all(senderProfilesPromises);

        const combinedResponses = friendRequestsList.map((request, index) => {
            const senderProfile = senderProfiles[index] || {};
            const { parsedData, username } = senderProfile;

            return {
                friendRequest: {
                    uuid: request.uuid,
                    sender: {
                        uuid: request.sender.uuid,
                    },
                    receiver: {
                        uuid: request.receiver.uuid,
                    },
                },
                senderProfile: {
                    firstName: parsedData.firstName,
                    lastName: parsedData.lastName,
                    completeImageUrl: parsedData.completeImageUrl,
                    // username: username,
                },
            };
        });

        // Send the complete response to the client
        return res.send(combinedResponses);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// FRIEND REQUEST SEND //
// 4
router.post('/friendRequests', async (req, res) => {
    const senderUUID = req.body.senderId;
    const receiverUUID = req.body.receiverId;

    if (!senderUUID || !receiverUUID) {
        return res.status(400).send({ error: 'SenderUUID and ReceiverUUID are required' });
    }

    if (senderUUID === receiverUUID) {
        return res.status(400).send({ error: 'Cannot send friend request to yourself' });
    }

    try {
        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUUID } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        // Check if the receiver has sent a friend request to the sender
        const reverseRequest = await friendRequests.findOne({
            where: {
                senderId: receiverProfile.id,
                receiverId: senderProfile.id,
            },
        });

        if (reverseRequest && reverseRequest.status === '1') {
            return res.status(400).send({ error: 'Friend request already received from the user. Cannot send a request until it is accepted or rejected.' });
        }

        // Check if there is an existing friend request from sender to receiver
        const existingRequest = await friendRequests.findOne({
            where: {
                senderId: senderProfile.id,
                receiverId: receiverProfile.id,
            },
        });

        if (existingRequest) {
            if (existingRequest.status === '1') {
                return res.status(400).send({ error: 'Friend request already sent' });
            } else if (existingRequest.status === '2') {
                return res.status(400).send({ error: 'Friend request already accepted. Cannot send another request.' });
            }
        }

        // Check if there is an existing friend request from receiver to sender with status '2'
        const reverseExistingRequest = await friendRequests.findOne({
            where: {
                senderId: receiverProfile.id,
                receiverId: senderProfile.id,
                status: '2',
            },
        });

        if (reverseExistingRequest) {
            return res.status(400).send({ error: 'Friend request has already been accepted. Cannot send another request.' });
        }

        const friendRequest = await friendRequests.create({
            senderId: senderProfile.id,
            receiverId: receiverProfile.id,
            status: '1',
        });

        res.send(friendRequest);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// SUGGESTED_FRIEND
// 5
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

router.get('/api/userProfiles/:uuid', async (req, res) => {

    const { uuid } = req.params;
    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid },
            include: [
                { model: users, attributes: ['username'] },
            ],
            attributes: ['id', 'uuid', 'firstName', 'lastName', 'createdAt']
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const otherUserProfiles = await userProfiles.findAll({
            where: {
                uuid: {
                    [Op.ne]: userProfile.uuid
                }
            },
            include: [
                {
                    model: users,
                    attributes: ['username']
                },
            ],
            attributes: ['id', 'uuid', 'firstName', 'lastName', 'createdAt']
        });

        const filteredProfiles = await Promise.all(otherUserProfiles.map(async (profile) => {
            const profilePhoto = await profilePhotes.findOne({
                where: { userProfileId: profile.id },
                attributes: ['photoURL']
            });

            const isSender = await friendRequests.findOne({
                where: {
                    senderId: userProfile.id,
                    receiverId: profile.id,
                    status: { [Op.in]: ['1', '2'] }
                }
            });

            const isReceiver = await friendRequests.findOne({
                where: {
                    senderId: profile.id,
                    receiverId: userProfile.id,
                    status: { [Op.in]: ['1', '2'] }
                }
            });

            if (!isSender && !isReceiver) {
                return {
                    id: profile.id,
                    uuid: profile.uuid,
                    username: profile.user ? profile.user.username : null,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    createdAt: profile.createdAt,
                    photoURL: profilePhoto ? profilePhoto.photoURL : null,
                };
            }
            return null;
        }));

        const validProfiles = filteredProfiles.filter(profile => profile !== null);
        const shuffledProfiles = shuffleArray(validProfiles);
        const response = shuffledProfiles.slice(0, Math.min(10, shuffledProfiles.length));

        res.send({ userProfiles: response });
    } catch (e) {
        console.log(e);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// FIND FRIENDSHPIS // =============================================================================================================================================================
router.get('/api/friendships/users/:profileUuid', async (req, res) => {
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
                    attributes: ['id', 'userId', 'firstName', 'lastName', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
                {
                    model: userProfiles,
                    as: 'userProfile2',
                    attributes: ['id', 'userId', 'firstName', 'lastName', 'uuid'],
                    include: [{ model: users, attributes: ['username'] }],
                },
            ],
        });

        const friendProfiles = await Promise.all(foundFriendships.map(async (friendship) => {
            // Assuming userProfile1 and userProfile2 also have a user association
            const friendUserProfile = friendship.userProfile1.id !== userProfile.id
                ? friendship.userProfile1
                : friendship.userProfile2;

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
        }));

        res.send({ friends: friendProfiles });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});



module.exports = router;
