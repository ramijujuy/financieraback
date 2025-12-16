const User = require("../models/User");

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single user by id (admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Create a new user (admin only)
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const existing = await User.findOne({ username });
    if (existing)
      return res
        .status(400)
        .json({ success: false, error: "Username already exists" });

    const user = await User.create({ username, password, role });
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ success: true, data: userObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update a user (admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) delete updates.password; // handle password update separately via dedicated endpoint

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-password");
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete a user (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update user's password (admin only)
// @route   PUT /api/users/:id/password
// @access  Private/Admin
exports.updateUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Password is required and must be at least 4 characters",
        });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    user.password = password; // pre-save hook will hash
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, data: userObj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
