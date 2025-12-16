const mongoose = require('mongoose');
const CurrentAccount = require('./src/models/CurrentAccount');
const Group = require('./src/models/Group');
const Loan = require('./src/models/Loan');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const inspectGroupAccount = async () => {
    await connectDB();

    try {
        // Find Group "Familia" (case insensitive)
        const group = await Group.findOne({ name: { $regex: /familia/i } });

        if (!group) {
            console.log('Group "Familia" not found');
            return;
        }
        console.log(`Found Group: ${group.name} (${group._id})`);

        // Find Current Account
        const account = await CurrentAccount.findOne({ group: group._id }).populate('installments');

        if (!account) {
            console.log('Current Account not found for this group');
            return;
        }

        console.log('--- Account Details ---');
        console.log(`ID: ${account._id}`);
        console.log(`Total Amount: ${account.totalAmount}`);

        console.log('--- Installments ---');
        account.installments.forEach(inst => {
            console.log(`Installment #${inst.installmentNumber}:`);
            console.log(`  Amount: ${inst.amount}`);
            console.log(`  Amount Paid: ${inst.amountPaid}`);
            console.log(`  Status: ${inst.status}`);
            console.log(`  Due Date: ${inst.dueDate}`);
            console.log(`  Paid Date: ${inst.paidDate}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

inspectGroupAccount();
