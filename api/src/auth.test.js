const db = require("./db")
const auth = require("./auth");

beforeAll(db.begin);
afterAll(() =>
    db.queryProm("DELETE T FROM authTokens T LEFT JOIN users U ON U.userId=T.userId WHERE U.userId IS NULL")
);

it("generates a valid password hash", () => {
    const hash = auth.getPasswordHash(1234, Math.random().toString() + new Date().toISOString());
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
});

it("generates the same hash from a snapshot", () => {
    const hash = auth.getPasswordHash(1234, "strongpassword");
    expect(hash).toBe("5d0dfedd6a37f3bb7f15070d1a79212e9a77ed6a5015a541b5df04a0e5f93fd6d3ed843706f0e77a3a7a69d7a11ddf85f99eb40a77cd5d6bdb807b9f4355b28c");
});

it("generates valid tokens", async () => {
    const prevTokens = [];
    for (let i = 0; i < 100; i++) {
        const token = await auth.generateToken(i < 50 ? 10000000 : i * 10000000);
        expect(token).toMatch(/^[0-9a-z+/]{64}$/i);
        expect(prevTokens).not.toContain(token);
        prevTokens.push(token);
    }
});