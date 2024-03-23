const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { messages, userProfiles } = require('../models');

// CHAT GET // =============================================================================================================================================================

// 1 //
router.get('/get-messages/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;

        const user = await userProfiles.findOne({ where: { uuid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = user.id;

        const userMessages = await messages.findAll({
            where: {
                [Op.or]: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            include: [
                { model: userProfiles, as: 'sender', attributes: ['uuid'] },
                { model: userProfiles, as: 'receiver', attributes: ['uuid'] }
            ]
        });

        const formattedMessages = userMessages.map(message => {
            return {
                id: message.id,
                content: message.content,
                sender: message.sender ? message.sender.uuid : null,
                receiver: message.receiver ? message.receiver.uuid : null,
                createdAt: message.createdAt,
            };
        });

        res.send({ messages: formattedMessages });
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// LAST MESSEGE GET // =============================================================================================================================================================

// 2 //
router.get('/get-last-message/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;

        const user = await userProfiles.findOne({ where: { uuid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = user.id;

        const lastMessage = await messages.findOne({
            where: {
                [Op.or]: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        if (!lastMessage) {
            return res.status(404).send({ error: 'No messages found for the user' });
        }

        const lastMessageData = {
            message: lastMessage.content,
            timestamp: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            receiverId: lastMessage.receiverId
        };

        res.send({ lastMessage: lastMessageData });
    } catch (error) {
        console.error('Error retrieving the last message:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


module.exports = router;
