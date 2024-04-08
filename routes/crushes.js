const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// CRUSH POST // =============================================================================================================================================================

// 1 
router.post('/public/crushesRequest/', async (req, res) => {
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

        // if (senderUserProfileUuid === receiverUUID) {
        //     return res.status(422).send({ error: 'Unprocessable Entity: Cannot send your own profile to a crush' });
        // }

        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUserProfileUuid } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        const existingRequest = await crushes.findOne({
            where: {
                userProfile1Id: senderProfile.id,
                userProfile2Id: receiverProfile.id,
            },
        });

        if (existingRequest) {
            const newStatus = existingRequest.status === '1' ? '2' : '1';

            const updatedCrushRequest = await crushes.update(
                { status: newStatus },
                {
                    where: {
                        userProfile1Id: senderProfile.id,
                        userProfile2Id: receiverProfile.id,
                    },
                }
            );

            if (updatedCrushRequest > 0) {
                return res.send({ success: true, message: 'Crush request updated successfully' });
            } else {
                return res.status(404).send({ success: false, error: 'Crush request not found' });
            }
        } else {
            // If the request doesn't exist, create a new one
            const newCrushRequest = await crushes.create({
                userProfile1Id: senderProfile.id,
                userProfile2Id: receiverProfile.id,
                status: '2',
            });

            return res.send({ success: true, message: 'Crush request sent successfully', newCrushRequest });
        }

    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});


// CRUSH PUBLIC // =============================================================================================================================================================

// 2
router.get('/get/public/crushesRequest/:uuid', async (req, res) => {
    try {
        const userProfileUuid = req.params.uuid;

        const crush = await crushes.findOne({
            where: {
                [Op.or]: [
                    { '$userProfile1.uuid$': { [Op.eq]: userProfileUuid } },
                    { '$userProfile2.uuid$': { [Op.eq]: userProfileUuid } },
                ],
            },
            include: [
                { model: userProfiles, as: 'userProfile1' },
                { model: userProfiles, as: 'userProfile2' },
            ],
        });

        if (!crush) {
            return res.status(202).json({ success: false });
        }

        const status = crush.status;
        res.json({ success: true, status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// CRUSH COUNT =============================================================================================================================================================

// 3
router.get('/get/countCrushes/count/:profileUuid', async (req, res) => {
    try {
        const { profileUuid } = req.params;

        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const crushCount = await crushes.count({
            where: {
                [sequelize.Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        res.json({ crushCount });
    } catch (error) {
        console.error('Error counting crushes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// CRUSH DATA GET // =============================================================================================================================================================

// 4
router.get('/get/userProfileCrushes/:profileUUID', async (req, res) => {
    const profileUUID = req.params.profileUUID;

    if (!profileUUID) {
        return res.status(400).send({ error: 'Profile UUID is required' });
    }

    try {
        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUUID }
        });

        if (!userProfile) {
            return res.status(404).send({ error: 'User profile not found' });
        }

        const crushRequests = await crushes.findAll({
            where: {
                [Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id }
                ],
                status: '2'
            },
            include: [
                {
                    model: userProfiles,
                    as: 'userProfile2',
                    attributes: ['firstName', 'lastName', 'uuid'],
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
                }
            ]
        });

        const crushesInfo = crushRequests.map(crush => ({
            userProfile2: crush.userProfile2
        }));

        return res.send({ success: true, crushesInfo });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});



// router.get('/get/userProfileCrushes/:profileUUID', async (req, res) => {
//     const profileUUID = req.params.profileUUID;

//     if (!profileUUID) {
//         return res.status(400).send({ error: 'Profile UUID is required' });
//     }

//     try {
//         const userProfile = await userProfiles.findOne({
//             where: { uuid: profileUUID }
//         });

//         if (!userProfile) {
//             return res.status(404).send({ error: 'User profile not found' });
//         }

//         const crushRequests = await crushes.findAll({
//             where: {
//                 userProfile1Id: userProfile.id,
//                 status: '2'
//             },
//             include: [
//                 {
//                     model: userProfiles,
//                     as: 'userProfile2',
//                     attributes: ['firstName', 'lastName', 'uuid'],
//                     include: [
//                         {
//                             model: users,
//                             attributes: ['username']
//                         },
//                         {
//                             model: profilePhotes,
//                             attributes: ['photoURL']
//                         }
//                     ]
//                 }
//             ]
//         });

//         const crushesInfo = crushRequests.map(crush => ({
//             userProfile2: crush.userProfile2
//         }));

//         return res.send({ success: true, crushesInfo });
//     } catch (error) {
//         res.status(400).send({ error: error.message });
//     }
// });


module.exports = router;