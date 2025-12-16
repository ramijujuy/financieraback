const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d'
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const userExists = await User.findOne({ username });

        if (userExists) {
            return res.status(400).json({ success: false, error: 'User already exists' });
        }

        const user = await User.create({
            username,
            password,
            role
        });

        res.status(201).json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                role: user.role,
                token: generateToken(user._id)
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate email & password
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Please provide username and password' });
        }

        // Check for user
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                role: user.role,
                token: generateToken(user._id)
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
