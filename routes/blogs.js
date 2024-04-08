const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const uuid = require('uuid');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { blogs, blogComments } = require('../models');


const validateField = (field, fieldName) => {
    if (!field) {
        throw new Error(`Missing or invalid ${fieldName}.`);
    }
};
// 1
router.post('/blogs', async (req, res) => {
    try {

        const { title, isPublic, contentarea, keyword, data } = req.body;

        validateField(title, 'title');
        validateField(contentarea, 'contentarea');
        validateField(keyword, 'keyword');
        validateField(data, 'data');

        if (typeof data !== 'string') {
            return res.status(400).json({ success: false, error: 'Invalid or missing data.' });
        }

        const matches = data.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
        const fileExtension = matches ? matches[1] : 'png';
        const uuidN = uuid.v4();
        const newFileName = `${uuidN}.${fileExtension}`;
        const image = Buffer.from(data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, ''), 'base64');
        const filePath = path.join(__dirname, '..', 'blogs', newFileName);
        fs.writeFileSync(filePath, image);
        const fileLink = newFileName;

        const newBlog = await blogs.create({
            blogURL: fileLink,
            title,
            isPublic,
            contentarea,
            keyword
        });

        return res.status(201).send({ success: true, blog: newBlog });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// 2
router.get('/new/blogs', async (req, res) => {
    try {
        const latestBlog = await blogs.findOne({
            order: [['createdAt', 'DESC']]
        });

        if (!latestBlog) {
            return res.status(404).json({ success: false, error: 'No blogs found' });
        }

        const blogComment = await blogComments.findAll({
            where: { blogId: latestBlog.id },
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({ success: true, blog: latestBlog, comments: blogComment });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});


// 3
router.get('/all/titles', async (req, res) => {
    try {
        const allTitles = await blogs.findAll({
            attributes: ['id', 'title'],
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({ success: true, titles: allTitles });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// 4
router.get('/blogs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const SelectBlog = await blogs.findByPk(id);
        if (!SelectBlog) {
            return res.status(404).json({ success: false, error: 'Blog not found' });
        }
        const blogComment = await blogComments.findAll({
            where: { blogId: SelectBlog.id },
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json({ success: true, blog: SelectBlog, comments: blogComment });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
});

// 6
router.post('/blogs/:blogId/comments', async (req, res) => {
    try {
        const { blogId } = req.params;
        const { name, text } = req.body;
        const newComment = await blogComments.create({
            blogId: blogId,
            name: name,
            text: text,
        });

        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



module.exports = router;

