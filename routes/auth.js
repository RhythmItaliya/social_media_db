const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const uuid = require('uuid');
const sendMail = require('../untils/mailer');
const { users } = require('../models');

//  RIGISTER API =============================================================================================================================================================

// 1
router.post('/register',
    [
        body('username')
            .trim()
            .isLength({ min: 3, max: 255 })
            .withMessage('Username must be between 3 to 255 characters.'),
        body('password')
            .trim()
            .isLength({ min: 8 })
            .withMessage('Password is too short; minimum 8 characters required.'),
        body('email')
            .trim()
            .isEmail()
            .withMessage('Invalid email address'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userEmail = await users.findOne({
                where: {
                    email: req.body.email,
                }
            });

            if (userEmail) {
                return res.status(409).send({
                    isEmail: false
                });
            }

            const userUsername = await users.findOne({
                where: {
                    username: req.body.username,
                }
            });

            if (userUsername) {
                return res.status(409).send('Username is already taken');
            }

            const token = uuid.v1();

            users.create({
                username: req.body.username,
                password: req.body.password,
                email: req.body.email,
                token: token
            });

            const htmlBody = `<b>To verify your account: <a href="http://localhost:3000/verify/login/${token}">Link</a></b>`;
            sendMail(req.body.email, 'Your verify link', htmlBody);

            return res.status(201).send('Please check your email confirmation...');
        } catch (e) {
            console.error(e);
            return res.status(500).send('Lagata hai server me error hai...');
        }
    }
);

// 2
router.get('/verify/login/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Bad Request", message: errors.array()[0].msg });
        }

        try {
            const user = await users.findOne({
                where: {
                    token: req.params.token,
                    isActive: 0
                }
            });

            if (!user) {
                return res.status(404).json({ success: false, error: "Not Found", message: "Token is invalid or already used." });
            }

            const newToken = uuid.v1();

            await users.update(
                {
                    token: newToken,
                    isActive: 1
                },
                {
                    where: {
                        id: user.id
                    }
                }
            );

            return res.status(200).json({ success: true, message: "Account verified successfully." });

        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: "Internal Server Error", message: "An error occurred while processing your request." });
        }
    }
);

// LOGIN API =============================================================================================================================================================

// 3
router.post('/login',
    [
        body('username')
            .trim()
            .notEmpty()
            .withMessage('Username or email is required'),
        body('password')
            .trim()
            .notEmpty()
            .withMessage('Password is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Bad Request", message: errors.array()[0].msg });
        }

        try {
            const user = await users.findOne({
                where: {
                    [Op.or]: [
                        { username: req.body.username },
                        { email: req.body.username }
                    ],
                    isActive: 1
                }
            });

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password.' });
            }

            const passwordMatch = await bcrypt.compare(req.body.password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password.' });
            }

            const token = jwt.sign({ uuid: user.uuid }, 'YOUR_SECRET_KEY', { expiresIn: '7d' });

            res.cookie('X-Access-Token', token, { maxAge: 7776000000, signed: true, path: '/', secure: true, httpOnly: true });

            return res.status(200).json({
                "X-Access-Token": token,
                "uuid": user.uuid,
                "username": user.username
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal Server Error", message: "An error occurred while processing your request." });
        }
    }
);


// LOGOUT =============================================================================================================================================================

// 4
router.post('/logout', (req, res) => {
    try {
        res.clearCookie('X-Access-Token');

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal Server Error.' });
    }
});

// RESET PASSWORD REQUEST MAIL =============================================================================================================================================================

// 5
router.post('/reset/request',
    [
        body('email')
            .isEmail()
            .withMessage('Invalid email address')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await users.findOne({
                where: {
                    email: req.body.email
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'Not Found', message: 'Email not found.' });
            }

            const token = uuid.v1();

            await users.update(
                {
                    token: token,
                },
                {
                    where: {
                        id: user.id
                    }
                });

            const resetLink = `http://localhost:3000/reset/password/${token}`;
            sendMail(user.email, 'Your Reset link', resetLink);

            return res.status(200).json({ message: 'Password reset link sent successfully.' });

        } catch (error) {
            console.error('Error occurred during password reset request:', error);
            return res.status(500).json({ error: 'Internal Server Error', message: 'An error occurred on the server.' });
        }
    }
);

// 6
router.get('/resetlink/verify/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const user = await users.findOne({
                where: {
                    token: req.params.token
                }
            });

            if (!user) {
                return res.status(404).json({ isValid: false, message: "Link is expired." });
            }

            return res.status(200).send('Reset link is valid.');

        } catch (error) {
            console.error('Error during reset link verification:', error);
            return res.status(500).send('Internal Server Error.');
        }
    }
);

// PASSWORD RESET =============================================================================================================================================================

// 7
router.post('/reset/password/:token',
    [
        param('token')
            .isUUID()
            .withMessage('Invalid token format'),
        body('password1')
            .isLength({ min: 8 })
            .withMessage('Password is too short; minimum 8 characters required.'),
        body('password2')
            .custom((value, { req }) => {
                if (value !== req.body.password1) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const resetToken = req.params.token;


            const user = await users.findOne({
                where: {
                    token: resetToken
                }
            });

            if (!user) {
                return res.status(404).send('This link has expired or is invalid.');
            }

            const token = uuid.v1();
            const hashedPassword = bcrypt.hashSync(req.body.password1, 10);

            const updatedUser = await users.update(
                {
                    password: hashedPassword,
                    token: token,
                    isActive: 1
                },
                {
                    where: {
                        token: resetToken
                    },
                }
            );

            if (!updatedUser[0]) {
                return res.status(404).send('User not found');
            }

            return res.status(201).send('Your password has been updated.');

        } catch (error) {
            console.error('Error during password reset:', error);
            return res.status(500).send('Internal Server Error.');
        }
    }
);

module.exports = router;