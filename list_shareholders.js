require("dotenv").config();
const mongoose = require("mongoose");
const Shareholder = require("./src/models/Shareholder");

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const listShareholders = async () => {
    try {
        const shareholders = await Shareholder.find({});
        console.log("Found", shareholders.length, "shareholders:");
        shareholders.forEach(s => console.log(`- "${s.fullName}" (ID: ${s._id})`));
    } catch (error) {
        console.error(error);
    } finally {
        mongoose.disconnect();
    }
};

listShareholders();
