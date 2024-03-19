const express = require('express');
const router = express.Router();

const { Op, literal } = require('sequelize');
const { users, userProfiles, profilePhotes } = require('../models');

// SEARCH_PROFILE =============================================================================================================================================================

// 1
router.get('/search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;

        const usersList = await users.findAll({
            where: {
                [Op.and]: [
                    {
                        [Op.or]: [
                            { username: { [Op.like]: `%${searchTerm}%` } },
                            { '$userProfile.firstName$': { [Op.like]: `%${searchTerm}%` } },
                            { '$userProfile.lastName$': { [Op.like]: `%${searchTerm}%` } }
                        ]
                    },
                    { isActive: 1 },
                    { profileCreated: 1 }
                ]
            },
            include: [{
                model: userProfiles,
                as: 'userProfile',
                attributes: ['uuid', 'firstName', 'lastName'],
                include: [{
                    model: profilePhotes,
                    attributes: ['photoURL']
                }]
            }],
            attributes: ['uuid', 'username'],
            order: literal(
                "CASE " +
                "WHEN username LIKE :searchTerm THEN 1 " +
                "WHEN '$userProfile.firstName$' LIKE :searchTerm THEN 2 " +
                "WHEN '$userProfile.lastName$' LIKE :searchTerm THEN 3 " +
                "ELSE 4 " +
                "END"
            ),
            replacements: { searchTerm: `%${searchTerm}%` }
        });

        if (usersList.length > 0) {
            res.send({ success: true, users: usersList });
        } else {
            res.send({ success: false, message: 'No matching users found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

module.exports = router;