const mongoose = require('mongoose');
const CurrentAccount = require('./src/models/CurrentAccount');
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

const fixFamiliaAccount = async () => {
    await connectDB();

    try {
        const accountId = '693176056a2f852c231711c7'; // From previous inspection
        const account = await CurrentAccount.findById(accountId);

        if (!account) {
            console.log('Account not found');
            return;
        }

        // Fix Installment #1
        const inst1 = account.installments.find(i => i.installmentNumber === 1);
        if (inst1) {
            console.log('Updating Installment #1...');
            inst1.status = 'paid';
            inst1.amountPaid = inst1.amount;
            inst1.paidDate = new Date(); // Set to now, or could ask user for date

            await account.save();
            console.log('Account updated successfully.');
        } else {
            console.log('Installment #1 not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

fixFamiliaAccount();
