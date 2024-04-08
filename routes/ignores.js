const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { admins, blogComments, blogs, commentLikes, contacts, crushes, defaultAvatars, friendRequests, friendships, ignores, messages, postComments, postLikeNotifications, postLikes, postNotifications, profilePhotes, ratings, reports, stories, userPosts, userProfiles, users } = require('../models');



// IGNORE POST // =============================================================================================================================================================

//1
router.post('/public/ignoreRequest/', async (req, res) => {
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
        //     return res.status(422).send({ error: 'Unprocessable Entity: Cannot send your own profile to a ingonre' });
        // }

        const senderProfile = await userProfiles.findOne({ where: { uuid: senderUserProfileUuid } });
        const receiverProfile = await userProfiles.findOne({ where: { uuid: receiverUUID } });

        if (!senderProfile || !receiverProfile) {
            return res.status(400).send({ error: 'Sender or receiver profile not found' });
        }

        const existingRequest = await ignores.findOne({
            where: {
                userProfile1Id: senderProfile.id,
                userProfile2Id: receiverProfile.id,
            },
        });

        if (existingRequest) {
            const newStatus = existingRequest.status === '1' ? '2' : '1';

            const updatedIgnoreRequest = await ignores.update(
                { status: newStatus },
                {
                    where: {
                        userProfile1Id: senderProfile.id,
                        userProfile2Id: receiverProfile.id,
                    },
                }
            );

            if (updatedIgnoreRequest > 0) {
                return res.send({ success: true, message: 'Ignore request updated successfully' });
            } else {
                return res.status(404).send({ success: false, error: 'Ignore request not found' });
            }
        } else {
            const ignoreRequest = await ignores.create({
                userProfile1Id: senderProfile.id,
                userProfile2Id: receiverProfile.id,
                status: '2',
            });

            return res.send({ success: true, message: 'Ignore request sent successfully', ignoreRequest });
        }

    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// IGNORE PUBLIC // =============================================================================================================================================================

//2
router.get('/get/public/ignoreRequest/:uuid', async (req, res) => {
    try {
        const userProfileUuid = req.params.uuid;

        const ignore = await ignores.findOne({
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

        if (!ignore) {
            return res.status(202).json({ success: false });
        }

        const status = ignore.status;
        res.json({ success: true, status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// IGNORE COUNT =============================================================================================================================================================

//3
router.get('/get/ignoreCount/:profileUuid', async (req, res) => {
    try {
        const { profileUuid } = req.params;

        const userProfile = await userProfiles.findOne({
            where: { uuid: profileUuid },
        });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const ignoreCount = await ignores.count({
            where: {
                [sequelize.Op.or]: [
                    { userProfile1Id: userProfile.id },
                    { userProfile2Id: userProfile.id },
                ],
            },
        });

        res.json({ ignoreCount });
    } catch (error) {
        console.error('Error counting ignores:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// IGNORE DATA GET // =============================================================================================================================================================

//4
router.get('/get/userProfileIgnores/:profileUUID', async (req, res) => {
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

        const ignoreList = await ignores.findAll({
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

        const ignoreInfo = ignoreList.map(ignore => ({
            userProfile2: ignore.userProfile2
        }));

        return res.send({ success: true, ignoreInfo });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// router.get('/get/userProfileIgnores/:profileUUID', async (req, res) => {
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

//         const ignoreList = await ignores.findAll({
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

//         const ignoreInfo = ignoreList.map(ignore => ({
//             userProfile2: ignore.userProfile2
//         }));

//         return res.send({ success: true, ignoreInfo });
//     } catch (error) {
//         res.status(400).send({ error: error.message });
//     }
// });

module.exports = router;