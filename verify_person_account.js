require("dotenv").config();
const mongoose = require("mongoose");
const Person = require("./src/models/Person");
const Group = require("./src/models/Group");
const Loan = require("./src/models/Loan");
const CurrentAccount = require("./src/models/CurrentAccount");

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const verify = async () => {
    try {
        const person = await Person.findOne({ fullName: /amaia/i }).populate("group");
        if (!person) {
            console.log("Person 'amaia' not found");
            return;
        }
        console.log("Person found:", person.fullName, person._id);

        if (!person.group) {
            console.log("Person has no group");
            return;
        }
        console.log("Person belongs to group:", person.group.name, person.group._id);

        const loan = await Loan.findOne({ group: person.group._id });
        if (!loan) {
            console.log("Group has no loan");
        } else {
            console.log("Group has loan:", loan._id, "Status:", loan.status);
        }

        const groupAccount = await CurrentAccount.findOne({ group: person.group._id });
        if (!groupAccount) {
            console.log("Group has no account");
        } else {
            console.log("Group has account:", groupAccount._id);
        }

    } catch (error) {
        console.error(error);
    } finally {
        mongoose.disconnect();
    }
};

verify();
