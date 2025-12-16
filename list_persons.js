require("dotenv").config();
const mongoose = require("mongoose");
const Person = require("./src/models/Person");

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const listPersons = async () => {
    try {
        const persons = await Person.find({}, "fullName");
        console.log("Found", persons.length, "persons:");
        persons.forEach(p => console.log(`- "${p.fullName}" (ID: ${p._id})`));
    } catch (error) {
        console.error(error);
    } finally {
        mongoose.disconnect();
    }
};

listPersons();
