const db = require("./db");

it("connects to the database", async () => {
    db.begin();
    expect(db.connected).toBe(true);
});

it("connects twice to the database", async () => {
    db.begin();
    expect(db.connected).toBe(true);
    db.begin();
    expect(db.connected).toBe(true);
});

it("closes the connection", async () => {
    db.begin();
    expect(db.connected).toBe(true);
    await db.close();
    expect(db.connected).toBe(false);
});

it("queries the database", async () => {
    db.begin();
    let result = await db.queryProm("SELECT 55 x");
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(55);

    result = await db.queryProm("SELECT ? x", [66]);
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(66);

    result = await db.queryProm("SELECT 77 x", [], true);
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(77);
});

it("returns an error in case of query syntax error", async () => {
    db.begin();
    let result = await db.queryProm("SELECT x y z");
    expect(result instanceof Error).toBe(true);
});