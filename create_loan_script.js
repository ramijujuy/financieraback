const createLoan = async () => {
    try {
        // 1. Login
        const loginRes = await fetch("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "admin",
                password: "admin",
            }),
        });
        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error("Login failed:", loginData);
            return;
        }
        const token = loginData.token;
        console.log("Logged in, token received.");

        // 2. Create Loan
        const loanData = {
            groupId: "693174bf6a2f852c23171129", // casa
            amount: 12000,
            numberOfInstallments: 3,
            shareholderContributions: [
                {
                    shareholderId: "693175a46a2f852c23171195", // mayra
                    amount: 12000
                }
            ]
        };

        const loanRes = await fetch("http://localhost:5005/api/loans", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(loanData)
        });

        const loanResult = await loanRes.json();
        if (loanResult.success) {
            console.log("Loan created successfully:", loanResult.success);
            console.log("Loan ID:", loanResult.data._id);
        } else {
            console.error("Error creating loan:", loanResult.error);
        }

    } catch (error) {
        console.error("Script error:", error);
    }
};

createLoan();
