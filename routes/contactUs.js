// contactUs.js

const express = require('express');
const router = express.Router();
const { contacts } = require('../models');

router.post('/contactsus', async (req, res) => {
    try {
        const { name, phoneNumber, email, note } = req.body;

        // Validate name
        if (!name || name.length < 3) {
            return res.status(400).send('Name must be at least 3 characters');
        }

        // Validate phoneNumber if provided
        if (phoneNumber) {
            const phoneNumberRegex = /^[0-9]+$/;
            if (!phoneNumberRegex.test(phoneNumber) || phoneNumber.length !== 10) {
                return res.status(400).send('Invalid phone number. Please enter a 10-digit number without spaces or special characters.');
            }
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).send('Invalid email format');
        }

        if (!note) {
            return res.status(400).send('Note must be filled.');
        }

        const contact = await contacts.create(req.body);
        res.status(201).send(contact);
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Error');
    }
});



router.get('/get/contactsus', async (req, res) => {
    try {
        const allContacts = await contacts.findAll();
        res.status(200).send(allContacts);
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Error');
    }
});


router.delete('/get/contactsus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).send('Contact ID is required');
        }
        const deletedContact = await contacts.destroy({
            where: {
                id: id
            }
        });

        if (deletedContact === 0) {
            return res.status(404).send('Contact not found');
        }

        res.status(200).send('Contact deleted successfully');
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Error');
    }
});



module.exports = router;