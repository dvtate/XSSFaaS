// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('xss:api:portal');

import validator from 'validator';
import * as db from '../db';
import { authUserSafe, generateToken, getPasswordHash } from '../auth';

import { Router } from 'express';
const router = Router();


// User signup
router.post('/user/signup', async (req, res) => {
    // Extract relevant fields
    const { name, password, email } = req.body;
    if (!name)
        return res.status(400).send('missing name');
    if (!email)
        return res.status(400).send('missing email');
    if (!password)
        return res.status(400).send('missing password');
    if (validator.isEmail(email))
        return res.status(400).send('invalid email');

    // Verify email not duplicate
    const dupEmail = await db.queryProm('SELECT 1 FROM Users WHERE email = ?;', [email], true);
    if (dupEmail instanceof Error) {
        console.error(dupEmail);
        return res.status(500).send('database failure: ');
    }
    if (dupEmail.length)
        return res.status(400).send('email already in use');

    // Put user into the database
    let userId;
    for (;;) {
        // Make pw hash
        userId = Math.random() * Number.MAX_SAFE_INTEGER;
        const pwHash = getPasswordHash(String(userId), password);

        // Try to create user
        const result = await db.queryProm(
            'INSERT INTO Users (name, email, passwordHash, createdTs) VALUES (?, ?, ?, ?);',
            [name, email, pwHash, Date.now()],
            false,
        );

        // Somehow duplicate key
        if (result instanceof Error) {
            if (result.message.match(/Duplicate entry '.+' for key 'PRIMARY'/))
                continue;
            return res.status(500).send(result.message);
        }

        break;
    }

    // Log the user in
    const token = await generateToken(userId, req.body.stayLoggedIn);
    res.send(token);
});

// User login
router.post('/user/login', async (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

    const user = await db.queryProm('SELECT userId, hashedPassword FROM Users WHERE email = ?;', [email], true);
    if (user instanceof Error) {
        console.error(user);
        return res.status(500).send(user);
    }
    if (!user[0])
        return res.status(401).send('wrong email');
    if (getPasswordHash(user[0].userId, password) === user[0].hashedPassword)
        return res.send(await generateToken(user[0].userId, stayLoggedIn));
    else
        return res.status(401).send('wrong password');
})

// TODO
// User logout
// Update user
// User stats
// List functions
// Create function
// Delete function
// Update function
// Upload file for function
// List workers
// Enable/Disable worker (to allow safe shutdown)

export default router;