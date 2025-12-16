const express = require('express');
const {
    createLoan,
    getLoans,
    getLoan
} = require('../controllers/loanController');

const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
    .route('/')
    .get(getLoans)
    .post(createLoan);

router
    .route('/:id')
    .get(getLoan);

module.exports = router;
