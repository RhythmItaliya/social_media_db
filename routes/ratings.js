const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { body, validationResult, query, param } = require('express-validator');
const { ratings, userProfiles } = require('../models');

// RATTING POST // =============================================================================================================================================================

// 1 //
router.post('/rating', [
    body('rateUserProfile1Uuid').isUUID().withMessage('Invalid UUID for rateUserProfile1'),
    body('rateUserProfile2Uuid').isUUID().withMessage('Invalid UUID for rateUserProfile2'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5')
], async (req, res) => {
    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { rateUserProfile1Uuid, rateUserProfile2Uuid, rating } = req.body;

        const [userProfile1, userProfile2] = await Promise.all([
            userProfiles.findOne({ where: { uuid: rateUserProfile1Uuid } }),
            userProfiles.findOne({ where: { uuid: rateUserProfile2Uuid } })
        ]);

        if (!userProfile1 || !userProfile2) {
            return res.status(404).json({ error: 'One or both user profiles not found' });
        }

        const [updatedCount] = await ratings.update(
            { rating },
            {
                where: {
                    rateUserProfile1Id: userProfile1.id,
                    rateUserProfile2Id: userProfile2.id
                }
            }
        );

        if (updatedCount === 0) {
            await ratings.create({
                rateUserProfile1Id: userProfile1.id,
                rateUserProfile2Id: userProfile2.id,
                rating
            });
        }

        res.status(200).json({ message: 'Rating updated successfully' });
    } catch (error) {
        console.error('Error creating or updating rating:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// TOTAL RATTING // =============================================================================================================================================================

// 2 //
router.get('/rating/total/:profileUUID', [
    param('profileUUID').isUUID().withMessage('Invalid UUID for profile')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { profileUUID } = req.params;

        const userProfile = await userProfiles.findOne({ where: { uuid: profileUUID } });

        if (!userProfile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const userRatings = await ratings.findAll({
            where: {
                rateUserProfile2Id: userProfile.id
            }
        });

        let totalRating = 0;
        if (userRatings.length > 0) {
            totalRating = userRatings.reduce((sum, rating) => sum + rating.rating, 0);
        }

        res.status(200).json({ totalRating });
    } catch (error) {
        console.error('Error fetching total rating:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// USER RATTING // =============================================================================================================================================================
// 3 //

router.get('/rating/users', [
    query('profileUUID1').isUUID().withMessage('Invalid UUID for profileUUID1'),
    query('profileUUID2').isUUID().withMessage('Invalid UUID for profileUUID2')
], async (req, res) => {
    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { profileUUID1, profileUUID2 } = req.query;

        const [userProfile1, userProfile2] = await Promise.all([
            userProfiles.findOne({ where: { uuid: profileUUID1 } }),
            userProfiles.findOne({ where: { uuid: profileUUID2 } })
        ]);

        if (!userProfile1 || !userProfile2) {
            return res.status(404).json({ error: 'One or both user profiles not found' });
        }

        const userRating = await ratings.findOne({
            where: {
                [Op.or]: [
                    {
                        [Op.and]: [
                            { rateUserProfile1Id: userProfile1.id },
                            { rateUserProfile2Id: userProfile2.id }
                        ]
                    },
                    {
                        [Op.and]: [
                            { rateUserProfile1Id: userProfile2.id },
                            { rateUserProfile2Id: userProfile1.id }
                        ]
                    }
                ]
            }
        });

        let fieldRating = 0;
        if (userRating) {
            fieldRating = userRating.rating;
        }

        res.status(200).json({ fieldRating });
    } catch (error) {
        console.error('Error fetching field rating:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
